import {
  ECLIPSE_COUNT,
  failsRequired,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_REJECTIONS,
  MIN_PLAYERS,
  MISSIONS_TO_WIN,
  ROUNDS,
  TEAM_SIZES,
} from './constants.js';
import {
  type Faction,
  GameError,
  type GameState,
  type MissionRecord,
  type PlayerState,
  type Rng,
  type VoteRecord,
} from './types.js';

/**
 * Motor de regras puro. Cada função valida a ação contra o estado canônico e
 * o MUTA (o servidor é o único dono do objeto). Nenhum I/O, RNG injetável.
 */

function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) {
    throw new GameError('WRONG_PHASE', `Ação inválida na fase ${state.phase}.`);
  }
}

function requirePlayer(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new GameError('PLAYER_NOT_FOUND', 'Jogador não está na sala.');
  return player;
}

function requireHost(state: GameState, playerId: string): void {
  if (!requirePlayer(state, playerId).isHost) {
    throw new GameError('NOT_HOST', 'Apenas o anfitrião pode fazer isso.');
  }
}

export function leaderId(state: GameState): string | null {
  if (state.phase === 'lobby' || state.phase === 'gameOver') return null;
  return state.players[state.leaderIndex % state.players.length]?.id ?? null;
}

export function sanitizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  if (name.length < 2) throw new GameError('INVALID_NAME', 'Nome precisa de ao menos 2 caracteres.');
  return name;
}

export function createGame(code: string, host: Omit<PlayerState, 'connected' | 'isHost'>): GameState {
  return {
    code,
    phase: 'lobby',
    players: [{ ...host, name: sanitizeName(host.name), connected: true, isHost: true }],
    roles: {},
    leaderIndex: 0,
    round: 0,
    attempt: 0,
    missionResults: Array(ROUNDS).fill(null),
    roleAcks: [],
    proposedTeam: [],
    votes: {},
    missionCards: {},
    lastVote: null,
    lastMission: null,
    history: [],
    winner: null,
    winReason: null,
    gamesPlayed: 0,
  };
}

export function addPlayer(state: GameState, player: Omit<PlayerState, 'connected' | 'isHost'>): void {
  requirePhase(state, 'lobby');
  if (state.players.length >= MAX_PLAYERS) {
    throw new GameError('ROOM_FULL', `A sala comporta no máximo ${MAX_PLAYERS} vigilantes.`);
  }
  const name = sanitizeName(player.name);
  if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError('NAME_TAKEN', 'Já existe um vigilante com esse nome na sala.');
  }
  state.players.push({ ...player, name, connected: true, isHost: false });
}

/** Remove um jogador (saída voluntária ou expulsão pelo anfitrião — apenas no lobby). */
export function removePlayer(state: GameState, playerId: string): void {
  requirePhase(state, 'lobby', 'gameOver');
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) throw new GameError('PLAYER_NOT_FOUND', 'Jogador não está na sala.');
  const [removed] = state.players.splice(index, 1);
  if (removed!.isHost && state.players.length > 0) {
    const heir = state.players.find((p) => p.connected) ?? state.players[0]!;
    heir.isHost = true;
  }
}

export function setConnected(state: GameState, playerId: string, connected: boolean): void {
  const player = state.players.find((p) => p.id === playerId);
  if (player) player.connected = connected;
}

/** Migra o papel de anfitrião quando o atual se desconecta fora do lobby. */
export function migrateHost(state: GameState): void {
  const host = state.players.find((p) => p.isHost);
  if (host?.connected) return;
  const heir = state.players.find((p) => p.connected && !p.isHost);
  if (!heir) return;
  if (host) host.isHost = false;
  heir.isHost = true;
}

export function startGame(state: GameState, hostId: string, rng: Rng): void {
  requirePhase(state, 'lobby');
  requireHost(state, hostId);
  if (state.players.length < MIN_PLAYERS) {
    throw new GameError('NOT_ENOUGH_PLAYERS', `São necessários ao menos ${MIN_PLAYERS} vigilantes.`);
  }

  const eclipseCount = ECLIPSE_COUNT[state.players.length]!;
  const factions: Faction[] = shuffle(
    state.players.map((_, i) => (i < eclipseCount ? 'eclipse' : 'sentinela')),
    rng,
  );
  state.roles = Object.fromEntries(state.players.map((p, i) => [p.id, factions[i]!]));

  // O comandante inicial gira a cada partida da sala para variar a abertura.
  state.leaderIndex = (state.gamesPlayed + Math.floor(rng() * state.players.length)) % state.players.length;
  state.phase = 'roleReveal';
  state.round = 0;
  state.attempt = 0;
  state.missionResults = Array(ROUNDS).fill(null);
  state.roleAcks = [];
  state.proposedTeam = [];
  state.votes = {};
  state.missionCards = {};
  state.lastVote = null;
  state.lastMission = null;
  state.history = [{ round: 0, attempts: [] }];
  state.winner = null;
  state.winReason = null;
}

export function ackRole(state: GameState, playerId: string): void {
  requirePhase(state, 'roleReveal');
  requirePlayer(state, playerId);
  if (!state.roleAcks.includes(playerId)) state.roleAcks.push(playerId);
  if (state.roleAcks.length === state.players.length) {
    state.phase = 'teamSelect';
  }
}

