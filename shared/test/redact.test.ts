import { describe, expect, it } from 'vitest';
import {
  ackRole,
  addPlayer,
  castVote,
  createGame,
  type GameState,
  leaderId,
  playCard,
  proposeTeam,
  startGame,
  viewFor,
} from '../src/index.js';

import { seededRng } from './rng.js';

function makeGame(): GameState {
  const state = createGame('ABCDE', { id: 'p0', name: 'Jogador 0', avatar: 0 });
  for (let i = 1; i < 5; i++) addPlayer(state, { id: `p${i}`, name: `Jogador ${i}`, avatar: i });
  startGame(state, 'p0', seededRng(3));
  for (const p of state.players) ackRole(state, p.id);
  return state;
}

function eclipseIds(state: GameState): string[] {
  return Object.entries(state.roles)
    .filter(([, f]) => f === 'eclipse')
    .map(([id]) => id);
}

describe('redação anti-cheat', () => {
  it('sentinela vê o próprio papel e nenhum outro', () => {
    const state = makeGame();
    const loyal = state.players.find((p) => state.roles[p.id] === 'sentinela')!;
    const view = viewFor(state, loyal.id);
    expect(view.you.faction).toBe('sentinela');
    expect(view.you.conspirators).toBeNull();
    expect(view.rolesRevealed).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"roles"');
  });

  it('eclipse enxerga apenas os comparsas', () => {
    const state = makeGame();
    const [first, ...rest] = eclipseIds(state);
    const view = viewFor(state, first!);
    expect(view.you.faction).toBe('eclipse');
    expect(view.you.conspirators).toEqual(rest);
  });

  it('votos individuais não vazam durante a votação, apenas a contagem', () => {
    const state = makeGame();
    proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
    castVote(state, 'p0', true);
    castVote(state, 'p1', false);
    const view = viewFor(state, 'p2');
    expect(view.votesCast).toBe(2);
    expect(view.lastVote).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/"votes":\{"p/);
    expect(view.players.find((p) => p.id === 'p0')!.hasVoted).toBe(true);
  });

  it('votos ficam públicos após a revelação', () => {
    const state = makeGame();
    proposeTeam(state, leaderId(state)!, ['p0', 'p1']);
    for (const p of state.players) castVote(state, p.id, true);
    const view = viewFor(state, 'p3');
    expect(view.lastVote?.approved).toBe(true);
    expect(Object.keys(view.lastVote!.votes)).toHaveLength(5);
  });

  it('cartas de expedição nunca são atribuíveis a um jogador', () => {
    const state = makeGame();
    const saboteur = eclipseIds(state)[0]!;
    const loyal = state.players.find((p) => state.roles[p.id] === 'sentinela')!.id;
    proposeTeam(state, leaderId(state)!, [saboteur, loyal]);
    for (const p of state.players) castVote(state, p.id, true);
    playCard(state, saboteur, false);
    let view = viewFor(state, loyal);
    expect(view.cardsPlayed).toBe(1);
    expect(JSON.stringify(view)).not.toContain('missionCards');
    playCard(state, loyal, true);
    view = viewFor(state, loyal);
    // resultado agregado: 1 falha, sem autoria
    expect(view.lastMission?.failCount).toBe(1);
    expect(JSON.stringify(view.lastMission)).not.toContain(saboteur === 'p0' ? '"p0":' : `"${saboteur}":`);
  });

  it('papéis são revelados a todos apenas no fim de jogo', () => {
    const state = makeGame();
    state.winner = 'eclipse';
    state.winReason = 'colapso';
    state.phase = 'gameOver';
    const view = viewFor(state, 'p2');
    expect(view.rolesRevealed).not.toBeNull();
    expect(Object.keys(view.rolesRevealed!)).toHaveLength(5);
  });
});
