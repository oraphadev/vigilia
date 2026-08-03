import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { MAX_NAME_LENGTH } from '@vigilia/shared';
import { AVATAR_GLYPHS, FlameMark, Modal, Stage } from '../components/shared.js';
import { useStore } from '../store.js';

const TUTORIAL_PAGES: { title: string; body: string }[] = [
  {
    title: 'Bem-vindo a Lumen',
    body: 'A última cidade flutua sobre um mar de névoa que devora tudo o que a luz não alcança. Cinco faróis a mantêm viva — e alguém entre vocês quer apagá-los.',
  },
  {
    title: 'Dois lados, um segredo',
    body: 'A maioria são Sentinelas da Chama, leais à cidade. Alguns são agentes do Eclipse: eles se conhecem, você não sabe quem são. Seu papel é secreto — observe, converse, desconfie.',
  },
  {
    title: 'A patrulha e o voto',
    body: 'A cada expedição, o Comandante da vez propõe uma patrulha. Todos votam: aprovar ou rejeitar. Empate rejeita. Cuidado — cinco rejeições seguidas entregam a cidade ao Eclipse.',
  },
  {
    title: 'A expedição',
    body: 'A patrulha aprovada age em segredo: Sentinelas sempre acendem o farol; agentes do Eclipse podem apagá-lo. Uma única sabotagem basta para a expedição falhar (algumas exigem duas — marcadas com •).',
  },
  {
    title: 'Como vencer',
    body: 'Acenda 3 faróis e os Sentinelas vencem. Apague 3 e o Eclipse toma a cidade. Ninguém é eliminado: a partida inteira é conversa, blefe e dedução.',
  },
];

export function Home() {
  const { name, setName, avatar, setAvatar, createRoom, joinRoom, busy, tutorialSeen, markTutorialSeen } = useStore();
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [code, setCode] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [page, setPage] = useState(0);

  // Onboarding: abre o tutorial automaticamente na primeira visita.
  useEffect(() => {
    if (!tutorialSeen) setTutorialOpen(true);
  }, [tutorialSeen]);

  // Link de convite (?sala=ABCDE) pré-preenche o código.
  useEffect(() => {
    const invited = new URLSearchParams(location.search).get('sala');
    if (invited) {
      setCode(invited.toUpperCase().slice(0, 5));
      setMode('join');
    }
  }, []);

  const nameValid = name.trim().length >= 2;
  const codeValid = code.trim().length === 5;

  function closeTutorial() {
    setTutorialOpen(false);
    setPage(0);
    markTutorialSeen();
  }

  return (
    <Stage>
      <motion.header
        className="stack center"
        style={{ paddingTop: '8vh' }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <FlameMark />
        <h1 className="wordmark">VIGÍLIA</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          Mantenha as luzes acesas. Ou apague-as por dentro.
        </p>
      </motion.header>

      <motion.section
        className="panel stack"
        aria-label="Identidade do vigilante"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6, ease: 'easeOut' }}
      >
        <div className="field">
          <label htmlFor="name">Seu nome de vigilante</label>
          <input
            id="name"
            className="input"
            placeholder="Como a cidade vai te chamar?"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </div>

        <div className="field">
          <label>Seu emblema</label>
          <div className="avatar-row" role="radiogroup" aria-label="Escolha um emblema">
            {AVATAR_GLYPHS.map((glyph, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={avatar === i}
                className={`avatar-option ${avatar === i ? 'is-selected' : ''}`}
                onClick={() => setAvatar(i)}
              >
                {glyph}
              </button>
            ))}
          </div>
        </div>

        {mode === 'menu' ? (
          <div className="stack">
            <button className="btn btn-primary btn-block" disabled={!nameValid || busy} onClick={createRoom}>
              Acender uma sala
            </button>
            <button className="btn btn-ghost btn-block" disabled={!nameValid || busy} onClick={() => setMode('join')}>
              Entrar com código
            </button>
            {!nameValid && <p className="muted center" style={{ fontSize: 13 }}>Escreva seu nome para começar.</p>}
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeValid) void joinRoom(code);
            }}
          >
            <div className="field">
              <label htmlFor="code">Código da sala</label>
              <input
                id="code"
                className="input input-code"
                placeholder="•••••"
                value={code}
                maxLength={5}
                onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setMode('menu')}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary grow" disabled={!codeValid || busy}>
                Entrar na sala
              </button>
            </div>
          </form>
        )}
      </motion.section>

      <motion.footer
        className="center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <button className="btn btn-ghost btn-sm" onClick={() => setTutorialOpen(true)}>
          Como jogar
        </button>
      </motion.footer>

      <Modal open={tutorialOpen} onClose={closeTutorial} label="Como jogar">
        <div className="stack" style={{ gap: 18 }}>
          <p className="eyebrow">Como jogar · {page + 1} de {TUTORIAL_PAGES.length}</p>
          <h2 className="display" style={{ fontSize: 26 }}>
            {TUTORIAL_PAGES[page]!.title}
          </h2>
          <p style={{ minHeight: 96 }}>{TUTORIAL_PAGES[page]!.body}</p>
          <div className="tutorial-dots">
            {TUTORIAL_PAGES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Página ${i + 1}`}
                className={`pip ${i === page ? 'is-active' : ''}`}
                onClick={() => setPage(i)}
              />
            ))}
          </div>
          <div className="row">
            {page > 0 && (
              <button className="btn btn-ghost" onClick={() => setPage(page - 1)}>
                Anterior
              </button>
            )}
            {page < TUTORIAL_PAGES.length - 1 ? (
              <button className="btn btn-primary grow" onClick={() => setPage(page + 1)}>
                Continuar
              </button>
            ) : (
              <button className="btn btn-primary grow" onClick={closeTutorial}>
                Estou pronto
              </button>
            )}
          </div>
        </div>
      </Modal>
    </Stage>
  );
}
