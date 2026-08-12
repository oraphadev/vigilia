import { useEffect } from 'react';
import { Stage } from './components/shared.js';
import { Game } from './screens/Game.js';
import { GameOver } from './screens/GameOver.js';
import { Home } from './screens/Home.js';
import { Lobby } from './screens/Lobby.js';
import { useStore } from './store.js';

export function App() {
  const stage = useStore((s) => s.stage);
  const view = useStore((s) => s.view);
  const displaced = useStore((s) => s.displaced);
  const boot = useStore((s) => s.boot);

  useEffect(() => boot(), [boot]);

  // Duas abas se deslocando em loop é pior que uma parada: aqui o jogo fica
  // suspenso até alguém escolher, explicitamente, esta aba.
  if (displaced) return <Displaced />;

  if (stage === 'boot') {
    return (
      <Stage>
        <div className="stack center" style={{ paddingTop: '38vh' }}>
          <span className="spinner" style={{ width: 28, height: 28, alignSelf: 'center' }} aria-hidden />
          <p className="muted">Acendendo as lanternas…</p>
        </div>
      </Stage>
    );
  }

  if (stage === 'home' || !view) return <Home />;
  if (view.phase === 'lobby') return <Lobby view={view} />;
  if (view.phase === 'gameOver') return <GameOver view={view} />;
  return <Game view={view} />;
}

function Displaced() {
  const resumeHere = useStore((s) => s.resumeHere);
  return (
    <Stage>
      <section className="panel stack center" style={{ marginTop: '18vh' }}>
        <p className="eyebrow">Vigília interrompida</p>
        <h1 className="display" style={{ fontSize: 26 }}>
          Você abriu VIGÍLIA em outra aba.
        </h1>
        <p className="muted">
          A partida continua lá. Para jogar daqui, retome a vigília nesta aba. A outra será
          encerrada.
        </p>
        <button type="button" className="btn btn-primary" onClick={resumeHere}>
          Jogar nesta aba
        </button>
      </section>
    </Stage>
  );
}
