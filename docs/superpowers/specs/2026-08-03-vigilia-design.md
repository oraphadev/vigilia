# VIGÍLIA: Design Doc

Jogo web multiplayer de dedução social, IP 100% original, inspirado apenas nas **mecânicas abstratas** do gênero popularizado por The Resistance.

## 1. Análise: mecânica × propriedade intelectual

Mecânicas de jogo (regras abstratas) **não são protegidas por copyright**; apenas a expressão criativa (nomes, arte, textos, tema). Mantemos as mecânicas, substituímos toda a expressão.

**Mecânicas preservadas (abstratas):**
- 5–10 jogadores; minoria informada (infiltrados se conhecem) × maioria desinformada.
- Infiltrados por nº de jogadores: 5–6 → 2, 7–9 → 3, 10 → 4.
- 5 rodadas de missão; tamanhos de equipe por rodada/nº de jogadores:
  - 5j: 2,3,2,3,3 · 6j: 2,3,4,3,4 · 7j: 2,3,3,4,4 · 8–10j: 3,4,4,5,5
- Líder rotativo propõe equipe → votação pública simultânea → maioria aprova (empate rejeita).
- 5 propostas rejeitadas consecutivas na mesma rodada → infiltrados vencem.
- Equipe aprovada joga cartas secretas (sucesso/sabotagem); leais só podem jogar sucesso; cartas reveladas embaralhadas; 1 sabotagem falha a missão, exceto rodada 4 com 7+ jogadores, que exige 2.
- Primeira facção a 3 missões vence. Sem eliminação de jogadores; informação assimétrica é o motor do jogo.

**Elementos NÃO copiados (IP do original):** nome "The Resistance", tema distópico corporativo/espiões, termos "Resistance/Spies/Imperial", arte, cartas ilustradas, textos do manual.

## 2. Universo original

- **Nome do jogo:** **VIGÍLIA**
- **Tema:** Lumen, a última cidade suspensa sobre o Mar de Bruma: uma névoa viva que devora tudo o que a luz não alcança. Torres-farol mantêm a cidade viva. Uma seita, o **Círculo do Eclipse**, infiltrou a guarda para apagar as luzes, uma a uma.
- **Facções:** **Sentinelas** (leais, maioria) × **Eclipse** (infiltrados, se reconhecem).
- **Papéis:** Sentinela da Chama / Agente do Eclipse (facção = papel; sem poderes especiais, fiel à mecânica base).
- **Terminologia:**
  - Líder da rodada → **Comandante**
  - Equipe da missão → **Patrulha**
  - Missão → **Expedição** (reacender um farol)
  - Carta de sucesso → **Acender** · Carta de sabotagem → **Apagar**
  - Trilha de 5 rejeições → **Colapso da Confiança**
- **Identidade visual:** noturno premium: índigo profundo quase-preto, brilho âmbar/dourado (lanternas) para os Sentinelas, ciano frio espectral para o Eclipse; painéis translúcidos, tipografia display serifada + sans limpa; animações de luz/névoa.

## 3. Arquitetura

Monorepo npm workspaces, TypeScript estrito em tudo:

- **`shared/`**: motor de regras **puro e determinístico** (zero I/O, RNG injetável), tipos, constantes, contratos de eventos socket, e **redação de estado por jogador** (anti-cheat). Toda regra de negócio vive aqui, desacoplada de UI e de rede. Testado com vitest.
- **`server/`**: Node + Express + Socket.IO. Autoridade total: valida cada ação contra o motor, mantém o estado canônico em memória, emite a cada jogador **apenas a visão redigida** (nunca papéis alheios, cartas individuais ou votos antes da revelação). Salas com código de 5 letras, token de sessão para reconexão, migração de anfitrião, remoção de desconectados no lobby.
- **`client/`**: Vite + React 19 + zustand + framer-motion. Máquina de telas dirigida pelo estado do servidor: Home → Lobby → (Revelação de papel → Seleção de patrulha → Votação → Revelação → Expedição → Resultado)×N → Fim → Reinício. Design system próprio (tokens CSS), responsivo mobile-first, onboarding/tutorial, histórico de rodadas, feedback visual em toda ação.

**Anti-cheat por construção:** o cliente é burro; papéis dos outros só chegam ao socket de um agente Eclipse; cartas de expedição chegam agregadas e embaralhadas; votos só após todos votarem. Nenhuma validação depende do cliente.

**Reconexão:** token em localStorage → `auth` no handshake → reanexa ao jogador; badge de desconectado; partida não trava permanentemente (ações pendentes ficam aguardando, anfitrião pode reiniciar).

**Fim/Reinício:** vitória por 3 expedições (qualquer facção) ou Colapso da Confiança (Eclipse). "Jogar novamente" repõe todos no lobby, redistribui papéis, gira o comandante inicial.

## 4. Testes / Qualidade

- Motor: suíte vitest cobrindo distribuição de papéis, tabelas, rotação, votação/empate/colapso, sabotagem (incl. regra da 4ª expedição), vitórias, reinício e redação de estado.
- Integração: simulação de partida completa com 5+ clientes socket reais contra o servidor.
- Revisão final: regras, UX, duplicação, performance, visual.
