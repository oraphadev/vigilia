import { describe, expect, it } from 'vitest';
import {
  ackRole,
  addPlayer,
  castVote,
  createGame,
  ECLIPSE_COUNT,
  GameError,
  type GameState,
  leaderId,
  MAX_REJECTIONS,
  migrateHost,
  playCard,
  proposeTeam,
  removePlayer,
  returnToLobby,
  setConnected,
  startGame,
  TEAM_SIZES,
} from '../src/index.js';

import { seededRng } from './rng.js';

function makeGame(playerCount: number, seed = 42): GameState {
  const state = createGame('ABCDE', { id: 'p0', name: 'Jogador 0', avatar: 0 });
  for (let i = 1; i < playerCount; i++) {
    addPlayer(state, { id: `p${i}`, name: `Jogador ${i}`, avatar: i });
  }
  startGame(state, 'p0', seededRng(seed));
  for (const p of state.players) ackRole(state, p.id);
  return state;
}

function eclipseIds(state: GameState): string[] {
  return Object.entries(state.roles)
    .filter(([, f]) => f === 'eclipse')
    .map(([id]) => id);
}

function sentinelIds(state: GameState): string[] {
  return Object.entries(state.roles)
    .filter(([, f]) => f === 'sentinela')
    .map(([id]) => id);
}

/** Propõe o time do líder atual e aprova por unanimidade. */
function approveTeam(state: GameState, team: string[]): void {
  proposeTeam(state, leaderId(state)!, team);
  for (const p of state.players) castVote(state, p.id, true);
}

/** Joga uma expedição completa com `fails` sabotagens. */
function runMission(state: GameState, fails: number): void {
  const eclipse = eclipseIds(state);
  const size = TEAM_SIZES[state.players.length]![state.round]!;
  const team = [...eclipse.slice(0, fails), ...sentinelIds(state)].slice(0, size);
  approveTeam(state, team);
  for (const id of team) playCard(state, id, !eclipse.slice(0, fails).includes(id));
}

describe('lobby', () => {
  it('rejeita início com menos de 5 jogadores', () => {
    const state = createGame('ABCDE', { id: 'p0', name: 'Ana', avatar: 0 });
    for (let i = 1; i < 4; i++) addPlayer(state, { id: `p${i}`, name: `J${i}`, avatar: i });
    expect(() => startGame(state, 'p0', Math.random)).toThrowError(GameError);
  });

  it('rejeita 11º jogador e nomes duplicados', () => {
    const state = createGame('ABCDE', { id: 'p0', name: 'Ana', avatar: 0 });
    for (let i = 1; i < 10; i++) addPlayer(state, { id: `p${i}`, name: `J${i}`, avatar: i });
    expect(() => addPlayer(state, { id: 'p10', name: 'J10', avatar: 0 })).toThrowError(/máximo/);
    state.players.pop();
    expect(() => addPlayer(state, { id: 'px', name: 'j1', avatar: 0 })).toThrowError(/nome/i);
  });

  it('apenas o anfitrião inicia', () => {
    const state = createGame('ABCDE', { id: 'p0', name: 'Ana', avatar: 0 });
    for (let i = 1; i < 5; i++) addPlayer(state, { id: `p${i}`, name: `J${i}`, avatar: i });
    expect(() => startGame(state, 'p1', Math.random)).toThrowError(/anfitrião/);
  });

  it('migra o anfitrião ao remover o atual', () => {
    const state = createGame('ABCDE', { id: 'p0', name: 'Ana', avatar: 0 });
    addPlayer(state, { id: 'p1', name: 'Bia', avatar: 1 });
    removePlayer(state, 'p0');
    expect(state.players[0]!.isHost).toBe(true);
  });
});

describe('distribuição de papéis', () => {
  for (const count of [5, 6, 7, 8, 9, 10]) {
    it(`${count} jogadores → ${ECLIPSE_COUNT[count]} agentes do Eclipse`, () => {
      const state = makeGame(count);
      expect(eclipseIds(state)).toHaveLength(ECLIPSE_COUNT[count]!);
      expect(Object.keys(state.roles)).toHaveLength(count);
    });
  }

  it('distribuição varia com a semente', () => {
    const sets = new Set(
      Array.from({ length: 20 }, (_, seed) => eclipseIds(makeGame(7, seed)).join(',')),
    );
    expect(sets.size).toBeGreaterThan(1);
  });

  it('só avança para teamSelect após todos confirmarem o papel', () => {
    const state = createGame('ABCDE', { id: 'p0', name: 'Ana', avatar: 0 });
    for (let i = 1; i < 5; i++) addPlayer(state, { id: `p${i}`, name: `J${i}`, avatar: i });
    startGame(state, 'p0', seededRng(1));
    expect(state.phase).toBe('roleReveal');
    for (const p of state.players.slice(0, 4)) ackRole(state, p.id);
    expect(state.phase).toBe('roleReveal');
    ackRole(state, 'p4');
    expect(state.phase).toBe('teamSelect');
  });
});

