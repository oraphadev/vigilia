/**
 * Bots de teste manual: entram numa sala existente e jogam sozinhos
 * (confirmam papel, propõem quando líderes, aprovam tudo, Eclipse sabota).
 *
 * Uso: SIM_URL=http://localhost:3210 npx tsx scripts/bots.ts <CODIGO> [quantos=4]
 */
import { io, type Socket } from 'socket.io-client';
import type { PlayerView } from '../shared/src/index.js';

const URL = process.env.SIM_URL ?? 'http://localhost:3210';
const code = process.argv[2]?.toUpperCase();
const count = Number(process.argv[3] ?? 4);
if (!code) {
  console.error('Uso: npx tsx scripts/bots.ts <CODIGO> [quantos]');
  process.exit(1);
}

const NAMES = ['Bruma', 'Cinza', 'Alva', 'Petra', 'Corvo', 'Íris', 'Nero', 'Sol', 'Vesper'];

async function call(socket: Socket, event: string, ...args: unknown[]): Promise<void> {
  const reply = (await socket.timeout(5000).emitWithAck(event, ...args)) as {
    ok: boolean;
    message?: string;
  };
  if (!reply.ok) console.error(`[bot] ${event} recusado: ${reply.message}`);
}

function spawnBot(name: string, index: number): void {
  const socket = io(URL, { transports: ['websocket'] });
  let acting = false;

  socket.on('connect', () => {
    void call(socket, 'room:join', { code, name, avatar: index + 1 });
  });

  socket.on('state', (view: PlayerView) => {
    if (acting) return;
    acting = true;
    // Pequeno atraso para parecer humano e evitar corridas de ack.
    setTimeout(() => {
      void (async () => {
        try {
          const me = view.you;
          if (view.phase === 'roleReveal' && !view.players.find((p) => p.id === me.id)?.hasAckedRole) {
            await call(socket, 'game:ackRole');
          } else if (view.phase === 'teamSelect' && me.isLeader) {
            const size = view.teamSizes[view.round]!;
            const team = [...view.players].sort(() => 0.5 - Math.random()).slice(0, size);
            await call(socket, 'game:propose', { team: team.map((p) => p.id) });
          } else if (view.phase === 'voting' && !me.hasVoted) {
            await call(socket, 'game:vote', { approve: Math.random() > 0.25 });
          } else if (view.phase === 'mission' && me.onTeam && !me.hasPlayedCard) {
            await call(socket, 'game:card', { light: me.faction !== 'eclipse' });
          }
        } finally {
          acting = false;
        }
      })();
    }, 600 + Math.random() * 900);
  });

  socket.on('disconnect', () => console.log(`[bot] ${name} desconectado`));
}

for (let i = 0; i < count; i++) spawnBot(NAMES[i % NAMES.length]!, i);
console.log(`${count} bots entrando na sala ${code} em ${URL}. Ctrl+C para encerrar.`);
