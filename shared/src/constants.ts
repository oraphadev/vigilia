export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const ROUNDS = 5;
export const MISSIONS_TO_WIN = 3;
/** Propostas rejeitadas consecutivas que causam o Colapso da Confiança. */
export const MAX_REJECTIONS = 5;
export const MAX_NAME_LENGTH = 16;
export const AVATAR_COUNT = 10;

/** Nº de agentes do Eclipse por nº de jogadores. */
export const ECLIPSE_COUNT: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

/** Tamanho da patrulha por expedição (índice 0..4), por nº de jogadores. */
export const TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** A 4ª expedição (índice 3) exige 2 sabotagens quando há 7+ jogadores. */
export function failsRequired(playerCount: number, round: number): number {
  return round === 3 && playerCount >= 7 ? 2 : 1;
}

export function failsRequiredTable(playerCount: number): number[] {
  return Array.from({ length: ROUNDS }, (_, r) => failsRequired(playerCount, r));
}
