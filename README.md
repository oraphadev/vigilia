# VIGÍLIA

> Mantenha as luzes acesas. Ou apague-as por dentro.

**Jogue agora: [joguevigilia.com.br](https://joguevigilia.com.br)**

Jogo web multiplayer de **dedução social** para 5–10 jogadores, com IP 100% original.
Lumen, a última cidade, flutua sobre um mar de névoa viva. Cinco faróis a mantêm de pé —
e o **Círculo do Eclipse** infiltrou a guarda para apagá-los, um a um.

- **Sentinelas da Chama** (maioria leal): acendam 3 faróis para vencer.
- **Agentes do Eclipse** (minoria infiltrada, que se conhece): apaguem 3 faróis — ou
  derrubem a confiança da cidade com 5 patrulhas rejeitadas seguidas (**Colapso da Confiança**).

O jogo é inspirado apenas nas **mecânicas abstratas** do gênero (liderança rotativa,
votação pública, missões com sabotagem secreta); universo, nomes, termos e identidade
visual são originais. Análise completa em `docs/superpowers/specs/`.

## Rodando

```bash
pnpm install
pnpm dev        # server em :3210 + Vite em :5173 (proxy de websocket)
```

Abra http://localhost:5173 em várias abas/aparelhos para jogar. Precisa de gente?
`npx tsx scripts/bots.ts CODIGO 4` coloca 4 bots na sala.

### Produção (Docker)

```bash
docker compose up --build   # http://localhost:3210
```

### Testes

```bash
pnpm test         # motor de regras + redação anti-cheat (vitest)
pnpm typecheck    # todos os workspaces
npx tsx scripts/simulate.ts   # partida completa com 5 clientes socket reais (servidor no ar)
```

## Arquitetura

| Workspace | Papel |
| --- | --- |
| `shared/` | Motor de regras **puro** (RNG injetável, zero I/O), tipos, contratos socket e **redação de estado por jogador**. Toda regra de negócio vive aqui, desacoplada de rede e UI. |
| `server/` | Node + Express + Socket.IO. **Autoridade total**: valida cada ação no motor e emite a cada jogador apenas a sua visão redigida. Salas por código, reconexão por token, migração de anfitrião com carência. |
| `client/` | Vite + React 19 + zustand + framer-motion. Máquina de telas dirigida pelo estado do servidor; design system próprio; mobile-first. |

**Anti-cheat por construção:** papéis alheios só chegam ao socket de um agente do Eclipse;
votos individuais só após a apuração; cartas de expedição só agregadas e embaralhadas.
Sentinela tentando sabotar é recusado pelo servidor.

**Reconexão:** o token de sessão em `localStorage` reanexa o jogador à partida em andamento;
um refresh não perde o lugar nem destrona o anfitrião (carência de 15 s).
