import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Faction, MissionOutcome, Phase, PublicPlayer } from '@vigilia/shared';
import { useStore } from '../store.js';
import { useFocusTrap } from './useFocusTrap.js';

/** Emblemas dos vigilantes: glifos abstratos, um por avatar. */
export const AVATAR_GLYPHS = ['✶', '☾', '✦', '❋', '◆', '✹', '❂', '✧', '✺', '✪'] as const;

export function glyphFor(avatar: number): string {
  return AVATAR_GLYPHS[avatar % AVATAR_GLYPHS.length]!;
}

/** Fora da tela, mas dentro da árvore de acessibilidade. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

const PHASE_ANNOUNCEMENTS: Record<Phase, string> = {
  lobby: 'Sala de espera',
  roleReveal: 'Revelação de papel',
  teamSelect: 'Formação de patrulha',
  voting: 'Votação aberta',
  mission: 'Expedição em andamento',
  gameOver: 'Fim de partida',
};

/** Cenário de fundo comum: céu estrelado + névoa viva. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="mist" aria-hidden />
      <PhaseAnnouncer />
      <div className="column">{children}</div>
      <Toasts />
      <ReconnectOverlay />
    </div>
  );
}

/**
 * A troca de fase é puramente visual; quem usa leitor de tela não a percebe.
 * Anuncia só na MUDANÇA: o texto é escrito num efeito, então a live region
 * já está montada quando muda (região montada junto com o texto não é lida).
 */
function PhaseAnnouncer() {
  const phase = useStore((s) => s.view?.phase);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setAnnouncement(phase ? PHASE_ANNOUNCEMENTS[phase] : '');
  }, [phase]);

  return (
    <div aria-live="polite" style={VISUALLY_HIDDEN}>
      {announcement}
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.kind}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Sem conexão, a tela por baixo está defasada; tocar nela só gera ações que
 * o servidor vai recusar. O overlay bloqueia em vez de avisar de canto.
 */
function ReconnectOverlay() {
  const reconnecting = useStore((s) => s.reconnecting);
  // Bloqueia também o teclado: sem isto dá para tabular na tela defasada por baixo.
  const ref = useFocusTrap(reconnecting);
  if (!reconnecting) return null;
  return (
    <div
      ref={ref}
      className="overlay overlay-blocking"
      role="alertdialog"
      aria-modal
      aria-label="Reconectando"
    >
      <div className="stack center">
        <span className="spinner" style={{ width: 28, height: 28, alignSelf: 'center' }} aria-hidden />
        <p style={{ fontWeight: 600 }}>Reacendendo a conexão…</p>
        <p className="muted" style={{ fontSize: 14 }}>
          Suas ações continuam valendo. Só um instante.
        </p>
      </div>
    </div>
  );
}

export function FlameMark() {
  return (
    <svg className="flame-mark" viewBox="0 0 32 32" aria-hidden>
      <path
        d="M16 3c4.2 5.4 7 9 7 13.8A7 7 0 1 1 9 16.8C9 12 11.8 8.4 16 3z"
        fill="url(#flame-grad)"
      />
      <defs>
        <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#f0a93c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Medallion({
  player,
  badge,
  selected,
  conspirator,
  onClick,
  disabled,
}: {
  player: PublicPlayer;
  badge?: ReactNode;
  selected?: boolean;
  conspirator?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const classes = [
    'medallion',
    player.connected ? '' : 'is-off',
    selected ? 'is-selected' : '',
    conspirator ? 'is-conspirator' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Anel colorido sozinho não comunica nada a quem não distingue as cores:
  // seleção e conspiração ganham um glifo quando não há badge por props.
  const shownBadge =
    badge ??
    (selected ? (
      <span className="medallion-badge badge-leader" title="Selecionado">
        ✓
      </span>
    ) : conspirator ? (
      <span className="medallion-badge badge-done" title="Agente do Eclipse" style={{ fontSize: 10 }}>
        🌑
      </span>
    ) : undefined);

  const content = (
    <>
      <span className="medallion-disc">
        {glyphFor(player.avatar)}
        {shownBadge}
      </span>
      <span className="medallion-name">{player.name}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

/** A trilha-assinatura: cinco faróis de Lumen. */
export function Beacons({
  results,
  teamSizes,
  failsRequired,
  currentRound,
  matchPoint,
}: {
  results: (MissionOutcome | null)[];
  teamSizes: number[];
  failsRequired: number[];
  currentRound: number;
  /** Facção a um passo da vitória; anunciada em texto, sem mexer no placar. */
  matchPoint?: Faction | null;
}) {
  const lit = results.filter((r) => r === 'sucesso').length;
  const doused = results.filter((r) => r === 'falha').length;

  return (
    <>
      {matchPoint ? (
        <p
          className="eyebrow center"
          style={{ color: matchPoint === 'sentinela' ? 'var(--lantern)' : 'var(--eclipse)' }}
        >
          Match point {matchPoint === 'sentinela' ? 'dos Sentinelas' : 'do Eclipse'}
        </p>
      ) : null}
      <div
        className="beacons"
        role="img"
        data-matchpoint={matchPoint ?? undefined}
        aria-label={`Placar: ${lit} acesos, ${doused} apagados`}
      >
        {results.map((result, i) => {
          const state =
            result === 'sucesso' ? 'is-lit' : result === 'falha' ? 'is-doused' : i === currentRound ? 'is-current' : '';
          const status =
            result === 'sucesso'
              ? 'farol aceso'
              : result === 'falha'
                ? 'farol apagado'
                : i === currentRound
                  ? 'expedição atual'
                  : 'expedição futura';
          return (
            <div key={i} className={`beacon ${state}`} aria-label={`Expedição ${i + 1}: ${status}`}>
              <div className="beacon-tower">
                <span className="beacon-light" />
              </div>
              <span className="beacon-size">
                {teamSizes[i]}
                {failsRequired[i] === 2 ? '•' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Pips({ total, burned }: { total: number; burned: number }) {
  return (
    <div className="pips" aria-label={`${burned} de ${total} propostas rejeitadas`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`pip ${i < burned ? 'is-burned' : ''}`} />
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const cardRef = useFocusTrap(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          role="dialog"
          aria-modal
          aria-label={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={cardRef}
            className="panel overlay-card"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
