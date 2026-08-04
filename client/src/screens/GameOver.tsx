import { motion } from 'framer-motion';
import { useState } from 'react';
import type { PlayerView } from '@vigilia/shared';
import { Beacons, Medallion, Stage } from '../components/shared.js';
import { useStore } from '../store.js';
import { HistoryDrawer } from './History.js';

export function GameOver({ view }: { view: PlayerView }) {
  const { act, leaveRoom, toast } = useStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const sentinelsWon = view.winner === 'sentinela';
  const youWon = view.you.faction === view.winner;

  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'vigilante';
  const hostName = view.players.find((p) => p.isHost)?.name ?? 'o anfitrião';
  const lit = view.missionResults.filter((r) => r === 'sucesso').length;
  const doused = view.missionResults.filter((r) => r === 'falha').length;
  const missions = view.history.filter((r) => r.mission).map((r) => r.mission!);

  async function share() {
    const text = `${sentinelsWon ? '🔥' : '🌑'} ${
      sentinelsWon ? 'A Chama' : 'O Eclipse'
    } venceu em VIGÍLIA — faróis ${lit}×${doused}. Jogue: ${location.origin}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        return; // Cancelou o compartilhamento — nada a dizer.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Resultado copiado. Cole onde quiser.', 'info');
    } catch {
      toast('Não consegui copiar o resultado.');
    }
  }

  return (
    <Stage>
      <motion.header
        className="stack center"
        style={{ paddingTop: '5vh' }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <span style={{ fontSize: 56 }}>{sentinelsWon ? '🔥' : '🌑'}</span>
        <h1
          className="display"
          style={{
            fontSize: 34,
            color: sentinelsWon ? 'var(--flame)' : 'var(--eclipse)',
            textShadow: sentinelsWon ? '0 0 30px rgba(240,169,60,.5)' : '0 0 30px rgba(143,232,220,.45)',
          }}
        >
          {sentinelsWon ? 'Lumen resiste' : 'O Eclipse consumiu a cidade'}
        </h1>
        <p className="muted">
          {view.winReason === 'colapso'
            ? 'Cinco patrulhas rejeitadas: a confiança ruiu e a névoa subiu.'
            : sentinelsWon
              ? 'Três faróis acesos afastaram a névoa — desta vez.'
              : 'Três faróis apagados. A névoa tomou as ruas.'}
        </p>
        <p style={{ fontWeight: 600, color: youWon ? 'var(--flame)' : 'var(--faded)' }}>
          {youWon ? 'Seu lado venceu.' : 'Seu lado foi derrotado.'}
        </p>

        <div
          className="row"
          style={{ justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          aria-label={`Placar da noite: Sentinelas ${view.tally.sentinela}, Eclipse ${view.tally.eclipse}`}
        >
          <span className="eyebrow">Placar da noite</span>
          <span className="chip chip--flame">🔥 Sentinelas {view.tally.sentinela}</span>
          <span className="muted" aria-hidden>×</span>
          <span className="chip chip--eclipse">{view.tally.eclipse} Eclipse 🌑</span>
        </div>
      </motion.header>

      <Beacons
        results={view.missionResults}
        teamSizes={view.teamSizes}
        failsRequired={view.failsRequired}
        currentRound={-1}
      />

      {view.winner && (
        <motion.section
          className="panel stack"
          aria-label="Como o Eclipse agiu"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h2 className="display center" style={{ fontSize: 20 }}>Como o Eclipse agiu</h2>
          {missions.length === 0 ? (
            <p className="muted center" style={{ fontSize: 14 }}>
              Nenhuma patrulha chegou a um farol — a desconfiança fez o trabalho sozinha.
            </p>
          ) : (
            missions.map((mission, i) => {
              const success = mission.outcome === 'sucesso';
              return (
                <motion.p
                  key={mission.round}
                  style={{ fontSize: 14 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 + i * 0.08 }}
                >
                  <strong style={{ color: 'var(--parchment)' }}>Expedição {mission.round + 1}:</strong>{' '}
                  <span style={{ color: success ? 'var(--flame)' : 'var(--eclipse)', fontWeight: 600 }}>
                    {success ? '🔥 acesa' : '🌑 apagada'}
                  </span>
                  {!success && mission.saboteurs.length > 0 && (
                    <span className="muted"> — sabotada por {mission.saboteurs.map(nameOf).join(', ')}</span>
                  )}
                </motion.p>
              );
            })
          )}
        </motion.section>
      )}

      <motion.section
        className="panel stack"
        aria-label="Identidades reveladas"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        <h2 className="display center" style={{ fontSize: 20 }}>As máscaras caem</h2>
        <div className="players-grid">
          {view.players.map((p, i) => {
            const faction = view.rolesRevealed?.[p.id];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
              >
                <Medallion
                  player={p}
                  conspirator={faction === 'eclipse'}
                  badge={
                    <span className="medallion-badge" title={faction === 'eclipse' ? 'Eclipse' : 'Sentinela'}>
                      {faction === 'eclipse' ? '🌑' : '🔥'}
                    </span>
                  }
                />
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <div className="stack">
        {view.you.isHost ? (
          <button className="btn btn-primary btn-block" onClick={() => void act('game:playAgain')}>
            Jogar de novo
          </button>
        ) : (
          <p
            className="muted center row"
            style={{ justifyContent: 'center', alignItems: 'center', gap: 8 }}
            role="status"
          >
            <span className="spinner" aria-hidden />
            Aguardando {hostName} reunir a próxima partida…
          </p>
        )}
        <button className="btn btn-ghost btn-block" onClick={() => void share()}>
          Compartilhar resultado
        </button>
        <div className="row">
          <button className="btn btn-ghost grow" onClick={() => setHistoryOpen(true)}>
            Rever registro
          </button>
          <button
            className="btn btn-ghost grow"
            onClick={() => {
              if (window.confirm('Sair da sala? Você ficará de fora das próximas partidas desta noite.')) {
                leaveRoom();
              }
            }}
          >
            Sair da sala
          </button>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} view={view} />
    </Stage>
  );
}