export function proposeTeam(state: GameState, playerId: string, team: string[]): void {
  requirePhase(state, 'teamSelect');
  if (playerId !== leaderId(state)) {
    throw new GameError('NOT_LEADER', 'Apenas o comandante escolhe a patrulha.');
  }
  const expectedSize = TEAM_SIZES[state.players.length]![state.round]!;
  const unique = new Set(team);
  if (
    team.length !== expectedSize ||
    unique.size !== expectedSize ||
    !team.every((id) => state.players.some((p) => p.id === id))
  ) {
    throw new GameError('INVALID_TEAM', `A patrulha desta expedição leva exatamente ${expectedSize} vigilantes.`);
  }
  state.proposedTeam = [...team];
  state.votes = {};
  state.phase = 'voting';
}

export function castVote(state: GameState, playerId: string, approve: boolean): void {
  requirePhase(state, 'voting');
  requirePlayer(state, playerId);
  if (playerId in state.votes) throw new GameError('ALREADY_ACTED', 'Você já votou nesta proposta.');
  state.votes[playerId] = approve;
  if (Object.keys(state.votes).length === state.players.length) {
    resolveVote(state);
  }
}

function resolveVote(state: GameState): void {
  const approvals = Object.values(state.votes).filter(Boolean).length;
  const approved = approvals > state.players.length / 2; // empate rejeita
  const record: VoteRecord = {
    round: state.round,
    attempt: state.attempt,
    leaderId: leaderId(state)!,
    team: [...state.proposedTeam],
    votes: { ...state.votes },
    approved,
  };
  state.history[state.history.length - 1]!.attempts.push(record);
  state.lastVote = record;
  state.lastMission = null;
  state.votes = {};

  if (approved) {
    state.missionCards = {};
    state.phase = 'mission';
    return;
  }

  state.attempt += 1;
  if (state.attempt >= MAX_REJECTIONS) {
    // Colapso da Confiança: a cidade paralisada é vitória do Eclipse.
    endGame(state, 'eclipse', 'colapso');
    return;
  }
  state.leaderIndex = (state.leaderIndex + 1) % state.players.length;
  state.proposedTeam = [];
  state.phase = 'teamSelect';
}

export function playCard(state: GameState, playerId: string, light: boolean): void {
  requirePhase(state, 'mission');
  requirePlayer(state, playerId);
  if (!state.proposedTeam.includes(playerId)) {
    throw new GameError('NOT_ON_TEAM', 'Você não faz parte desta patrulha.');
  }
  if (playerId in state.missionCards) {
    throw new GameError('ALREADY_ACTED', 'Você já agiu nesta expedição.');
  }
  if (!light && state.roles[playerId] !== 'eclipse') {
    // Sentinelas são leais por definição: jamais podem sabotar.
    throw new GameError('FORBIDDEN_CARD', 'Sentinelas só podem acender o farol.');
  }
  state.missionCards[playerId] = light;
  if (Object.keys(state.missionCards).length === state.proposedTeam.length) {
    resolveMission(state);
  }
}

function resolveMission(state: GameState): void {
  const failCount = Object.values(state.missionCards).filter((light) => !light).length;
  const required = failsRequired(state.players.length, state.round);
  const outcome = failCount >= required ? 'falha' : 'sucesso';
  const record: MissionRecord = {
    round: state.round,
    team: [...state.proposedTeam],
    failCount,
    failsRequired: required,
    outcome,
  };
  state.missionResults[state.round] = outcome;
  state.history[state.history.length - 1]!.mission = record;
  state.lastMission = record;
  state.missionCards = {};
  state.proposedTeam = [];

  const successes = state.missionResults.filter((r) => r === 'sucesso').length;
  const failures = state.missionResults.filter((r) => r === 'falha').length;
  if (successes >= MISSIONS_TO_WIN) return endGame(state, 'sentinela', 'expedicoes');
  if (failures >= MISSIONS_TO_WIN) return endGame(state, 'eclipse', 'expedicoes');

  state.round += 1;
  state.attempt = 0;
  state.leaderIndex = (state.leaderIndex + 1) % state.players.length;
  state.history.push({ round: state.round, attempts: [] });
  state.phase = 'teamSelect';
}

function endGame(state: GameState, winner: Faction, reason: GameState['winReason'] & string): void {
  state.winner = winner;
  state.winReason = reason;
  state.phase = 'gameOver';
  state.proposedTeam = [];
  state.votes = {};
  state.missionCards = {};
}

/** Volta a sala ao lobby preservando os jogadores, pronta para nova partida. */
export function returnToLobby(state: GameState, hostId: string): void {
  requirePhase(state, 'gameOver');
  requireHost(state, hostId);
  state.gamesPlayed += 1;
  state.phase = 'lobby';
  state.roles = {};
  state.round = 0;
  state.attempt = 0;
  state.missionResults = Array(ROUNDS).fill(null);
  state.roleAcks = [];
  state.proposedTeam = [];
  state.votes = {};
  state.missionCards = {};
  state.lastVote = null;
  state.lastMission = null;
  state.history = [];
  state.winner = null;
  state.winReason = null;
}
