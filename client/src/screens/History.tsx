import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useMemo } from 'react';
import { useFocusTrap } from '../components/useFocusTrap.js';
import type { Faction, PlayerView } from '@vigilia/shared';

/** Consulta de nomes + facções reveladas usada por todo o registro. */
interface Ledger {
  nameOf: (id: string) => string;
  factionOf: (id: string) => Faction | null;
}

/** Um nome no registro. Depois do fim de jogo, carrega a marca da facção. */
function Who({ id, l, lead }: { id: string; l: Ledger; lead?: boolean }) {
  const faction = l.factionOf(id);
  const color = faction
    ? faction === 'eclipse'
      ? 'var(--eclipse)'
      : 'var(--flame)'
    : lead
      ? 'var(--parchment)'
      : undefined;

  return (
    <span
      style={{ color, fontWeight: lead ? 700 : faction ? 600 : undefined }}
      title={faction ? (faction === 'eclipse' ? 'Eclipse' : 'Sentinela') : undefined}
    >
      {l.nameOf(id)}
      {faction && (
        <span aria-hidden style={{ fontSize: '0.85em', marginLeft: 3 }}>
          {faction === 'eclipse' ? '🌑' : '🔥'}
        </span>
      )}
    </span>
  );
}

function WhoList({ ids, l }: { ids: string[]; l: Ledger }) {
  return (
    <>
      {ids.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && ', '}
          <Who id={id} l={l} />
        </Fragment>
      ))}
    </>
  );
}

export function HistoryDrawer({
  open,
  onClose,
  view,
}: {
  open: boolean;
  onClose: () => void;
  view: PlayerView;
}) {
  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const panelRef = useFocusTrap(open, onClose);

  const roles = view.rolesRevealed;
  const ledger = useMemo<Ledger>(
    () => ({
      nameOf: (id) => names.get(id) ?? 'vigilante',
      factionOf: (id) => roles?.[id] ?? null,
    }),
    [names, roles],
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="drawer" role="dialog" aria-modal aria-label="Registro da vigília">
          <motion.div
            className="drawer-scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="complementary"
            ref={panelRef}
            className="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="row-between">
              <h2 className="display" style={{ fontSize: 22 }}>Registro da vigília</h2>
              <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar registro">
                Fechar
              </button>
            </div>

            {view.history.length === 0 ? (
              <p className="muted">Nada registrado ainda. A primeira patrulha dirá muito.</p>
            ) : (
              view.history.map((round) => (
                <section key={round.round} className="history-round">
                  <div className="row-between">
                    <strong>Expedição {round.round + 1}</strong>
                    {round.mission && (
                      <span
                        className="chip"
                        style={{
                          borderColor:
                            round.mission.outcome === 'sucesso'
                              ? 'rgba(240,169,60,.5)'
                              : 'rgba(143,232,220,.5)',
                        }}
                      >
                        {round.mission.outcome === 'sucesso'
                          ? '🔥 Farol aceso'
                          : `🌑 Apagado (${round.mission.failCount})`}
                      </span>
                    )}
                  </div>

                  {round.attempts.length === 0 && (
                    <p className="muted" style={{ fontSize: 13 }}>Formando a patrulha…</p>
                  )}

                  {round.attempts.map((attempt) => {
                    const entries = Object.entries(attempt.votes);
                    const approvals = entries.filter(([, v]) => v).length;
                    const against = entries.filter(([, v]) => !v).map(([id]) => id);
                    return (
                      <div key={attempt.attempt} className="history-attempt">
                        <span>
                          <Who id={attempt.leaderId} l={ledger} lead /> propôs{' '}
                          <WhoList ids={attempt.team} l={ledger} />
                        </span>
                        <span>
                          <span
                            style={{
                              color: attempt.approved ? 'var(--flame)' : 'var(--danger)',
                              fontWeight: 600,
                            }}
                          >
                            {attempt.approved ? '✓ aprovada' : '✕ rejeitada'} {approvals}×
                            {entries.length - approvals}
                          </span>
                          {against.length > 0 && (
                            <>
                              {' · contra: '}
                              <WhoList ids={against} l={ledger} />
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}

                  {round.mission && round.mission.saboteurs.length > 0 && (
                    <span className="chip chip--eclipse" style={{ alignSelf: 'flex-start' }}>
                      🌑 Sabotaram: {round.mission.saboteurs.map(ledger.nameOf).join(', ')}
                    </span>
                  )}
                </section>
              ))
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
