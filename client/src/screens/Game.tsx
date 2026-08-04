import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerView, PublicPlayer, VoteRecord, MissionRecord } from '@vigilia/shared';
import { MAX_REJECTIONS, MISSIONS_TO_WIN } from '@vigilia/shared';
import { Beacons, Medallion, Pips, Stage } from '../components/shared.js';
import { HowToPlay } from '../components/HowToPlay.js';
import { useStore } from '../store.js';
import { HistoryDrawer } from './History.js';

const voteKey = (v: VoteRecord | null) => (v ? `${v.round}-${v.attempt}` : null);
const missionKey = (m: MissionRecord | null) => (m ? `m${m.round}` : null);

/** Rejeições a partir das quais o Colapso deixa de ser hipótese. */
const DANGER_FROM = MAX_REJECTIONS - 2;

export function Game({ view }: { view: PlayerView }) {
  const act = useStore((s) => s.act);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Inicializa com o estado atual para não reexibir revelações antigas ao reconectar.
  const [seenVote, setSeenVote] = useState<string | null>(() => voteKey(view.lastVote));
  const [seenMission, setSeenMission] = useState<string | null>(() => missionKey(view.lastMission));

  const pendingVote = voteKey(view.lastVote) !== seenVote ? view.lastVote : null;
  const pendingMission = !pendingVote && missionKey(view.lastMission) !== seenMission ? view.lastMission : null;

  const leader = view.players.find((p) => p.id === view.leaderId);

  const lit = view.missionResults.filter((r) => r === 'sucesso').length;
  const doused = view.missionResults.filter((r) => r === 'falha').length;
  // Uma prop só: com ambos a um passo, o Eclipse é a ameaça que precisa ser dita.
  const matchPoint: 'sentinela' | 'eclipse' | null =
    doused === MISSIONS_TO_WIN - 1 ? 'eclipse' : lit === MISSIONS_TO_WIN - 1 ? 'sentinela' : null;
  const showMatchPoint = matchPoint !== null && view.phase !== 'roleReveal';

  const danger = view.attempt >= DANGER_FROM;

  return (
    <Stage>
      <header className="stack" style={{ gap: 12 }}>
        <div className="status-bar">
          <span
            className={`chip ${danger ? 'chip--danger' : ''}`}
            aria-label={`${view.attempt} de ${MAX_REJECTIONS} propostas rejeitadas`}
          >
            Rejeições {view.attempt}/{MAX_REJECTIONS}
            <Pips total={MAX_REJECTIONS} burned={view.attempt} />
          </span>

          <RolePeek view={view} />

          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setHelpOpen(true)}
              aria-label="Como jogar"
              title="Como jogar"
            >
              ?
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(true)}>
              Registro
            </button>
          </div>
        </div>

        <Beacons
          results={view.missionResults}
          teamSizes={view.teamSizes}
          failsRequired={view.failsRequired}
          currentRound={view.round}
          matchPoint={matchPoint}
        />

        {danger && view.phase !== 'roleReveal' && (
          <p className="center" style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }} role="status">
            Restam {MAX_REJECTIONS - view.attempt}{' '}
            {MAX_REJECTIONS - view.attempt === 1 ? 'proposta' : 'propostas'} antes do Colapso. Depois disso, o
            Eclipse vence.
          </p>
        )}
      </header>

      {showMatchPoint && (
        <p
          className="center"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: matchPoint === 'eclipse' ? 'var(--eclipse)' : 'var(--flame)',
          }}
          role="status"
        >
          Esta expedição pode decidir a partida.
        </p>
      )}

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

      <HostMenu view={view} act={act} />

      <AnimatePresence>
        {pendingVote && (
          <VoteRevealOverlay
            record={pendingVote}
            players={view.players}
            currentLeaderId={view.leaderId}
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
      <HowToPlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Stage>
  );
}

/* ===== Peças compartilhadas ===== */

/**
 * Grade de medalhões + contagem padrão de espera ("Faltam n de total").
 * Toda espera do jogo fala a mesma língua.
 */
