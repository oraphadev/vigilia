/** Facções do universo de VIGÍLIA. */
export type Faction = 'sentinela' | 'eclipse';

export type Phase =
  | 'lobby'
  | 'roleReveal'
  | 'teamSelect'
  | 'voting'
  | 'mission'
  | 'gameOver';

export type WinReason = 'expedicoes' | 'colapso';

export type MissionOutcome = 'sucesso' | 'falha';

export interface PlayerState {
  id: string;
  name: string;
  /** Índice do retrato/emblema escolhido no lobby. */
  avatar: number;
  connected: boolean;
  isHost: boolean;
}

/** Uma proposta de patrulha levada a voto (registro público após a revelação). */
export interface VoteRecord {
  round: number;
  attempt: number;
  leaderId: string;
  team: string[];
  /** Voto público de cada jogador (true = aprovar). */
  votes: Record<string, boolean>;
  approved: boolean;
}

/** Resultado público de uma expedição concluída. */
export interface MissionRecord {
  round: number;
  team: string[];
  failCount: number;
  failsRequired: number;
  outcome: MissionOutcome;
  /** Segredo até o fim da partida: quem jogou Apagar. Vazio fora de gameOver. */
  saboteurs: string[];
}

export interface RoundHistory {
  round: number;
  attempts: VoteRecord[];
  mission?: MissionRecord;
}

/** Estado canônico completo — vive apenas no servidor. */
export interface GameState {
  code: string;
  phase: Phase;
  players: PlayerState[];
  /** Segredo: facção de cada jogador. */
  roles: Record<string, Faction>;
  leaderIndex: number;
  /** Expedição atual, 0..4. */
  round: number;
  /** Propostas rejeitadas nesta expedição, 0..4. A 5ª rejeição é o Colapso. */
  attempt: number;
  missionResults: (MissionOutcome | null)[];
  /** Jogadores que já confirmaram a visualização do próprio papel. */
  roleAcks: string[];
  proposedTeam: string[];
  /** Rascunho público da patrulha, editado ao vivo pelo comandante em teamSelect. */
  draftTeam: string[];
  /** Segredo até todos votarem. */
  votes: Record<string, boolean>;
  /** Segredo para sempre (revelado apenas agregado): true = Acender. */
  missionCards: Record<string, boolean>;
  /** Última votação resolvida — o cliente anima a revelação a partir daqui. */
  lastVote: VoteRecord | null;
  /** Última expedição resolvida — idem. */
  lastMission: MissionRecord | null;
  history: RoundHistory[];
  winner: Faction | null;
  winReason: WinReason | null;
  /** Quantas partidas já foram jogadas nesta sala (gira o comandante inicial). */
  gamesPlayed: number;
  /** Placar acumulado da noite — sobrevive a novas partidas na mesma sala. */
  tally: { sentinela: number; eclipse: number };
}

/** Visão pública de um jogador (sem papel). */
export interface PublicPlayer extends PlayerState {
  isLeader: boolean;
  onTeam: boolean;
  hasVoted: boolean;
  hasPlayedCard: boolean;
  hasAckedRole: boolean;
}

/**
 * Visão redigida enviada a UM jogador. Nunca contém segredos de terceiros:
 * papéis alheios só para agentes Eclipse, votos só após revelação,
 * cartas de expedição apenas agregadas.
 */
export interface PlayerView {
  code: string;
  phase: Phase;
  players: PublicPlayer[];
  you: {
    id: string;
    faction: Faction | null;
    /** Ids dos demais agentes Eclipse — presente apenas se você for Eclipse. */
    conspirators: string[] | null;
    isHost: boolean;
    isLeader: boolean;
    onTeam: boolean;
    hasVoted: boolean;
    hasPlayedCard: boolean;
  };
  round: number;
  attempt: number;
  leaderId: string | null;
  missionResults: (MissionOutcome | null)[];
  teamSizes: number[];
  /** Nº de sabotagens exigidas por expedição (quase sempre 1). */
  failsRequired: number[];
  eclipseCount: number;
  proposedTeam: string[];
  draftTeam: string[];
  votesCast: number;
  cardsPlayed: number;
  lastVote: VoteRecord | null;
  lastMission: MissionRecord | null;
  history: RoundHistory[];
  winner: Faction | null;
  winReason: WinReason | null;
  /** Revelação final: todos os papéis, apenas em gameOver. */
  rolesRevealed: Record<string, Faction> | null;
  gamesPlayed: number;
  tally: { sentinela: number; eclipse: number };
}

export type GameErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_HOST'
  | 'NOT_LEADER'
  | 'NOT_ON_TEAM'
  | 'WRONG_PHASE'
  | 'INVALID_TEAM'
  | 'ALREADY_ACTED'
  | 'FORBIDDEN_CARD'
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'PLAYER_NOT_FOUND';

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/** Fonte de aleatoriedade injetável — determinística nos testes. */
export type Rng = () => number;