describe('proposta e votação', () => {
  it('somente o comandante propõe, com o tamanho exato', () => {
    const state = makeGame(5);
    const lead = leaderId(state)!;
    const other = state.players.find((p) => p.id !== lead)!.id;
    expect(() => proposeTeam(state, other, ['p0', 'p1'])).toThrowError(/comandante/);
    expect(() => proposeTeam(state, lead, ['p0'])).toThrowError(/exatamente/);
    expect(() => proposeTeam(state, lead, ['p0', 'p0'])).toThrowError(/exatamente/);
    proposeTeam(state, lead, ['p0', 'p1']);
    expect(state.phase).toBe('voting');
  });

  it('maioria aprova; empate rejeita e passa o comando', () => {
    const state = makeGame(6);
    const lead = leaderId(state)!;
    const leadIndex = state.leaderIndex;
    proposeTeam(state, lead, ['p0', 'p1']);
    // 3 x 3: empate → rejeita
    state.players.forEach((p, i) => castVote(state, p.id, i < 3));
    expect(state.phase).toBe('teamSelect');
    expect(state.attempt).toBe(1);
    expect(state.leaderIndex).toBe((leadIndex + 1) % 6);
    expect(state.lastVote?.approved).toBe(false);
  });

  it('voto duplicado é rejeitado', () => {
    const state = makeGame(5);
    proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
    castVote(state, 'p0', true);
    expect(() => castVote(state, 'p0', false)).toThrowError(/já votou/);
  });

  it('5ª rejeição consecutiva → Colapso da Confiança (vitória do Eclipse)', () => {
    const state = makeGame(5);
    for (let i = 0; i < MAX_REJECTIONS; i++) {
      proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
      for (const p of state.players) castVote(state, p.id, false);
    }
    expect(state.phase).toBe('gameOver');
    expect(state.winner).toBe('eclipse');
    expect(state.winReason).toBe('colapso');
  });

  it('aprovação zera a contagem de rejeições apenas na próxima expedição', () => {
    const state = makeGame(5);
    proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
    for (const p of state.players) castVote(state, p.id, false);
    expect(state.attempt).toBe(1);
    runMission(state, 0);
    expect(state.round).toBe(1);
    expect(state.attempt).toBe(0);
  });
});

describe('expedições', () => {
  it('sentinela não pode sabotar', () => {
    const state = makeGame(5);
    const loyal = sentinelIds(state);
    approveTeam(state, loyal.slice(0, 2));
    expect(() => playCard(state, loyal[0]!, false)).toThrowError(/Sentinelas/);
  });

  it('quem está fora da patrulha não age; ação dupla é bloqueada', () => {
    const state = makeGame(5);
    approveTeam(state, ['p0', 'p1']);
    expect(() => playCard(state, 'p2', true)).toThrowError(/patrulha/);
    playCard(state, 'p0', true);
    expect(() => playCard(state, 'p0', true)).toThrowError(/já agiu/);
  });

  it('1 sabotagem falha a expedição', () => {
    const state = makeGame(5);
    runMission(state, 1);
    expect(state.missionResults[0]).toBe('falha');
    expect(state.lastMission?.failCount).toBe(1);
  });

  it('4ª expedição com 7+ jogadores exige 2 sabotagens', () => {
    const state = makeGame(7);
    runMission(state, 0); // sucesso
    runMission(state, 1); // falha
    runMission(state, 0); // sucesso
    expect(state.round).toBe(3);
    runMission(state, 1); // 1 sabotagem não basta na 4ª
    expect(state.missionResults[3]).toBe('sucesso');
    expect(state.lastMission?.failsRequired).toBe(2);
    expect(state.phase).toBe('gameOver'); // 3 sucessos
    expect(state.winner).toBe('sentinela');
  });

  it('4ª expedição com 5 jogadores mantém exigência de 1 sabotagem', () => {
    const state = makeGame(5);
    runMission(state, 0);
    runMission(state, 1);
    runMission(state, 0);
    runMission(state, 1);
    expect(state.missionResults[3]).toBe('falha');
  });

  it('3 falhas → vitória do Eclipse', () => {
    const state = makeGame(5);
    runMission(state, 1);
    runMission(state, 1);
    runMission(state, 1);
    expect(state.phase).toBe('gameOver');
    expect(state.winner).toBe('eclipse');
    expect(state.winReason).toBe('expedicoes');
  });

  it('comando gira após cada expedição concluída', () => {
    const state = makeGame(5);
    const before = state.leaderIndex;
    runMission(state, 0);
    expect(state.leaderIndex).toBe((before + 1) % 5);
  });

  it('histórico registra propostas, votos e resultados', () => {
    const state = makeGame(5);
    proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
    for (const p of state.players) castVote(state, p.id, false);
    runMission(state, 1);
    const round0 = state.history[0]!;
    expect(round0.attempts).toHaveLength(2);
    expect(round0.attempts[0]!.approved).toBe(false);
    expect(Object.keys(round0.attempts[0]!.votes)).toHaveLength(5);
    expect(round0.mission?.outcome).toBe('falha');
  });
});

describe('fim e reinício', () => {
  it('nova partida preserva jogadores, limpa segredos e gira o comandante', () => {
    const state = makeGame(5);
    runMission(state, 1);
    runMission(state, 1);
    runMission(state, 1);
    returnToLobby(state, 'p0');
    expect(state.phase).toBe('lobby');
    expect(state.players).toHaveLength(5);
    expect(state.roles).toEqual({});
    expect(state.history).toEqual([]);
    expect(state.gamesPlayed).toBe(1);
    startGame(state, 'p0', seededRng(7));
    expect(state.phase).toBe('roleReveal');
  });

  it('desconexão marca o jogador e migra o anfitrião fora do lobby', () => {
    const state = makeGame(5);
    setConnected(state, 'p0', false);
    migrateHost(state);
    expect(state.players.find((p) => p.id === 'p0')!.isHost).toBe(false);
    expect(state.players.some((p) => p.isHost && p.connected)).toBe(true);
  });
});
