import { randomBytes, randomUUID } from 'node:crypto';
import {
  addPlayer,
  createGame,
  type GameState,
  migrateHost,
  removePlayer,
  setConnected,
} from '@vigilia/shared';

/** Sem 0/O/1/I para códigos fáceis de ditar em voz alta. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
/** Sala vazia (todos desconectados) é destruída após este prazo. */
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

export interface Session {
  token: string;
  code: string;
  playerId: string;
}

export class Room {
  readonly state: GameState;
  /** playerId → socketId do socket vivo (se houver). */
  readonly sockets = new Map<string, string>();
  emptySince: number | null = null;

  constructor(code: string, hostId: string, name: string, avatar: number) {
    this.state = createGame(code, { id: hostId, name, avatar });
  }

  get isAbandoned(): boolean {
    return this.emptySince !== null && Date.now() - this.emptySince > EMPTY_ROOM_TTL_MS;
  }

  updateEmptiness(): void {
    const anyConnected = this.state.players.some((p) => p.connected);
    this.emptySince = anyConnected || this.state.players.length === 0 ? null : Date.now();
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, Session>();

  constructor() {
    setInterval(() => this.sweep(), 60_000).unref();
  }

  private generateCode(): string {
    for (;;) {
      const bytes = randomBytes(CODE_LENGTH);
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.rooms.has(code)) return code;
    }
  }

  create(name: string, avatar: number): { room: Room; session: Session } {
    const code = this.generateCode();
    const playerId = randomUUID();
    const room = new Room(code, playerId, name, avatar);
    this.rooms.set(code, room);
    return { room, session: this.createSession(code, playerId) };
  }

  join(code: string, name: string, avatar: number): { room: Room; session: Session } {
    const room = this.get(code);
    const playerId = randomUUID();
    addPlayer(room.state, { id: playerId, name, avatar });
    return { room, session: this.createSession(code, playerId) };
  }

  get(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw Object.assign(new Error('Sala não encontrada — confira o código.'), {
        code: 'ROOM_NOT_FOUND',
      });
    }
    return room;
  }

  resume(token: string): { room: Room; session: Session } | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    const room = this.rooms.get(session.code);
    if (!room || !room.state.players.some((p) => p.id === session.playerId)) {
      this.sessions.delete(token);
      return null;
    }
    return { room, session };
  }

  private createSession(code: string, playerId: string): Session {
    const session: Session = { token: randomUUID(), code, playerId };
    this.sessions.set(session.token, session);
    return session;
  }

  /** Saída definitiva: remove do estado (lobby/fim) ou marca desconectado (em jogo). */
  leave(room: Room, playerId: string): void {
    if (room.state.phase === 'lobby' || room.state.phase === 'gameOver') {
      removePlayer(room.state, playerId);
      this.dropSessionsFor(room.state.code, playerId);
    } else {
      setConnected(room.state, playerId, false);
      migrateHost(room.state);
    }
    room.sockets.delete(playerId);
    room.updateEmptiness();
  }

  dropSessionsFor(code: string, playerId: string): void {
    for (const [token, s] of this.sessions) {
      if (s.code === code && s.playerId === playerId) this.sessions.delete(token);
    }
  }

  private sweep(): void {
    for (const [code, room] of this.rooms) {
      room.updateEmptiness();
      if (room.isAbandoned) {
        this.rooms.delete(code);
        for (const [token, s] of this.sessions) {
          if (s.code === code) this.sessions.delete(token);
        }
      }
    }
  }
}
