import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './shared.js';
import { useStore } from '../store.js';

/** As três frases que bastam para começar a jogar. */
const ESSENTIALS: string[] = [
  'Cada vigilante recebe um papel secreto. A maioria é Sentinela; os infiltrados do Eclipse são minoria e se conhecem entre si.',
  'O Comandante propõe uma patrulha, todos votam, e a patrulha aprovada age em segredo.',
  '3 faróis acesos: as Sentinelas vencem. 3 apagados, ou 5 propostas rejeitadas seguidas: o Eclipse vence.',
];

/** Páginas detalhadas: o mesmo tour de sempre, agora atrás do essencial. */
const DETAILS: { title: string; body: string }[] = [
  {
    title: 'Bem-vindo a Lumen',
    body: 'A última cidade flutua sobre um mar de névoa que devora tudo o que a luz não alcança. Cinco faróis a mantêm viva. E alguns entre vocês querem apagá-los.',
  },
  {
    title: 'Dois lados, um segredo',
    body: 'A maioria são Sentinelas da Chama, leais à cidade. Alguns são agentes do Eclipse: eles se conhecem, você não sabe quem são. Seu papel é secreto: observe, converse, desconfie.',
  },
  {
    title: 'A patrulha e o voto',
    body: 'A cada expedição, o Comandante da vez propõe uma patrulha. Todos votam: aprovar ou rejeitar. Empate rejeita. Cuidado: cinco rejeições seguidas entregam a cidade ao Eclipse.',
  },
  {
    title: 'A expedição',
    body: 'A patrulha aprovada age em segredo: Sentinelas sempre acendem o farol; agentes do Eclipse podem apagá-lo. Uma única sabotagem basta para a expedição falhar (algumas exigem duas, marcadas com •).',
  },
  {
    title: 'Como vencer',
    body: 'Acenda 3 faróis e as Sentinelas vencem. Apague 3 e o Eclipse toma a cidade. Ninguém é eliminado: a partida inteira é conversa, blefe e dedução.',
  },
];

const TOTAL = DETAILS.length + 1;

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const markTutorialSeen = useStore((s) => s.markTutorialSeen);
  const [page, setPage] = useState(0);

  // Toda abertura recomeça pelo essencial.
  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  /** Concluir é o único caminho que marca o tutorial como visto. */
  function finish() {
    markTutorialSeen();
    onClose();
  }

  const title = page === 0 ? 'O essencial' : DETAILS[page - 1]!.title;

  return (
    <Modal open={open} onClose={onClose} label="Como jogar">
      <div className="stack" style={{ gap: 18 }}>
        <p className="eyebrow">
          Como jogar · {page + 1} de {TOTAL}
        </p>
        <h2 className="display" style={{ fontSize: 26 }}>
          {title}
        </h2>

        {page === 0 ? <Essentials /> : <p style={{ minHeight: 96 }}>{DETAILS[page - 1]!.body}</p>}

        <Dots page={page} onPick={setPage} />

        <div className="stack" style={{ gap: 10 }}>
          {page === 0 ? (
            <>
              <button className="btn btn-primary btn-block" onClick={finish}>
                Estou pronto
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setPage(1)}>
                Ver regras completas
              </button>
            </>
          ) : (
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              {page < TOTAL - 1 ? (
                <button className="btn btn-primary grow" onClick={() => setPage(page + 1)}>
                  Continuar
                </button>
              ) : (
                <button className="btn btn-primary grow" onClick={finish}>
                  Estou pronto
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Essentials() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <ul className="stack" style={{ gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
        {ESSENTIALS.map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                flex: '0 0 auto',
                width: 7,
                height: 7,
                marginTop: 8,
                borderRadius: '50%',
                background: 'var(--flame)',
                boxShadow: '0 0 8px rgba(255, 217, 138, 0.8)',
              }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <p
        style={{
          borderLeft: '2px solid var(--flame)',
          borderRadius: 4,
          background: 'rgba(240, 169, 60, 0.08)',
          padding: '12px 14px',
          lineHeight: 1.5,
        }}
      >
        VIGÍLIA se joga conversando: fiquem na mesma sala ou numa chamada de voz. O app registra propostas, votos e
        resultados; a acusação, o blefe e a defesa acontecem entre vocês.
      </p>
    </div>
  );
}

/** Pontos de navegação: alvo de toque de 44px em volta de cada .pip. */
function Dots({ page, onPick }: { page: number; onPick: (page: number) => void }): ReactNode {
  return (
    <div className="tutorial-dots" style={{ gap: 0, flexWrap: 'wrap' }}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Página ${i + 1} de ${TOTAL}`}
          aria-current={i === page ? 'true' : undefined}
          onClick={() => onPick(i)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            padding: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <span className={`pip ${i === page ? 'is-active' : ''}`} />
        </button>
      ))}
    </div>
  );
}
