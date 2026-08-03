/**
 * Simulação fim-a-fim: 5 clientes Socket.IO reais jogam uma vigília completa
 * contra o servidor em execução (SIM_URL, padrão http://localhost:3000).
 *
 * Verifica: criação/entrada de sala, distribuição de papéis, redação anti-cheat
 * no fio, rejeição de proposta, expedições com sabotagem, reconexão por token
 * e término consistente. Sai com código != 0 em qualquer violação.
 */
import { io, type Socket } from 'socket.io-client';
import type { PlayerView } from '../shared/src/index.js';

const URL = process.env.SIM_URL ?? 'http://localhost:3000';
const PLAYERS = 5;

interface Client {
  name: string;
  socket: Socket;
  token: string;
  view: PlayerView;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function ok(message: string): void {
  console.log(`✓ ${message}`);
}

function connect(): Socket {
  return io(URL, { transports: ['websocket'] });
}

async function call<T>(socket: Socket, event: string, ...args: unknown[]): Promise<T> {
  const reply = (await socket.timeout(5000).emitWithAck(event, ...args)) as
    | { ok: true; data: T }
    | { ok: false; message: string };
  if (!reply.ok) throw new Error(`${event}: ${reply.message}`);
  return reply.data;
}

function trackViews(client: Client): void {
  client.socket.on('state', (view: PlayerView) => {
    client.view = view;
  });
}

async function until(clients: Client[], predicate: (v: PlayerView) => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (clients.every((c) => predicate(c.view))) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  fail(`timeout aguardando: ${label}`);
}

const clients: Client[] = [];

// --- Sala ---
const hostSocket = connect();
const created = await call<{ token: string; view: PlayerView }>(hostSocket, 'room:create', {
  name: 'Host',
  avatar: 0,
});
clients.push({ name: 'Host', socket: hostSocket, token: created.token, view: created.view });
const code = created.view.code;
ok(`sala criada: ${code}`);

for (let i = 1; i < PLAYERS; i++) {
  const socket = connect();
  const joined = await call<{ token: string; view: PlayerView }>(socket, 'room:join', {
    name: `Jogador ${i}`,
    avatar: i,
    code,
  });
  clients.push({ name: `Jogador ${i}`, socket, token: joined.token, view: joined.view });
}
clients.forEach(trackViews);
await until(clients, (v) => v.players.length === PLAYERS, 'todos no lobby');
ok(`${PLAYERS} jogadores no lobby`);

// Código inválido é recusado.
const stranger = connect();
const bad = await stranger
  .timeout(5000)
  .emitWithAck('room:join', { name: 'Intruso', avatar: 0, code: 'XXXXX' }) as { ok: boolean };
if (bad.ok) fail('entrada com código inválido deveria falhar');
stranger.disconnect();
ok('código inválido recusado');

// --- Início e papéis ---
await call(clients[0]!.socket, 'game:start');
await until(clients, (v) => v.phase === 'roleReveal', 'roleReveal');

const eclipse = clients.filter((c) => c.view.you.faction === 'eclipse');
const sentinels = clients.filter((c) => c.view.you.faction === 'sentinela');
if (eclipse.length !== 2 || sentinels.length !== 3) {
  fail(`distribuição errada: ${eclipse.length} eclipse / ${sentinels.length} sentinelas`);
}
ok('papéis distribuídos 2 Eclipse / 3 Sentinelas');

// Redação: sentinela não pode ver conspiradores nem papéis alheios no fio.
for (const s of sentinels) {
  const raw = JSON.stringify(s.view);
  if (s.view.you.conspirators !== null) fail('sentinela recebeu lista de conspiradores');
  if (raw.includes('"roles"') || raw.includes('missionCards')) fail('estado bruto vazou no fio');
}
const [e1, e2] = eclipse;
if (!e1!.view.you.conspirators?.includes(e2!.view.you.id)) fail('eclipse não enxerga o comparsa');
ok('redação anti-cheat verificada no fio');

for (const c of clients) await call(c.socket, 'game:ackRole');
await until(clients, (v) => v.phase === 'teamSelect', 'teamSelect');

// Sentinela tentando sabotar deve ser recusado depois; primeiro: proposta rejeitada.
function leaderClient(): Client {
  const id = clients[0]!.view.leaderId;
  return clients.find((c) => c.view.you.id === id) ?? fail('líder não encontrado');
}

// --- Rejeição de proposta ---
let leader = leaderClient();
let size = clients[0]!.view.teamSizes[0]!;
await call(leader.socket, 'game:propose', {
  team: clients.slice(0, size).map((c) => c.view.you.id),
});
await until(clients, (v) => v.phase === 'voting', 'voting (1ª proposta)');
for (const c of clients) await call(c.socket, 'game:vote', { approve: false });
await until(clients, (v) => v.phase === 'teamSelect' && v.attempt === 1, 'proposta rejeitada');
if (clients[0]!.view.lastVote?.approved !== false) fail('lastVote deveria registrar rejeição');
ok('rejeição de proposta gira o comando e acende o pip');

// --- Joga até o fim: Eclipse sempre sabota quando está na patrulha ---
let guard = 0;
while (clients[0]!.view.phase !== 'gameOver') {
  if (++guard > 40) fail('partida não terminou em 40 iterações');
  const view = clients[0]!.view;

  if (view.phase === 'teamSelect') {
    leader = leaderClient();
    size = view.teamSizes[view.round]!;
    // Alterna entre patrulhas com e sem Eclipse para exercitar os dois resultados.
    const pool = view.round % 2 === 0 ? [...eclipse, ...sentinels] : [...sentinels, ...eclipse];
    await call(leader.socket, 'game:propose', { team: pool.slice(0, size).map((c) => c.view.you.id) });
    await until(clients, (v) => v.phase !== 'teamSelect', 'saída de teamSelect');
  } else if (view.phase === 'voting') {
    for (const c of clients) {
      if (!(c.view.you.hasVoted)) await call(c.socket, 'game:vote', { approve: true });
    }
    await until(clients, (v) => v.phase !== 'voting', 'apuração');
  } else if (view.phase === 'mission') {
    const team = clients.filter((c) => c.view.you.onTeam);
    // Sentinela tentando sabotar tem de ser barrado pelo servidor.
    const loyalOnTeam = team.find((c) => c.view.you.faction === 'sentinela');
    if (loyalOnTeam) {
      const rejected = (await loyalOnTeam.socket
        .timeout(5000)
        .emitWithAck('game:card', { light: false })) as { ok: boolean };
      if (rejected.ok) fail('servidor aceitou sabotagem de sentinela');
    }
    for (const c of team) {
      if (!c.view.you.hasPlayedCard) {
        await call(c.socket, 'game:card', { light: c.view.you.faction !== 'eclipse' });
      }
    }
    await until(clients, (v) => v.phase !== 'mission', 'resolução da expedição');
  }
}
ok(`partida terminou: vencedor ${clients[0]!.view.winner} (${clients[0]!.view.winReason})`);
if (!clients[0]!.view.rolesRevealed) fail('papéis não revelados no fim');

// --- Reconexão por token ---
const dropped = clients[2]!;
dropped.socket.disconnect();
await new Promise((r) => setTimeout(r, 150));
const fresh = connect();
const resumed = await call<{ view: PlayerView }>(fresh, 'room:resume', { token: dropped.token });
if (resumed.view.you.id !== dropped.view.you.id) fail('reconexão devolveu identidade errada');
ok('reconexão por token restaura a identidade');

// --- Nova partida ---
const host = clients.find((c) => c.view.you.isHost)!;
await call(host.socket, 'game:playAgain');
await until(
  clients.filter((c) => c !== dropped),
  (v) => v.phase === 'lobby',
  'volta ao lobby',
);
ok('nova partida devolve todos ao lobby');

console.log('\nSimulação completa sem violações.');
process.exit(0);
