import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import type { PlayerView } from '@vigilia/shared';

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
  const nameOf = (id: string) => names.get(id) ?? 'vigilante';

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
          <motion.aside
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

                  {round.attempts.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Formando a primeira patrulha…</p>}

                  {round.attempts.map((attempt) => {
                    const approvals = Object.values(attempt.votes).filter(Boolean).length;
                    return (
                      <div key={attempt.attempt} className="history-attempt">
                        <span>
                          <strong style={{ color: 'var(--parchment)' }}>{nameOf(attempt.leaderId)}</strong>{' '}
                          propôs {attempt.team.map(nameOf).join(', ')}
                        </span>
                        <span>
                          {attempt.approved ? '✓ aprovada' : '✕ rejeitada'} · {approvals} a favor,{' '}
                          {Object.keys(attempt.votes).length - approvals} contra
                        </span>
                        <span style={{ fontSize: 12 }}>
                          contra:{' '}
                          {Object.entries(attempt.votes)
                            .filter(([, v]) => !v)
                            .map(([id]) => nameOf(id))
                            .join(', ') || 'ninguém'}
                        </span>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
