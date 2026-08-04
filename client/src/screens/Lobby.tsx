import { motion } from 'framer-motion';
import { useState } from 'react';
import type { PlayerView } from '@vigilia/shared';
import { ECLIPSE_COUNT, MIN_PLAYERS, MAX_PLAYERS, TEAM_SIZES } from '@vigilia/shared';
import { HowToPlay } from '../components/HowToPlay.js';
import { Medallion, Stage } from '../components/shared.js';
import { useStore } from '../store.js';

export function Lobby({ view }: { view: PlayerView }) {
  const { act, leaveRoom, toast, tutorialSeen } = useStore();
  const [copied, setCopied] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);

  const count = view.players.length;
  const ready = count >= MIN_PLAYERS;
  const missing = MIN_PLAYERS - count;
  // Antes do mínimo, projeta a configuração de 5 jogadores como prévia.
  const effective = Math.max(count, MIN_PLAYERS);
  const eclipseCount = ECLIPSE_COUNT[effective]!;

  const inviteUrl = `${location.origin}?sala=${view.code}`;
  const tally = view.tally;
  const hasTally = tally.sentinela + tally.eclipse > 0;
  const tallyClass =
    tally.sentinela > tally.eclipse
      ? 'chip chip--flame'
      : tally.eclipse > tally.sentinela
        ? 'chip chip--eclipse'
        : 'chip';

  /** O código gigante copia só o código — o feedback ocupa o lugar do subtítulo. */
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('Não foi possível copiar. Anote o código acima.', 'info');
    }
  }

  /** CTA único de convite: compartilha código + link, com cópia como plano B. */
  async function invite() {
    const text = `Entre na minha sala em VIGÍLIA. Código ${view.code} — ${inviteUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'VIGÍLIA', text, url: inviteUrl });
      } catch {
        // Compartilhamento cancelado: nada a fazer.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Convite copiado. Envie para os outros vigilantes.', 'info');
    } catch {
      toast(`Não foi possível copiar. Passe o código ${view.code} para os outros.`, 'info');
    }
  }

  return (
    <Stage>
      <header className="stack center" style={{ paddingTop: 12 }}>
        <p className="eyebrow">Sala de vigília</p>
        <div className="room-code">
          <button
            type="button"
            onClick={copyCode}
            aria-label={`Copiar o código da sala: ${view.code.split('').join(' ')}`}
            style={{
              padding: '6px 10px',
              border: 0,
              background: 'none',
              cursor: 'pointer',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <span className="room-code-value" aria-hidden>
              {view.code}
            </span>
          </button>
        </div>
        <p className="muted" aria-live="polite" style={{ fontSize: 14 }}>
          {copied ? 'Copiado ✓' : `Toque no código para copiar · de ${MIN_PLAYERS} a ${MAX_PLAYERS} vigilantes`}
        </p>
        <button className="btn btn-ghost btn-block" onClick={invite}>
          Convidar vigilantes
        </button>
      </header>

      {!tutorialSeen && (
        <button
          className="panel row-between"
          onClick={() => setHowToOpen(true)}
          style={{ width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
        >
          <span className="stack" style={{ gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Primeira vez aqui?</span>
            <span className="muted" style={{ fontSize: 14 }}>
              Veja como jogar em 1 minuto.
            </span>
          </span>
          <span aria-hidden style={{ color: 'var(--flame)', fontSize: 20 }}>
            →
          </span>
        </button>
      )}

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
        {hasTally && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className={tallyClass}>
              Noite: Sentinelas {tally.sentinela} × {tally.eclipse} Eclipse
            </span>
          </div>
        )}

        <h2 className="display" style={{ fontSize: 20 }}>
          {ready ? 'A partida terá' : `Com ${effective} vigilantes, a partida terá`}
        </h2>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="chip chip--flame">
            <span className="dot" /> {effective - eclipseCount} Sentinelas
          </span>
          <span className="chip chip--eclipse">
            <span className="dot" /> {eclipseCount} agentes do Eclipse
          </span>
          <span className="chip">5 expedições</span>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Patrulhas por expedição: {TEAM_SIZES[effective]!.join(' · ')}
          {effective >= 7 && ' — a 4ª exige duas sabotagens para falhar.'}
        </p>
        <p className="muted" style={{ fontSize: 14 }}>
          Entrem todos numa chamada de voz ou fiquem na mesma sala — o jogo acontece na conversa.
        </p>
      </section>

      <div className="stack">
        {view.you.isHost ? (
          <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => void act('game:start')}>
            {ready ? 'Iniciar a vigília' : missing === 1 ? 'Falta 1 vigilante' : `Faltam ${missing} vigilantes`}
          </button>
        ) : (
          <p className="muted center">Aguardando o anfitrião iniciar a partida…</p>
        )}
        <button className="btn btn-ghost btn-block" onClick={leaveRoom}>
          Sair da sala
        </button>
        <div className="center">
          <button className="btn btn-ghost btn-sm" onClick={() => setHowToOpen(true)}>
            Como jogar
          </button>
        </div>
      </div>

      <HowToPlay open={howToOpen} onClose={() => setHowToOpen(false)} />
    </Stage>
  );
}