function RosterWaiting({
  players,
  done,
  doneTitle,
  label,
  conspirators,
  selected,
}: {
  players: PublicPlayer[];
  done: (p: PublicPlayer) => boolean;
  doneTitle: string;
  label: string;
  conspirators?: string[] | null;
  selected?: (p: PublicPlayer) => boolean;
}) {
  const remaining = players.filter((p) => !done(p)).length;
  return (
    <div className="stack" style={{ gap: 10, width: '100%' }}>
      <div className="players-grid" aria-label={label}>
        {players.map((p) => (
          <Medallion
            key={p.id}
            player={p}
            selected={selected ? selected(p) : false}
            conspirator={conspirators?.includes(p.id) ?? false}
            badge={
              done(p) ? (
                <span className="medallion-badge badge-done" title={doneTitle}>
                  ✓
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
      <p className="muted center" style={{ fontSize: 13 }} role="status">
        {remaining === 0 ? 'Todo mundo a postos.' : `Faltam ${remaining} de ${players.length}`}
      </p>
    </div>
  );
}

/**
 * "Meu papel" sob demanda: revela apenas enquanto o dedo (ou a tecla) segura.
 * Nada do segredo fica em repouso na tela: soltou, sumiu.
 */
function RolePeek({ view }: { view: PlayerView }) {
  const [held, setHeld] = useState(false);
  const eclipse = view.you.faction === 'eclipse';

  if (!view.you.faction) return null;

  const release = () => setHeld(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`chip ${held ? (eclipse ? 'chip--eclipse' : 'chip--flame') : ''}`}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', cursor: 'pointer' }}
        aria-label="Segure para ver seu papel secreto"
        aria-expanded={held}
        onPointerDown={(e) => {
          e.preventDefault();
          setHeld(true);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setHeld(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') release();
        }}
      >
        🕯 Meu papel
      </button>

      <AnimatePresence>
        {held && (
          <motion.div
            className="panel stack role-peek-pop"
            role="status"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{ gap: 8 }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>{eclipse ? '🌑' : '🔥'}</span>
            <strong
              className="display"
              style={{ fontSize: 18, color: eclipse ? 'var(--eclipse)' : 'var(--flame)' }}
            >
              {eclipse ? 'Agente do Eclipse' : 'Sentinela da Chama'}
            </strong>

            {eclipse && view.you.conspirators && view.you.conspirators.length > 0 && (
              <>
                <p className="eyebrow" style={{ color: 'var(--eclipse)' }}>
                  Conspiram com você
                </p>
                <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
                  {view.you.conspirators.map((id) => {
                    const p = view.players.find((pl) => pl.id === id);
                    return p ? (
                      <span key={id} className="chip chip--eclipse">
                        {p.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </>
            )}

            <p className="muted" style={{ fontSize: 13 }}>
              Há {view.eclipseCount} {view.eclipseCount === 1 ? 'agente' : 'agentes'} do Eclipse entre{' '}
              {view.players.length} vigilantes.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Saída discreta do anfitrião; nunca compete com as ações de jogo. */
function HostMenu({ view, act }: { view: PlayerView; act: (event: string, payload?: unknown) => Promise<boolean> }) {
  if (!view.you.isHost) return null;
  const offline = view.players.filter((p) => !p.connected);

  return (
    <div className="stack center" style={{ gap: 6, marginTop: 'auto', paddingTop: 10, opacity: 0.75 }}>
      {offline.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          {offline.map((p) => p.name).join(', ')} {offline.length === 1 ? 'sumiu' : 'sumiram'} da vigília e a fase
          pode travar.
        </p>
      )}
      <button
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 12 }}
        onClick={() => {
          if (confirm('Encerrar a partida e voltar todos ao lobby?')) void act('game:abort');
        }}
      >
        Encerrar esta partida
      </button>
    </div>
  );
}

/* ===== Revelação de papel ===== */

function RoleReveal({ view }: { view: PlayerView }) {
  const act = useStore((s) => s.act);
  const pending = useStore((s) => s.pending);
  const [revealed, setRevealed] = useState(false);
  const eclipse = view.you.faction === 'eclipse';
  const acked = view.players.find((p) => p.id === view.you.id)?.hasAckedRole ?? false;

  // Depois de guardado, o segredo sai da tela: nada de carta aberta enquanto se espera.
  if (acked) {
    return (
      <section className="stack center" aria-label="Segredo guardado">
        <div className="panel stack center" style={{ gap: 10 }}>
          <span style={{ fontSize: 40, lineHeight: 1 }}>🕯</span>
          <h2 className="display" style={{ fontSize: 22 }}>
            Seu segredo está guardado.
          </h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Esqueceu? Segure “🕯 Meu papel” no topo. Ninguém mais vê.
          </p>
        </div>

        <div className="panel stack center">
          <p className="eyebrow">A cidade acorda quando todos guardarem</p>
          <RosterWaiting
            players={view.players}
            done={(p) => p.hasAckedRole}
            doneTitle="Já guardou o segredo"
            label="Quem já guardou o segredo"
          />
        </div>
      </section>
    );
  }

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
                    ? 'Apague os faróis sem levantar suspeitas. Vote, converse e sabote como se fosse leal.'
                    : 'Proteja Lumen. Descubra quem serve ao Eclipse e mantenha-os longe das patrulhas.'}
                </p>
                {eclipse && view.you.conspirators && (
                  <div className="stack" style={{ gap: 8 }}>
                    <p className="eyebrow" style={{ color: 'var(--eclipse)' }}>Conspiram com você</p>
                    <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                      {view.you.conspirators.map((id) => {
                        const p = view.players.find((pl) => pl.id === id);
                        return p ? (
                          <span key={id} className="chip chip--eclipse">
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

      {revealed && (
        <motion.button
          className="btn btn-primary btn-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          disabled={pending === 'game:ackRole'}
          onClick={() => void act('game:ackRole')}
        >
          {pending === 'game:ackRole' ? <span className="spinner" aria-hidden /> : 'Guardei meu segredo'}
        </motion.button>
      )}
    </section>
  );
}

/* ===== Seleção de patrulha ===== */

function TeamSelect({ view, leaderName }: { view: PlayerView; leaderName: string }) {
  const act = useStore((s) => s.act);
  const pending = useStore((s) => s.pending);
  const size = view.teamSizes[view.round] ?? 0;
  const isLeader = view.you.isLeader;
  // Retoma o rascunho que o servidor já publica; reconectar não apaga a escolha em curso.
  const [picked, setPicked] = useState<string[]>(() => (isLeader ? view.draftTeam.slice(0, size) : []));

  const draftTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(draftTimer.current), []);

  /** Rascunho é conversa, não compromisso: vai atrasado e falha em silêncio. */
  function publishDraft(team: string[]) {
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      void act('game:draft', { team });
    }, 250);
  }

  function toggle(id: string) {
    const next = picked.includes(id)
      ? picked.filter((p) => p !== id)
      : picked.length < size
        ? [...picked, id]
        : picked;
    if (next === picked) return;
    setPicked(next);
    publishDraft(next);
  }

  const draft = isLeader ? picked : view.draftTeam;
  const proposing = pending === 'game:propose';

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
        {view.gamesPlayed === 0 && view.round === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            O número sob cada farol é o tamanho da patrulha · • = precisa de 2 sabotagens
          </p>
        )}

        <div className="players-grid" role={isLeader ? 'group' : undefined}>
          {view.players.map((p) => (
            <Medallion
              key={p.id}
              player={p}
              selected={draft.includes(p.id)}
              conspirator={view.you.conspirators?.includes(p.id) ?? false}
              badge={p.isLeader ? <span className="medallion-badge badge-leader" title="Comandante">★</span> : undefined}
              onClick={isLeader ? () => toggle(p.id) : undefined}
            />
          ))}
        </div>

        {!isLeader && (
          <p className="muted center" style={{ fontSize: 14 }} role="status">
            {draft.length > 0
              ? `${leaderName} está considerando…`
              : 'Converse: quem merece carregar a chama?'}
          </p>
        )}
      </div>

      <div className="sticky-actions">
        {isLeader ? (
          <button
            className="btn btn-primary btn-block"
            disabled={picked.length !== size || proposing}
            onClick={async () => {
              window.clearTimeout(draftTimer.current);
              if (await act('game:propose', { team: picked })) setPicked([]);
            }}
          >
            {proposing ? (
              <span className="spinner" aria-hidden />
            ) : picked.length === size ? (
              'Enviar patrulha para votação'
            ) : (
              `Selecionados ${picked.length} de ${size}`
            )}
          </button>
        ) : (
          <p className="muted center" style={{ fontSize: 13 }}>
            Aguarde a proposta. Depois, todos votam.
          </p>
        )}
      </div>
    </section>
  );
}

/* ===== Votação ===== */

function Voting({ view, leaderName }: { view: PlayerView; leaderName: string }) {
  const act = useStore((s) => s.act);
  const pending = useStore((s) => s.pending);
  const [choice, setChoice] = useState<boolean | null>(null);
  const voted = view.you.hasVoted;
  const sending = pending === 'game:vote';
  const firstGame = view.gamesPlayed === 0;

  return (
    <section className="stack" aria-label="Votação da patrulha">
      <div className="panel stack center">
        <p className="eyebrow">Proposta de {leaderName}</p>

        <RosterWaiting
          players={view.players}
          done={(p) => p.hasVoted}
          doneTitle="Já votou"
          label="Patrulha proposta e quem já votou"
          conspirators={view.you.conspirators}
          selected={(p) => p.onTeam}
        />

        {!voted ? (
          <div className="stack" style={{ width: '100%' }}>
            <p style={{ fontWeight: 600 }}>Esta patrulha deve partir?</p>
            <div className="choice-row">
              <button
                className={`choice-card choice-approve ${choice === true ? 'is-picked' : ''}`}
                aria-pressed={choice === true}
                onClick={() => setChoice(true)}
              >
                <span className="glyph">🔆</span>
                Aprovar
              </button>
              <button
                className={`choice-card choice-reject ${choice === false ? 'is-picked' : ''}`}
                aria-pressed={choice === false}
                onClick={() => setChoice(false)}
              >
                <span className="glyph">✕</span>
                Rejeitar
              </button>
            </div>

            {firstGame && (
              <p className="muted" style={{ fontSize: 13 }}>
                {view.attempt >= 2
                  ? 'Cuidado: 5 rejeições seguidas entregam a cidade ao Eclipse.'
                  : 'Aprovar envia a patrulha ao farol. Rejeitar passa o comando adiante: é assim que se mantém um suspeito fora da expedição.'}
              </p>
            )}

            <div className="sticky-actions">
              <AnimatePresence>
                {choice !== null && (
                  <motion.button
                    key="confirm"
                    className="btn btn-primary btn-block"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    disabled={sending}
                    onClick={() => void act('game:vote', { approve: choice })}
                  >
                    {sending ? (
                      <span className="spinner" aria-hidden />
                    ) : (
                      `Confirmar voto · ${choice ? 'Aprovar' : 'Rejeitar'}`
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <p className="muted center" style={{ fontSize: 12 }}>
              Voto público após a apuração · empate rejeita
            </p>
          </div>
        ) : (
          <div className="stack center">
            <p style={{ fontWeight: 600 }}>Voto registrado.</p>
            <p className="muted" style={{ fontSize: 12 }}>
              Voto público após a apuração · empate rejeita
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ===== Expedição ===== */

function Mission({ view }: { view: PlayerView }) {
  const act = useStore((s) => s.act);
  const pending = useStore((s) => s.pending);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const eclipse = view.you.faction === 'eclipse';
  const team = view.players.filter((p) => p.onTeam);
  const acting = view.you.onTeam && !view.you.hasPlayedCard;
  const sending = pending === 'game:card';

  function pick(light: boolean) {
    setBlocked(null);
    setChoice(light);
  }

  function confirm() {
    if (choice === null) return;
    // Sentinela que tenta apagar recebe a mesma recusa que o servidor daria:
    // local, breve e sem deixar rastro na tela de ninguém.
    if (!choice && !eclipse) {
      setChoice(null);
      setBlocked('A chama não obedece: Sentinelas só podem acender.');
      return;
    }
    void act('game:card', { light: choice });
  }

  return (
    <section className="stack" aria-label="Expedição em andamento">
      <div className="panel stack center">
        <p className="eyebrow">Expedição {view.round + 1}</p>

        <RosterWaiting
          players={team}
          done={(p) => p.hasPlayedCard}
          doneTitle="Já agiu"
          label="Patrulha no farol"
          conspirators={view.you.conspirators}
          selected={() => true}
        />

        {acting ? (
          <div className="stack" style={{ width: '100%' }}>
            <p style={{ fontWeight: 600 }}>A patrulha alcançou o farol. O que você faz?</p>
            <div className="choice-row">
              <button
                className={`choice-card choice-approve ${choice === true ? 'is-picked' : ''}`}
                aria-pressed={choice === true}
                onClick={() => pick(true)}
              >
                <span className="glyph">🔥</span>
                Acender
              </button>
              <button
                className={`choice-card choice-sabotage ${choice === false ? 'is-picked' : ''}`}
                aria-pressed={choice === false}
                onClick={() => pick(false)}
              >
                <span className="glyph">🌑</span>
                Apagar
              </button>
            </div>

            <AnimatePresence>
              {blocked && (
                <motion.p
                  key="blocked"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                >
                  {blocked}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="sticky-actions">
              <AnimatePresence>
                {choice !== null && (
                  <motion.button
                    key="confirm"
                    className="btn btn-primary btn-block"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    disabled={sending}
                    onClick={confirm}
                  >
                    {sending ? <span className="spinner" aria-hidden /> : 'Confirmar ação'}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Idêntico para as duas facções: a tela não denuncia ninguém. */}
            <p className="muted center" style={{ fontSize: 13 }}>
              Sua escolha é secreta. As ações são reveladas embaralhadas.
            </p>
          </div>
        ) : (
          <p className="muted center" style={{ fontSize: 14 }}>
            {view.you.onTeam ? 'Ação registrada. ' : ''}A patrulha age em segredo…
          </p>
        )}
      </div>
    </section>
  );
}

/* ===== Overlays de revelação ===== */

/** Quem herda o comando após uma rejeição. */
function nextLeaderName(
  players: PublicPlayer[],
  record: VoteRecord,
  currentLeaderId: string | null,
): string | null {
  if (currentLeaderId && currentLeaderId !== record.leaderId) {
    return players.find((p) => p.id === currentLeaderId)?.name ?? null;
  }
  const start = players.findIndex((p) => p.id === record.leaderId);
  if (start < 0) return null;
  for (let k = 1; k <= players.length; k++) {
    const p = players[(start + k) % players.length];
    if (p?.connected) return p.name;
  }
  return null;
}

function VoteRevealOverlay({
  record,
  players,
  currentLeaderId,
  onDone,
}: {
  record: VoteRecord;
  players: PublicPlayer[];
  currentLeaderId: string | null;
  onDone: () => void;
}) {
  // Ordem dos assentos, nunca a ordem em que votaram: hesitar não pode ser pista.
  const entries = useMemo(
    () =>
      players
        .filter((p) => p.id in record.votes)
        .map((p) => ({ id: p.id, name: p.name, approve: record.votes[p.id]! })),
    [players, record],
  );

  const [shown, setShown] = useState(0);
  const [verdict, setVerdict] = useState(false);
  const verdictDelay = 0.25 + entries.length * 0.09 + 0.3;

  useEffect(() => {
    const timers = entries.map((_, i) =>
      window.setTimeout(() => setShown((n) => Math.max(n, i + 1)), (0.25 + i * 0.09) * 1000 + 120),
    );
    const last = window.setTimeout(() => setVerdict(true), verdictDelay * 1000);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(last);
    };
  }, [entries, verdictDelay]);

  const counted = entries.slice(0, shown);
  const approvals = counted.filter((e) => e.approve).length;
  const heir = record.approved ? null : nextLeaderName(players, record, currentLeaderId);

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

        <div className="vote-chips">
          {entries.map((e, i) => (
            <motion.span
              key={e.id}
              className={`vote-chip ${e.approve ? 'approved' : 'rejected'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.09 }}
            >
              {e.approve ? '🔆' : '✕'} {e.name}
            </motion.span>
          ))}
        </div>

        <p className="muted center" style={{ fontSize: 14 }} aria-live="polite">
          {approvals} a favor · {counted.length - approvals} contra
        </p>

        <div style={{ minHeight: 78 }}>
          <AnimatePresence>
            {verdict && (
              <motion.div
                key="verdict"
                className="stack center"
                style={{ gap: 6 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2
                  className="display"
                  style={{ fontSize: 26, color: record.approved ? 'var(--flame)' : 'var(--danger)' }}
                >
                  {record.approved ? 'Patrulha aprovada' : 'Patrulha rejeitada'}
                </h2>
                {!record.approved && heir && (
                  <p className="muted" style={{ fontSize: 14 }}>
                    O comando passa a {heir}.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
  // Embaralha de verdade: a escura vinha sempre por último e entregava o desfecho.
  const cards = useMemo(() => {
    const arr = [
      ...Array.from({ length: record.team.length - record.failCount }, () => true),
      ...Array.from({ length: record.failCount }, () => false),
    ];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }, [record]);

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
                !success ? '' : `, mas esta expedição exigia ${record.failsRequired}.`
              }`}
        </motion.p>
        <button className="btn btn-primary btn-block" onClick={onDone}>
          Continuar
        </button>
      </motion.div>
    </motion.div>
  );
}
