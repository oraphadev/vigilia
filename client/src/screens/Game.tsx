import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { PlayerView, VoteRecord, MissionRecord } from '@vigilia/shared';
import { MAX_REJECTIONS } from '@vigilia/shared';
import { Beacons, Medallion, Pips, Stage } from '../components/shared.js';
import { useStore } from '../store.js';
import { HistoryDrawer } from './History.js';

const voteKey = (v: VoteRecord | null) => (v ? `${v.round}-${v.attempt}` : null);
const missionKey = (m: MissionRecord | null) => (m ? `m${m.round}` : null);

export function Game({ view }: { view: PlayerView }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Inicializa com o estado atual para não reexibir revelações antigas ao reconectar.
  const [seenVote, setSeenVote] = useState<string | null>(() => voteKey(view.lastVote));
  const [seenMission, setSeenMission] = useState<string | null>(() => missionKey(view.lastMission));

  const pendingVote = voteKey(view.lastVote) !== seenVote ? view.lastVote : null;
  const pendingMission = !pendingVote && missionKey(view.lastMission) !== seenMission ? view.lastMission : null;

  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const leader = view.players.find((p) => p.id === view.leaderId);

  return (
    <Stage>
      <header className="stack" style={{ gap: 12 }}>
        <div className="status-bar">
          <span className="chip">
            <span className="dot" /> Expedição {view.round + 1} de 5
          </span>
          <Pips total={MAX_REJECTIONS} burned={view.attempt} />
          <button className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(true)}>
            Registro
          </button>
        </div>
        <Beacons
          results={view.missionResults}
          teamSizes={view.teamSizes}
          failsRequired={view.failsRequired}
          currentRound={view.round}
        />
        {view.attempt >= MAX_REJECTIONS - 2 && view.phase !== 'roleReveal' && (
          <p className="center" style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
            {view.attempt === MAX_REJECTIONS - 1
              ? 'Última chance: mais uma rejeição e o Eclipse vence.'
              : 'A confiança está ruindo — restam poucas propostas.'}
          </p>
        )}
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={view.phase + (view.you.isLeader ? '-lead' : '')}
          className="stack"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {view.phase === 'roleReveal' && <RoleReveal view={view} />}
          {view.phase === 'teamSelect' && <TeamSelect view={view} leaderName={leader?.name ?? '…'} />}
          {view.phase === 'voting' && <Voting view={view} leaderName={leader?.name ?? '…'} />}
          {view.phase === 'mission' && <Mission view={view} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {pendingVote && (
          <VoteRevealOverlay
            record={pendingVote}
            names={names}
            onDone={() => setSeenVote(voteKey(pendingVote))}
          />
        )}
        {pendingMission && (
          <MissionRevealOverlay
            record={pendingMission}
            onDone={() => setSeenMission(missionKey(pendingMission))}
          />
        )}
      </AnimatePresence>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} view={view} />
    </Stage>
  );
}

/* ===== Revelação de papel ===== */

