import type { GameErrorCode, PlayerView } from './types.js';

/** Contrato Socket.IO: cliente → servidor. */
export interface ClientToServerEvents {
  'room:create': (
    payload: { name: string; avatar: number },
    ack: (reply: Reply<{ token: string; view: PlayerView }>) => void,
  ) => void;
  'room:join': (
    payload: { code: string; name: string; avatar: number },
    ack: (reply: Reply<{ token: string; view: PlayerView }>) => void,
  ) => void;
  'room:resume': (
    payload: { token: string },
    ack: (reply: Reply<{ view: PlayerView }>) => void,
  ) => void;
  'room:leave': () => void;
  'room:kick': (payload: { playerId: string }, ack: (reply: Reply) => void) => void;
  'game:start': (ack: (reply: Reply) => void) => void;
  'game:ackRole': (ack: (reply: Reply) => void) => void;
  'game:draft': (payload: { team: string[] }, ack: (reply: Reply) => void) => void;
  'game:propose': (payload: { team: string[] }, ack: (reply: Reply) => void) => void;
  'game:vote': (payload: { approve: boolean }, ack: (reply: Reply) => void) => void;
  'game:card': (payload: { light: boolean }, ack: (reply: Reply) => void) => void;
  'game:playAgain': (ack: (reply: Reply) => void) => void;
  'game:abort': (ack: (reply: Reply) => void) => void;
}

/** Contrato Socket.IO: servidor → cliente. */
export interface ServerToClientEvents {
  state: (view: PlayerView) => void;
  kicked: () => void;
  /** Outra aba assumiu esta sessão; este socket vai cair; não reconecte. */
  displaced: () => void;
}

export type Reply<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; code: GameErrorCode | 'INTERNAL'; message: string };
