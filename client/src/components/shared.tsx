import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { MissionOutcome, PublicPlayer } from '@vigilia/shared';
import { useStore } from '../store.js';

/** Emblemas dos vigilantes — glifos abstratos, um por avatar. */
export const AVATAR_GLYPHS = ['✶', '☾', '✦', '❋', '◆', '✹', '❂', '✧', '✺', '✪'] as const;

export function glyphFor(avatar: number): string {
  return AVATAR_GLYPHS[avatar % AVATAR_GLYPHS.length]!;
}

/** Cenário de fundo comum: céu estrelado + névoa viva. */
export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="mist" aria-hidden />
      <div className="column">{children}</div>
      <Toasts />
      <ReconnectBanner />
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

function ReconnectBanner() {
  const reconnecting = useStore((s) => s.reconnecting);
  if (!reconnecting) return null;
  return (
    <div className="reconnect-banner">
      <span className="spinner" aria-hidden />
      Reacendendo a conexão…
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

  const content = (
    <>
      <span className="medallion-disc">
        {glyphFor(player.avatar)}
        {badge}
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
}: {
  results: (MissionOutcome | null)[];
  teamSizes: number[];
  failsRequired: number[];
  currentRound: number;
}) {
  return (
    <div className="beacons" aria-label="Progresso das expedições">
      {results.map((result, i) => {
        const state =
          result === 'sucesso' ? 'is-lit' : result === 'falha' ? 'is-doused' : i === currentRound ? 'is-current' : '';
        return (
          <div key={i} className={`beacon ${state}`}>
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