function RoleReveal({ view }: { view: PlayerView }) {
  const act = useStore((s) => s.act);
  const [revealed, setRevealed] = useState(false);
  const eclipse = view.you.faction === 'eclipse';
  const acked = view.players.find((p) => p.id === view.you.id)?.hasAckedRole ?? false;
  const ackCount = view.players.filter((p) => p.hasAckedRole).length;

  return (
    <section className="stack center" aria-label="Seu papel secreto">
      <p className="eyebrow">Seu papel secreto</p>

      <div className="role-card" style={{ minHeight: 300 }}>
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.button
              key="verso"
              type="button"
              className="role-face panel"
              style={{ width: '100%', cursor: 'pointer' }}
              onClick={() => setRevealed(true)}
              initial={{ rotateY: 0 }}
              exit={{ rotateY: 90, transition: { duration: 0.22, ease: 'easeIn' } }}
            >
              <div className="stack center" style={{ gap: 16, padding: '18px 0' }}>
                <span style={{ fontSize: 44 }}>🕯️</span>
                <h2 className="display" style={{ fontSize: 24 }}>A cidade dorme.</h2>
                <p className="muted">Certifique-se de que ninguém vê sua tela.</p>
                <span className="btn btn-ghost">Tocar para revelar</span>
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="frente"
              className={`role-face ${eclipse ? 'eclipse' : 'sentinela'}`}
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0, transition: { duration: 0.32, ease: 'easeOut' } }}
            >
              <div className="stack center" style={{ gap: 12 }}>
                <span style={{ fontSize: 44 }}>{eclipse ? '🌑' : '🔥'}</span>
                <h2 className="display" style={{ fontSize: 28 }}>
                  {eclipse ? 'Agente do Eclipse' : 'Sentinela da Chama'}
                </h2>
                <p style={{ fontSize: 15 }}>
                  {eclipse
                    ? 'Apague os faróis sem ser descoberto. Vote, converse e sabote como se fosse leal.'
                    : 'Proteja Lumen. Descubra quem serve ao Eclipse e mantenha-os longe das patrulhas.'}
                </p>
                {eclipse && view.you.conspirators && (
                  <div className="stack" style={{ gap: 8 }}>
                    <p className="eyebrow" style={{ color: 'var(--eclipse)' }}>Conspiram com você</p>
                    <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                      {view.you.conspirators.map((id) => {
                        const p = view.players.find((pl) => pl.id === id);
                        return p ? (
                          <span key={id} className="chip" style={{ borderColor: 'rgba(143,232,220,.5)' }}>
                            {p.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {revealed && !acked && (
        <motion.button
          className="btn btn-primary btn-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => void act('game:ackRole')}
        >
          Guardei meu segredo
        </motion.button>
      )}
      {acked && (
        <p className="muted">
          Aguardando os demais… {ackCount}/{view.players.length}
        </p>
      )}
    </section>
  );
}

/* ===== Seleção de patrulha ===== */

function TeamSelect({ view, leaderName }: { view: PlayerView; leaderName: string }) {
  const act = useStore((s) => s.act);
  const [picked, setPicked] = useState<string[]>([]);
  const size = view.teamSizes[view.round] ?? 0;
  const isLeader = view.you.isLeader;

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < size ? [...prev, id] : prev,
    );
  }

  return (
    <section className="stack" aria-label="Formação da patrulha">
      <div className="panel stack center">
        <p className="eyebrow">{isLeader ? 'Você comanda esta expedição' : 'Formação da patrulha'}</p>
        <h2 className="display" style={{ fontSize: 22 }}>
          {isLeader
            ? `Escolha ${size} vigilantes`
            : `${leaderName} está escolhendo ${size} vigilantes`}
        </h2>
        {view.failsRequired[view.round] === 2 && (
          <p className="muted" style={{ fontSize: 14 }}>
            Esta expedição só falha com duas sabotagens.
          </p>
        )}

        <div className="players-grid" role={isLeader ? 'group' : undefined}>
          {view.players.map((p) => (
            <Medallion
              key={p.id}
              player={p}
              selected={isLeader && picked.includes(p.id)}
              conspirator={view.you.conspirators?.includes(p.id) ?? false}
              badge={p.isLeader ? <span className="medallion-badge badge-leader" title="Comandante">★</span> : undefined}
              onClick={isLeader ? () => toggle(p.id) : undefined}
            />
          ))}
        </div>

        {isLeader ? (
          <button
            className="btn btn-primary btn-block"
            disabled={picked.length !== size}
            onClick={async () => {
              if (await act('game:propose', { team: picked })) setPicked([]);
            }}
          >
            {picked.length === size
              ? 'Enviar patrulha para votação'
              : `Selecionados ${picked.length} de ${size}`}
          </button>
        ) : (
          <p className="muted center" style={{ fontSize: 14 }}>
            Converse: quem merece carregar a chama?
          </p>
        )}
      </div>
    </section>
  );
}

/* ===== Votação ===== */

function Voting({ view, leaderName }: { view: PlayerView; leaderName: string }) {
  const act = useStore((s) => s.act);
  const [choice, setChoice] = useState<boolean | null>(null);
  const voted = view.you.hasVoted;

  return (
    <section className="stack" aria-label="Votação da patrulha">
      <div className="panel stack center">
        <p className="eyebrow">Proposta de {leaderName}</p>
        <div className="players-grid">
          {view.players
            .filter((p) => p.onTeam)
            .map((p) => (
              <Medallion
                key={p.id}
                player={p}
                selected
                conspirator={view.you.conspirators?.includes(p.id) ?? false}
              />
            ))}
        </div>

        {!voted ? (
          <div className="stack" style={{ width: '100%' }}>
            <p style={{ fontWeight: 600 }}>Esta patrulha deve partir?</p>
            <div className="choice-row">
              <button
                className={`choice-card choice-approve ${choice === true ? 'is-picked' : ''}`}
                onClick={() => {
                  setChoice(true);
                  void act('game:vote', { approve: true });
                }}
              >
                <span className="glyph">🔆</span>
                Aprovar
              </button>
              <button
                className={`choice-card choice-reject ${choice === false ? 'is-picked' : ''}`}
                onClick={() => {
                  setChoice(false);
                  void act('game:vote', { approve: false });
                }}
              >
                <span className="glyph">✕</span>
                Rejeitar
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              O voto é público após a apuração. Empate rejeita.
            </p>
          </div>
        ) : (
          <div className="stack center">
            <p style={{ fontWeight: 600 }}>Voto registrado.</p>
            <p className="muted">
              Aguardando {view.players.length - view.votesCast} de {view.players.length} vigilantes…
            </p>
          </div>
        )}
      </div>

      <div className="players-grid" aria-label="Quem já votou">
        {view.players.map((p) => (
          <Medallion
            key={p.id}
            player={p}
            conspirator={view.you.conspirators?.includes(p.id) ?? false}
            badge={
              p.hasVoted ? <span className="medallion-badge badge-done" title="Já votou">✓</span> : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

/* ===== Expedição ===== */

function Mission({ view }: { view: PlayerView }) {
  const act = useStore((s) => s.act);
  const eclipse = view.you.faction === 'eclipse';
  const team = view.players.filter((p) => p.onTeam);

  return (
    <section className="stack" aria-label="Expedição em andamento">
      <div className="panel stack center">
        <p className="eyebrow">Expedição {view.round + 1}</p>
        <div className="players-grid">
          {team.map((p) => (
            <Medallion
              key={p.id}
              player={p}
              selected
              conspirator={view.you.conspirators?.includes(p.id) ?? false}
              badge={
                p.hasPlayedCard ? <span className="medallion-badge badge-done" title="Já agiu">✓</span> : undefined
              }
            />
          ))}
        </div>

        {view.you.onTeam && !view.you.hasPlayedCard ? (
          <div className="stack" style={{ width: '100%' }}>
            <p style={{ fontWeight: 600 }}>A patrulha alcançou o farol. O que você faz?</p>
            <div className="choice-row">
              <button
                className="choice-card choice-approve"
                onClick={() => void act('game:card', { light: true })}
              >
                <span className="glyph">🔥</span>
                Acender
              </button>
              <button
                className="choice-card choice-sabotage"
                disabled={!eclipse}
                onClick={() => void act('game:card', { light: false })}
              >
                <span className="glyph">🌑</span>
                Apagar
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              {eclipse
                ? 'Sua escolha é secreta — as ações são reveladas embaralhadas.'
                : 'Sentinelas são leais: apenas acendem. Ninguém saberá quem fez o quê.'}
            </p>
          </div>
        ) : (
          <p className="muted">
            {view.you.onTeam ? 'Ação registrada. ' : ''}
            A patrulha age em segredo… {view.cardsPlayed}/{team.length}
          </p>
        )}
      </div>
    </section>
  );
}

/* ===== Overlays de revelação ===== */

function VoteRevealOverlay({
  record,
  names,
  onDone,
}: {
  record: VoteRecord;
  names: Map<string, string>;
  onDone: () => void;
}) {
  const entries = Object.entries(record.votes);
  const approvals = entries.filter(([, v]) => v).length;

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="panel overlay-card stack"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <p className="eyebrow">Apuração · Expedição {record.round + 1}</p>
        <h2 className="display" style={{ fontSize: 26, color: record.approved ? 'var(--flame)' : 'var(--danger)' }}>
          {record.approved ? 'Patrulha aprovada' : 'Patrulha rejeitada'}
        </h2>
        <p className="muted" style={{ fontSize: 14 }}>
          {approvals} a favor · {entries.length - approvals} contra
          {!record.approved && ' — o comando passa adiante.'}
        </p>
        <div className="vote-chips">
          {entries.map(([id, approve], i) => (
            <motion.span
              key={id}
              className={`vote-chip ${approve ? 'approved' : 'rejected'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.09 }}
            >
              {approve ? '🔆' : '✕'} {names.get(id) ?? '—'}
            </motion.span>
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={onDone}>
          Continuar
        </button>
      </motion.div>
    </motion.div>
  );
}

function MissionRevealOverlay({ record, onDone }: { record: MissionRecord; onDone: () => void }) {
  const success = record.outcome === 'sucesso';
  const cards = [
    ...Array.from({ length: record.team.length - record.failCount }, () => true),
    ...Array.from({ length: record.failCount }, () => false),
  ];

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="panel overlay-card stack"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <p className="eyebrow">Expedição {record.round + 1}</p>
        <div className="mission-cards-reveal">
          {cards.map((light, i) => (
            <motion.div
              key={i}
              className={`reveal-card ${light ? 'is-light' : 'is-dark'}`}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.28, duration: 0.4 }}
            >
              {light ? '🔥' : '🌑'}
            </motion.div>
          ))}
        </div>
        <motion.h2
          className="display"
          style={{ fontSize: 26, color: success ? 'var(--flame)' : 'var(--eclipse)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 + cards.length * 0.28 }}
        >
          {success ? 'O farol está aceso' : 'O farol se apagou'}
        </motion.h2>
        <motion.p
          className="muted"
          style={{ fontSize: 14 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + cards.length * 0.28 }}
        >
          {record.failCount === 0
            ? 'Nenhuma sabotagem entre as ações.'
            : `${record.failCount} ${record.failCount > 1 ? 'sabotagens' : 'sabotagem'} entre as ações${
                !success ? '' : ` — mas esta expedição exigia ${record.failsRequired}.`
              }`}
        </motion.p>
        <button className="btn btn-primary btn-block" onClick={onDone}>
          Continuar
        </button>
      </motion.div>
    </motion.div>
  );
}
