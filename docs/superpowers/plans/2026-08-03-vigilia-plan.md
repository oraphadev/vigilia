# VIGÍLIA: Plano de implementação

Ordem de execução (cada etapa termina compilando/testando):

1. **Scaffold**: npm workspaces (`shared`, `server`, `client`), tsconfig estrito, vitest, .gitignore.
2. **`shared`**: `types.ts`, `constants.ts` (tabelas), `engine.ts` (reducer puro: lobby→papéis→proposta→voto→expedição→placar→fim→reinício), `redact.ts` (visão por jogador), `protocol.ts` (eventos socket tipados). Testes vitest do motor e da redação.
3. **`server`**: `RoomManager` (códigos, tokens de sessão, TTL), `Room` (aplica ações via motor, broadcast redigido), Socket.IO handlers, Express estático para build do client.
4. **`client`**: socket client + zustand store com rejoin; design system (tokens css); telas Home/Lobby/Jogo/Fim; componentes de fase; histórico; tutorial; animações framer-motion.
5. **Integração**: script de simulação com 5 clientes socket jogando uma partida completa (vitórias de ambos os lados + colapso).
6. **Revisão final**: regras, UX, duplicação, performance, ajustes visuais; smoke test visual via Playwright.
