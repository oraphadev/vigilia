import { motion } from 'framer-motion';
import { useState } from 'react';
import type { PlayerView } from '@vigilia/shared';
import { ECLIPSE_COUNT, MIN_PLAYERS, MAX_PLAYERS, TEAM_SIZES } from '@vigilia/shared';
import { Medallion, Stage } from '../components/shared.js';
import { useStore } from '../store.js';

export function Lobby({ view }: { view: PlayerView }) {
  const { act, leaveRoom, toast } = useStore();
  const [copied, setCopied] = useState(false);
  const count = view.players.length;
  const ready = count >= MIN_PLAYERS;
  // Antes do mínimo, projeta a configuração de 5 jogadores como prévia.
  const effective = Math.max(count, MIN_PLAYERS);
  const eclipseCount = ECLIPSE_COUNT[effective]!;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('Não foi possível copiar. Anote o código acima.', 'info');
    }
  }

  return (
    <Stage>
      <header className="stack center" style={{ paddingTop: 12 }}>
        <p className="eyebrow">Sala de vigília</p>
        <div className="room-code">
          <span className="room-code-value" aria-label={`Código da sala: ${view.code.split('').join(' ')}`}>
            {view.code}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={copyCode}>
            {copied ? 'Copiado ✓' : 'Copiar código'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const url = `${location.origin}?sala=${view.code}`;
              if (navigator.share) {
                navigator.share({ title: 'VIGÍLIA', text: `Junte-se à minha vigília: ${view.code}`, url }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url).then(
                  () => toast('Convite copiado. Envie para os outros vigilantes.', 'info'),
                  () => {},
                );
              }
            }}
          >
            Convidar
          </button>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Compartilhe o código para reunir de {MIN_PLAYERS} a {MAX_PLAYERS} vigilantes.
        </p>
      </header>

      <section className="panel stack" aria-label="Vigilantes na sala">
        <div className="row-between">
          <h2 className="display" style={{ fontSize: 20 }}>
            Vigilantes <span className="muted">{count}/{MAX_PLAYERS}</span>
          </h2>
        </div>

        <div className="players-grid">
          {view.players.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 22 }}
            >
              <Medallion
                player={p}
                badge={p.isHost ? <span className="medallion-badge badge-leader" title="Anfitrião">✦</span> : undefined}
                onClick={
                  view.you.isHost && p.id !== view.you.id
                    ? () => {
                        if (confirm(`Remover ${p.name} da sala?`)) void act('room:kick', { playerId: p.id });
                      }
                    : undefined
                }
              />
            </motion.div>
          ))}
          {Array.from({ length: Math.max(0, MIN_PLAYERS - count) }, (_, i) => (
            <div key={`empty-${i}`} className="medallion is-off" aria-hidden>
              <span className="medallion-disc" style={{ borderStyle: 'dashed', color: 'var(--faded)' }}>
                ?
              </span>
              <span className="medallion-name muted">aguardando</span>
            </div>
          ))}
        </div>

        {view.you.isHost && count > 1 && (
          <p className="muted center" style={{ fontSize: 13 }}>
            Toque em um vigilante para removê-lo.
          </p>
        )}
      </section>

      <section className="panel stack" aria-label="Configuração da partida">
        <h2 className="display" style={{ fontSize: 20 }}>
          {ready ? 'A partida terá' : `Com ${effective} vigilantes, a partida terá`}
        </h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="chip"><span className="dot" /> {effective - eclipseCount} Sentinelas</span>
          <span className="chip">
            <span className="dot" style={{ background: 'var(--eclipse)', boxShadow: '0 0 8px rgba(143,232,220,.8)' }} />
            {eclipseCount} agentes do Eclipse
          </span>
          <span className="chip">5 expedições</span>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Patrulhas por expedição: {TEAM_SIZES[effective]!.join(' · ')}
          {effective >= 7 && ' — a 4ª exige duas sabotagens para falhar.'}
        </p>
      </section>

      <div className="stack">
        {view.you.isHost ? (
          <>
            <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => void act('game:start')}>
              {ready ? 'Iniciar a vigília' : `Faltam ${MIN_PLAYERS - count} vigilantes`}
            </button>
            {!ready && (
              <p className="muted center" style={{ fontSize: 13 }}>
                Reúna ao menos {MIN_PLAYERS} vigilantes para começar.
              </p>
            )}
          </>
        ) : (
          <p className="muted center">
            Aguardando o anfitrião iniciar a vigília…
          </p>
        )}
        <button className="btn btn-ghost btn-block" onClick={leaveRoom}>
          Sair da sala
        </button>
      </div>
    </Stage>
  );
}
