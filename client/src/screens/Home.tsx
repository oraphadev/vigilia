import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MAX_NAME_LENGTH } from '@vigilia/shared';
import { AVATAR_GLYPHS, FlameMark, Stage } from '../components/shared.js';
import { HowToPlay } from '../components/HowToPlay.js';
import { useStore } from '../store.js';

/** Lê ?sala=ABCDE uma única vez, já no primeiro render. */
function invitedCodeFromUrl(): string {
  return (new URLSearchParams(location.search).get('sala') ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5);
}

export function Home() {
  const { name, setName, avatar, setAvatar, createRoom, joinRoom, busy, tutorialSeen } = useStore();
  const [invitedCode] = useState(invitedCodeFromUrl);
  const invited = invitedCode.length > 0;

  const [mode, setMode] = useState<'menu' | 'join'>(invited ? 'join' : 'menu');
  const [code, setCode] = useState(invitedCode);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const nameValid = name.trim().length >= 2;
  const codeValid = code.trim().length === 5;

  // Primeira visita abre o tutorial — mas nunca por cima de quem chegou por convite.
  useEffect(() => {
    if (!tutorialSeen && !invited) setTutorialOpen(true);
  }, [tutorialSeen, invited]);

  // Convidado sem nome: o campo certo já vem em foco.
  useEffect(() => {
    if (invited && !nameValid) nameRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invited]);

  const nameMessage = nameValid
    ? null
    : invited
      ? `Diga seu nome para entrar na sala ${invitedCode}.`
      : nameTouched
        ? 'Use ao menos 2 letras.'
        : 'Escreva seu nome para começar.';
  const nameInvalid = nameTouched && !nameValid;

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
            ref={nameRef}
            className="input"
            placeholder="Como a cidade vai te chamar?"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            autoComplete="nickname"
            enterKeyHint="next"
            aria-invalid={nameInvalid || undefined}
            aria-describedby={nameMessage ? 'name-help' : undefined}
          />
          {nameMessage && (
            <p
              id="name-help"
              aria-live="polite"
              style={{ fontSize: 13, color: nameInvalid ? 'var(--danger)' : 'var(--faded)' }}
            >
              {nameMessage}
            </p>
          )}
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
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameValid) {
                setNameTouched(true);
                nameRef.current?.focus();
                return;
              }
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
                autoFocus={!invited}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
              />
            </div>
            <div className="row">
              <button type="button" className="btn btn-ghost" onClick={() => setMode('menu')}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primary grow" disabled={!nameValid || !codeValid || busy}>
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

      <HowToPlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </Stage>
  );
}
