import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  ackRole,
  castVote,
  type ClientToServerEvents,
  GameError,
  playCard,
  proposeTeam,
  removePlayer,
  type Reply,
  returnToLobby,
  type ServerToClientEvents,
  setConnected,
  migrateHost,
  startGame,
  viewFor,
} from '@vigilia/shared';
import { Room, RoomManager } from './rooms.js';

const PORT = Number(process.env.PORT ?? 3210);
/** Tempo que o anfitrião tem para reconectar antes de perder o posto. */
const HOST_MIGRATION_GRACE_MS = 15_000;
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true },
});

const rooms = new RoomManager();

const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
app.use(express.static(clientDist));
app.get('/health', (_req, res) => res.json({ ok: true }));
// SPA fallback (deep links como /sala/ABCDE caem no index).
app.get(/^(?!\/socket\.io).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')));

interface SocketData {
  room: Room | null;
  playerId: string | null;
}

function broadcast(room: Room): void {
  for (const [playerId, socketId] of room.sockets) {
    io.to(socketId).emit('state', viewFor(room.state, playerId));
  }
}

/**
 * Executa uma ação validada pelo motor e responde via ack.
 * Toda mutação de estado passa por aqui: valida → aplica → rebroadcast.
 */
function act(socket: Socket, data: SocketData, ack: (reply: Reply) => void, action: (room: Room, playerId: string) => void): void {
  try {
    if (!data.room || !data.playerId) {
      throw new GameError('ROOM_NOT_FOUND', 'Você não está em uma sala.');
    }
    action(data.room, data.playerId);
    ack({ ok: true });
    broadcast(data.room);
  } catch (error) {
    if (error instanceof GameError) {
      ack({ ok: false, code: error.code, message: error.message });
    } else {
      console.error('Erro inesperado:', error);
      ack({ ok: false, code: 'INTERNAL', message: 'Erro interno do servidor.' });
    }
  }
}

function attach(socket: Socket, data: SocketData, room: Room, playerId: string): void {
  // Derruba um socket antigo do mesmo jogador (ex.: outra aba).
  const previous = room.sockets.get(playerId);
  if (previous && previous !== socket.id) {
    io.in(previous).disconnectSockets(true);
  }
  data.room = room;
  data.playerId = playerId;
  room.sockets.set(playerId, socket.id);
  setConnected(room.state, playerId, true);
  room.updateEmptiness();
}

io.on('connection', (socket) => {
  const data: SocketData = { room: null, playerId: null };

  socket.on('room:create', ({ name, avatar }, ack) => {
    try {
      const { room, session } = rooms.create(String(name), Number(avatar) || 0);
      attach(socket, data, room, session.playerId);
      ack({ ok: true, data: { token: session.token, view: viewFor(room.state, session.playerId) } });
    } catch (error) {
      ack(errorReply(error));
    }
  });

  socket.on('room:join', ({ code, name, avatar }, ack) => {
    try {
      const { room, session } = rooms.join(String(code), String(name), Number(avatar) || 0);
      attach(socket, data, room, session.playerId);
      ack({ ok: true, data: { token: session.token, view: viewFor(room.state, session.playerId) } });
      broadcast(room);
    } catch (error) {
      ack(errorReply(error));
    }
  });

  socket.on('room:resume', ({ token }, ack) => {
    const resumed = rooms.resume(String(token));
    if (!resumed) {
      ack({ ok: false, code: 'ROOM_NOT_FOUND', message: 'Sessão expirada.' });
      return;
    }
    attach(socket, data, resumed.room, resumed.session.playerId);
    ack({ ok: true, data: { view: viewFor(resumed.room.state, resumed.session.playerId) } });
    broadcast(resumed.room);
  });

  socket.on('room:leave', () => {
    if (!data.room || !data.playerId) return;
    const room = data.room;
    rooms.leave(room, data.playerId);
    data.room = null;
    data.playerId = null;
    broadcast(room);
  });

  socket.on('room:kick', ({ playerId: targetId }, ack) =>
    act(socket, data, ack, (room, playerId) => {
      const requester = room.state.players.find((p) => p.id === playerId);
      if (!requester?.isHost) throw new GameError('NOT_HOST', 'Apenas o anfitrião pode remover jogadores.');
      if (targetId === playerId) throw new GameError('PLAYER_NOT_FOUND', 'Use “sair da sala” para sair.');
      removePlayer(room.state, String(targetId));
      rooms.dropSessionsFor(room.state.code, String(targetId));
      const targetSocket = room.sockets.get(String(targetId));
      room.sockets.delete(String(targetId));
      if (targetSocket) {
        io.to(targetSocket).emit('kicked');
        io.in(targetSocket).disconnectSockets(true);
      }
    }),
  );

  socket.on('game:start', (ack) =>
    act(socket, data, ack, (room, playerId) => startGame(room.state, playerId, Math.random)),
  );

  socket.on('game:ackRole', (ack) =>
    act(socket, data, ack, (room, playerId) => ackRole(room.state, playerId)),
  );

  socket.on('game:propose', ({ team }, ack) =>
    act(socket, data, ack, (room, playerId) =>
      proposeTeam(room.state, playerId, Array.isArray(team) ? team.map(String) : []),
    ),
  );

  socket.on('game:vote', ({ approve }, ack) =>
    act(socket, data, ack, (room, playerId) => castVote(room.state, playerId, Boolean(approve))),
  );

  socket.on('game:card', ({ light }, ack) =>
    act(socket, data, ack, (room, playerId) => playCard(room.state, playerId, Boolean(light))),
  );

  socket.on('game:playAgain', (ack) =>
    act(socket, data, ack, (room, playerId) => returnToLobby(room.state, playerId)),
  );

  socket.on('disconnect', () => {
    if (!data.room || !data.playerId) return;
    const room = data.room;
    const playerId = data.playerId;
    // Só marca desconectado se este ainda for o socket ativo do jogador.
    if (room.sockets.get(playerId) !== socket.id) return;
    room.sockets.delete(playerId);
    setConnected(room.state, playerId, false);
    room.updateEmptiness();
    broadcast(room);
    // Um refresh não destrona o anfitrião: migra só se ele não voltar a tempo.
    setTimeout(() => {
      const player = room.state.players.find((p) => p.id === playerId);
      if (player?.isHost && !player.connected) {
        migrateHost(room.state);
        broadcast(room);
      }
    }, HOST_MIGRATION_GRACE_MS).unref();
  });
});

function errorReply(error: unknown): { ok: false; code: never; message: string } {
  if (error instanceof GameError || (error instanceof Error && 'code' in error)) {
    const e = error as Error & { code: string };
    return { ok: false, code: e.code as never, message: e.message };
  }
  console.error('Erro inesperado:', error);
  return { ok: false, code: 'INTERNAL' as never, message: 'Erro interno do servidor.' };
}

httpServer.listen(PORT, () => {
  console.log(`VIGÍLIA acesa em http://localhost:${PORT}`);
});
