import { create } from 'zustand';
import type { PlayerView } from '@vigilia/shared';
import { request, ServerRejection, socket } from './socket.js';

const TOKEN_KEY = 'vigilia.token';
const NAME_KEY = 'vigilia.name';
const AVATAR_KEY = 'vigilia.avatar';
const TUTORIAL_KEY = 'vigilia.tutorialSeen';

const IDLE_TITLE = 'VIGÍLIA — Mantenha as luzes acesas';
const ALERT_TITLE = '● Sua vez — VIGÍLIA';

/** Espera antes de reoferecer a retomada quando a rede engasgou. */
const RESUME_RETRY_MS = 1500;

/**
 * Eventos de sincronização contínua (não são "commits"): ficam fora da trava
 * anti duplo-toque, senão o rascunho da patrulha some quando o líder é rápido.
 */
const UNLOCKED_EVENTS = new Set(['game:draft']);

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
  /** Conectado outrora e caiu — mostra overlay bloqueante de reconexão. */
  reconnecting: boolean;
  /** Esta sessão foi assumida por outra aba — nada de reconectar sozinho. */
  displaced: boolean;
  busy: boolean;
  /** Nome do evento em voo por `act` — null quando não há nada pendente. */
  pending: string | null;
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
  /** Traz o jogo de volta para ESTA aba (desloca a outra). */
  resumeHere: () => void;
  /** Ação genérica de jogo com tratamento de erro/toast. */
  act: (event: string, payload?: unknown) => Promise<boolean>;
}

let toastSeq = 0;
/** Estado anterior de "precisa agir" — vive fora do store para não causar render. */
let attentionOn = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((set, get) => ({
  stage: 'boot',
  view: null,
  reconnecting: false,
  displaced: false,
  busy: false,
  pending: null,
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

    /** Tenta retomar a sessão guardada. Só descarta o token se o servidor negar. */
    const attemptResume = async (): Promise<boolean> => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return false;
      try {
        const { view } = await request<{ view: PlayerView }>('room:resume', { token });
        set({ stage: 'room', view, reconnecting: false });
        syncAttention(view);
        return true;
      } catch (error) {
        if (error instanceof ServerRejection) {
          // O servidor respondeu: a sessão não existe mais. Aí sim o token é lixo.
          if (error.code === 'ROOM_NOT_FOUND') localStorage.removeItem(TOKEN_KEY);
          return false;
        }
        // Rede/timeout: o jogador PODE continuar na partida — segura o token e insiste.
        set({ reconnecting: true });
        scheduleResume();
        return true;
      }
    };

    /** Reagenda a retomada: pelo socket vivo, ou provocando um novo 'connect'. */
    const scheduleResume = (): void => {
      if (resumeTimer) return;
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        if (get().displaced) return;
        if (socket.connected) void attemptResume();
        else socket.connect(); // socket.io também reconecta sozinho; isto só apressa
      }, RESUME_RETRY_MS);
    };

    socket.on('state', (view) => {
      set({ view });
      syncAttention(view);
    });

    socket.on('kicked', () => {
      localStorage.removeItem(TOKEN_KEY);
      set({ stage: 'home', view: null, reconnecting: false });
      syncAttention(null);
      get().toast('Você foi removido da sala pelo anfitrião.', 'info');
    });

    socket.on('displaced', () => {
      // Outra aba assumiu. Parar a auto-retomada evita as duas abas se expulsando em loop.
      clearResumeTimer();
      // A flag vem antes: `disconnect()` dispara o handler de queda na hora.
      set({ displaced: true, reconnecting: false });
      socket.disconnect();
      syncAttention(null);
    });

    socket.on('disconnect', () => {
      if (get().displaced) return;
      if (get().stage === 'room') set({ reconnecting: true });
    });

    socket.on('connect', async () => {
      clearResumeTimer();
      const token = localStorage.getItem(TOKEN_KEY);
      const { stage, reconnecting } = get();
      if (token && (stage === 'boot' || reconnecting)) {
        // `attemptResume` devolve true tanto ao retomar quanto ao reagendar:
        // em ambos os casos não se deve cair para a home.
        if (await attemptResume()) return;
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
      syncAttention(data.view);
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
      syncAttention(data.view);
    });
  },

  leaveRoom: () => {
    clearResumeTimer();
    socket.emit('room:leave');
    localStorage.removeItem(TOKEN_KEY);
    set({ stage: 'home', view: null, reconnecting: false });
    syncAttention(null);
  },

  resumeHere: () => {
    // `reconnecting: true` faz o handler de 'connect' disparar a retomada,
    // que por sua vez desloca a outra aba.
    set({ displaced: false, reconnecting: true });
    socket.connect();
  },

  act: async (event, payload) => {
    const tracked = !UNLOCKED_EVENTS.has(event);
    // Anti duplo-toque global: uma ação de jogo por vez.
    if (tracked && get().pending) return false;
    if (tracked) set({ pending: event });
    try {
      if (payload === undefined) await request(event);
      else await request(event, payload);
      return true;
    } catch (error) {
      get().toast(messageOf(error));
      return false;
    } finally {
      if (tracked) set({ pending: null });
    }
  },
}));

function clearResumeTimer(): void {
  if (resumeTimer === null) return;
  clearTimeout(resumeTimer);
  resumeTimer = null;
}

/** A bola está com você? (ack do papel, liderança, voto, carta de expedição) */
function needsAction(view: PlayerView | null): boolean {
  if (!view) return false;
  const you = view.you;
  switch (view.phase) {
    case 'roleReveal':
      return !(view.players.find((p) => p.id === you.id)?.hasAckedRole ?? false);
    case 'teamSelect':
      return you.isLeader;
    case 'voting':
      return !you.hasVoted;
    case 'mission':
      return you.onTeam && !you.hasPlayedCard;
    default:
      return false;
  }
}

/** Só reage às TRANSIÇÕES: vibra e marca o título ao virar "sua vez"; restaura ao sair. */
function syncAttention(view: PlayerView | null): void {
  const next = needsAction(view);
  if (next === attentionOn) return;
  attentionOn = next;
  if (next) {
    navigator.vibrate?.(40);
    document.title = ALERT_TITLE;
  } else {
    document.title = IDLE_TITLE;
  }
}

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
