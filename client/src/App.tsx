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
  const boot = useStore((s) => s.boot);

  useEffect(() => boot(), [boot]);

  if (stage === 'boot') {
    return (
      <Stage>
        <div className="stack center" style={{ paddingTop: '38vh' }}>
          <span className="spinner" style={{ width: 28, height: 28 }} aria-hidden />
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
