import { motion } from 'framer-motion';
import { useState } from 'react';
import type { PlayerView } from '@vigilia/shared';
import { Beacons, Medallion, Stage } from '../components/shared.js';
import { useStore } from '../store.js';
import { HistoryDrawer } from './History.js';

export function GameOver({ view }: { view: PlayerView }) {
  const { act, leaveRoom } = useStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const sentinelsWon = view.winner === 'sentinela';
  const youWon = view.you.faction === view.winner;

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
      </motion.header>

      <Beacons
        results={view.missionResults}
        teamSizes={view.teamSizes}
        failsRequired={view.failsRequired}
        currentRound={-1}
      />

      <motion.section
        className="panel stack"
        aria-label="Identidades reveladas"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
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
                transition={{ delay: 0.5 + i * 0.08 }}
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
            Reunir nova vigília
          </button>
        ) : (
          <p className="muted center">O anfitrião pode reunir uma nova vigília com todos.</p>
        )}
        <div className="row">
          <button className="btn btn-ghost grow" onClick={() => setHistoryOpen(true)}>
            Rever registro
          </button>
          <button className="btn btn-ghost grow" onClick={leaveRoom}>
            Sair da sala
          </button>
        </div>
      </div>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} view={view} />
    </Stage>
  );
}
