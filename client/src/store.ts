import { create } from 'zustand';
import type { PlayerView } from '@vigilia/shared';
import { request, ServerRejection, socket } from './socket.js';

const TOKEN_KEY = 'vigilia.token';
const NAME_KEY = 'vigilia.name';
const AVATAR_KEY = 'vigilia.avatar';
const TUTORIAL_KEY = 'vigilia.tutorialSeen';

/** Em qual "tela raiz" o app está. Dentro de `room`, a fase vem do servidor. */
export type Stage = 'boot' | 'home' | 'room';

export interface Toast {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

interface AppState {
  stage: Stage;
  view: PlayerView | null;
  /** Conectado outrora e caiu — mostra banner de reconexão. */
  reconnecting: boolean;
  busy: boolean;
  toasts: Toast[];
  name: string;
  avatar: number;
  tutorialSeen: boolean;

  setName: (name: string) => void;
  setAvatar: (avatar: number) => void;
  markTutorialSeen: () => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;

  boot: () => void;
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  /** Ação genérica de jogo com tratamento de erro/toast. */
  act: (event: string, payload?: unknown) => Promise<boolean>;
}

let toastSeq = 0;

export const useStore = create<AppState>((set, get) => ({
  stage: 'boot',
  view: null,
  reconnecting: false,
  busy: false,
  toasts: [],
  name: localStorage.getItem(NAME_KEY) ?? '',
  avatar: Number(localStorage.getItem(AVATAR_KEY) ?? 0),
  tutorialSeen: localStorage.getItem(TUTORIAL_KEY) === '1',

  setName: (name) => {
    localStorage.setItem(NAME_KEY, name);
    set({ name });
  },

  setAvatar: (avatar) => {
    localStorage.setItem(AVATAR_KEY, String(avatar));
    set({ avatar });
  },

  markTutorialSeen: () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    set({ tutorialSeen: true });
  },

  toast: (text, kind = 'error') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  boot: () => {
    // StrictMode monta efeitos duas vezes em dev — registra listeners uma única vez.
    if (socket.hasListeners('state')) return;
    socket.on('state', (view) => set({ view }));

    socket.on('kicked', () => {
      localStorage.removeItem(TOKEN_KEY);
      set({ stage: 'home', view: null });
      get().toast('Você foi removido da sala pelo anfitrião.', 'info');
    });

    socket.on('disconnect', () => {
      if (get().stage === 'room') set({ reconnecting: true });
    });

    socket.on('connect', async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const { stage } = get();
      if (token && (stage === 'boot' || get().reconnecting)) {
        try {
          const { view } = await request<{ view: PlayerView }>('room:resume', { token });
          set({ stage: 'room', view, reconnecting: false });
          return;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
      set((s) => ({
        reconnecting: false,
        stage: s.stage === 'boot' ? 'home' : s.stage,
      }));
    });

    socket.connect();
    // Sem token não há o que retomar: vai direto para a home.
    if (!localStorage.getItem(TOKEN_KEY)) set({ stage: 'home' });
  },

  createRoom: async () => {
    const { name, avatar } = get();
    await withBusy(set, get, async () => {
      const data = await request<{ token: string; view: PlayerView }>('room:create', {
        name,
        avatar,
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      set({ stage: 'room', view: data.view });
    });
  },

  joinRoom: async (code) => {
    const { name, avatar } = get();
    await withBusy(set, get, async () => {
      const data = await request<{ token: string; view: PlayerView }>('room:join', {
        code: code.toUpperCase(),
        name,
        avatar,
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      set({ stage: 'room', view: data.view });
    });
  },

  leaveRoom: () => {
    socket.emit('room:leave');
    localStorage.removeItem(TOKEN_KEY);
    set({ stage: 'home', view: null });
  },

  act: async (event, payload) => {
    try {
      if (payload === undefined) await request(event);
      else await request(event, payload);
      return true;
    } catch (error) {
      get().toast(messageOf(error));
      return false;
    }
  },
}));

async function withBusy(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  fn: () => Promise<void>,
): Promise<void> {
  set({ busy: true });
  try {
    await fn();
  } catch (error) {
    get().toast(messageOf(error));
  } finally {
    set({ busy: false });
  }
}

function messageOf(error: unknown): string {
  if (error instanceof ServerRejection) return error.message;
  return 'Sem resposta do farol central. Verifique sua conexão.';
}
