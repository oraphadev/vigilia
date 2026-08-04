import { ECLIPSE_COUNT, failsRequiredTable, TEAM_SIZES } from './constants.js';
import { leaderId } from './engine.js';
import type { GameState, MissionRecord, PlayerView, PublicPlayer, RoundHistory } from './types.js';

/** Fora de gameOver a autoria da sabotagem é apagada (clonando, nunca por referência). */
function redactMission(mission: MissionRecord, gameOver: boolean): MissionRecord {
  return gameOver ? { ...mission, saboteurs: [...mission.saboteurs] } : { ...mission, saboteurs: [] };
}

function redactHistory(history: RoundHistory[], gameOver: boolean): RoundHistory[] {
  return history.map((round) => ({
    round: round.round,
    attempts: round.attempts,
    ...(round.mission ? { mission: redactMission(round.mission, gameOver) } : {}),
  }));
}

/**
 * Produz a visão de UM jogador a partir do estado canônico.
 * Única porta de saída de dados do servidor: se não está aqui, não vaza.
 */
export function viewFor(state: GameState, playerId: string): PlayerView {
  const currentLeaderId = leaderId(state);
  const faction = state.roles[playerId] ?? null;
  const gameOver = state.phase === 'gameOver';

  const players: PublicPlayer[] = state.players.map((p) => ({
    ...p,
    isLeader: p.id === currentLeaderId,
    onTeam: state.proposedTeam.includes(p.id),
    hasVoted: p.id in state.votes,
    hasPlayedCard: p.id in state.missionCards,
    hasAckedRole: state.roleAcks.includes(p.id),
  }));

  const me = state.players.find((p) => p.id === playerId);

  return {
    code: state.code,
    phase: state.phase,
    players,
    you: {
      id: playerId,
      faction,
      conspirators:
        faction === 'eclipse'
          ? Object.entries(state.roles)
              .filter(([id, role]) => role === 'eclipse' && id !== playerId)
              .map(([id]) => id)
          : null,
      isHost: me?.isHost ?? false,
      isLeader: playerId === currentLeaderId,
      onTeam: state.proposedTeam.includes(playerId),
      hasVoted: playerId in state.votes,
      hasPlayedCard: playerId in state.missionCards,
    },
    round: state.round,
    attempt: state.attempt,
    leaderId: currentLeaderId,
    missionResults: [...state.missionResults],
    teamSizes: TEAM_SIZES[state.players.length] ?? [],
    failsRequired: failsRequiredTable(state.players.length),
    eclipseCount: ECLIPSE_COUNT[state.players.length] ?? 0,
    proposedTeam: [...state.proposedTeam],
    draftTeam: [...state.draftTeam],
    votesCast: Object.keys(state.votes).length,
    cardsPlayed: Object.keys(state.missionCards).length,
    lastVote: state.lastVote,
    lastMission: state.lastMission ? redactMission(state.lastMission, gameOver) : null,
    history: redactHistory(state.history, gameOver),
    winner: state.winner,
    winReason: state.winReason,
    rolesRevealed: gameOver && Object.keys(state.roles).length > 0 ? { ...state.roles } : null,
    gamesPlayed: state.gamesPlayed,
    tally: { ...state.tally },
  };
}
