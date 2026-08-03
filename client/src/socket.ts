import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@vigilia/shared';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
});

export class ServerRejection extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Emite com ack tipado; rejeita com ServerRejection quando o servidor recusa. */
export async function request<T = undefined>(
  event: string,
  ...args: unknown[]
): Promise<T> {
  const reply = (await (socket as Socket).timeout(8000).emitWithAck(event, ...args)) as
    | { ok: true; data: T }
    | { ok: false; code: string; message: string };
  if (!reply.ok) throw new ServerRejection(reply.code, reply.message);
  return reply.data;
}
