# 🩺 Residuelo — duelos de questões de residência médica

Jogo web estilo **Perguntados** para estudar para provas de residência médica. Você gira a roleta, responde questões **reais** de provas anteriores, junta coroas das 5 grandes áreas e sobe de nível. Na prática, cada partida tem de 10 a 20 questões de prova.

- **5 categorias:** GO · Clínica · Cirurgia · Preventiva · Pediatria
- **Banco inicial:** 500 questões das provas **UNOESTE/HRPP R1 Acesso Direto 2022 a 2026**, com o gabarito oficial, 6 questões anuladas sinalizadas e 26 imagens (ECG, TC, RX)

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build em dist/
```

## O que já funciona

| Área | Recursos |
|---|---|
| **Partida PvP** | Roleta animada (física de desaceleração e som de pinos), questão da categoria sorteada, timer, feedback imediato. A vez alterna entre os jogadores. Cada acerto enche o **medidor de coroa**. Com o medidor cheio, você escolhe a coroa e responde a **questão da coroa**. Vence quem juntar **3 coroas** (partida rápida) ou **5** (partida longa). Se as rodadas acabarem, o desempate é por coroas e depois por pontos. Tem **revanche** e desistência. |
| **Adversários** | Bots Interno, R1, R2, R3 e Especialista. Cada bot tem pontos fortes e fracos por área. Acertar ou errar uma questão é determinístico para cada par bot/questão, então o bot não parece aleatório. O tempo de resposta acompanha o tamanho do enunciado. Há também **PvP local** (2 perfis no mesmo aparelho). |
| **Ranqueado** | Rating Elo e ligas de Bronze a Grão-Mestre. O matchmaking amplia a faixa de rating aos poucos e, em ~7 s, oferece "Jogar contra BOT". |
| **Treino** | 10, 20 ou 50 questões, ou modo infinito. Filtros por categoria e por prova, e opção "somente as que errei". |
| **Pontuação** | Por dificuldade: 100/150/200/250. A velocidade vale no máximo +20% e só conta em acertos. A sequência de acertos vale até +50%. Questão de coroa: +100. |
| **Progressão** | XP e nível com títulos temáticos (Calouro → … → R1 → R3 → Especialista → Lenda). Cada categoria tem nível próprio. Há coins, streak diário com recompensa, 4 missões diárias e 30 conquistas. |
| **Itens** | 50/50, tempo extra, segunda chance, dica e troca de questão. Vêm de missões, níveis, recompensa diária ou da loja (só com coins do jogo). No ranqueado, o limite é de 2 itens por partida. |
| **Loja / perfil** | Avatares, molduras, efeitos de acerto e títulos, alguns liberados por nível. Perfil com estatísticas completas e histórico de partidas. |
| **Estudo** | "Meu desempenho": acerto por categoria, subtema e dificuldade, evolução no tempo, pontos fracos e recomendação de estudo. "Questões erradas": filtros e o botão **Refazer questões erradas**. "Banco de questões": consultas como "quantas de Cirurgia?", "quais de trauma?", "quais errei?" e "quais nunca respondi?". |
| **Admin** | Adicionar, editar e excluir questões. Alterar resposta, categoria, dificuldade, status e explicação. Classificação automática. **Importar prova** em PDF, TXT, CSV ou JSON, com tela de revisão (categoria, resposta, dificuldade e APROVAR). Estatísticas e exportação em JSON/CSV. |
| **Outros** | Sons sintetizados (WebAudio) com liga/desliga, confete, animações, design responsivo, exportar/importar progresso. |

## Arquitetura

```
public/banco/               ← BANCO DE QUESTÕES (dados, separados do código)
  index.json                   lista de provas
  unoeste-2022.json …          uma prova por arquivo: { exam, questions[] }
  img/                         imagens das questões
tools/                      ← pipeline do banco (Python)
  extract_unoeste.py           PDF → tools/raw/*.json (enunciado, alternativas, gabarito, anuladas, imagens)
  annotations/*.txt            anotações pedagógicas opcionais (subtema, dificuldade, explicações)
  exams.json                   metadados + faixas de categoria de cada prova
  build_bank.py                raw + anotações → public/banco/*.json
src/
  types/        modelo de dados em "tabelas": Question, Player (USERS), AnswerRecord (ANSWERS), MatchSummary (MATCHES), RankingEntry…
  data/         conteúdo de jogo: categorias, níveis/ligas, bots, loja, conquistas, missões
  engine/       regras puras, sem React: match.ts (máquina de estados da partida), scoring, elo, selection (anti-repetição), bot, player (XP, missões, conquistas), stats, classify, importers/
  services/     repositórios: questionRepo (banco base + IndexedDB), playerRepo (localStorage), matchmaking, rankings, pdf (pdf.js)
  state/        store React: liga UI ↔ motor ↔ repositórios
  ui/ screens/  componentes e telas
```

**Motor ≠ banco ≠ interface.** O motor recebe estado e devolve novo estado e eventos. A interface só desenha e toca sons. As questões ficam em JSON, nunca nos componentes. O banco base é carregado por `fetch`. As edições do Admin ficam no IndexedDB, como uma camada por cima do banco base.

**Anti-repetição** (`engine/selection.ts`): a escolha da questão é aleatória com pesos. Questões nunca vistas têm peso alto. Questões erradas voltam depois de algumas horas, como revisão. Questões acertadas reaparecem devagar, conforme o tempo passa. Questões vistas há menos de 30 min quase nunca saem. Na partida, a mesma questão não se repete, nem entre os dois jogadores.

**Integridade:** a resposta sempre vem do gabarito oficial. Questões **anuladas** nunca entram em partidas normais. No treino, elas entram só se a opção estiver ligada em Ajustes. Questões **divergentes** só aparecem no treino, com um aviso.

## Onde ficam as questões e como adicionar

1. **Pelo app (mais fácil):** Admin → *Questões* → **+ Nova questão**, ou Admin → **Importar prova**.
   - **PDF/TXT:** o parser detecta a numeração (`1)`, `1 -`, `1.`), as alternativas A–E e o gabarito no fim do arquivo, em grade ou em pares (`1-A`, com `X` para anulada). Você informa instituição, ano e, se quiser, as faixas de categoria (ex.: `1-20 CLI; 21-40 CIR; 41-60 PED; 61-80 GO; 81-100 PRE`). Depois revisa cada questão e aprova.
   - **CSV:** colunas `numero, enunciado, a, b, c, d, e, resposta, categoria, subtema, dificuldade, explicacao, explicacao_completa, referencia`.
   - **JSON:** um array no mesmo formato de `public/banco/*.json`.

   O que você importa ou edita fica salvo **neste navegador**. Para tornar permanente no projeto, use Admin → Exportar (JSON) e coloque o arquivo em `public/banco/`, registrando-o no `index.json`.
2. **Pelo pipeline (em lote, provas no formato UNOESTE):**
   ```bash
   pip install pymupdf
   python3 tools/extract_unoeste.py prova-2027.pdf     # gera tools/raw/unoeste-2027.json + imagens
   # adicione a prova em tools/exams.json (id, título, faixas de categoria)
   npm run bank                                         # gera public/banco/*.json e index.json
   ```
   Explicações, subtemas e dificuldades revisados vão em `tools/annotations/<id>.txt`:
   ```
   #12 CLI | Hipertensão arterial | 2
   S: explicação curta
   F: explicação completa
   D: (opcional) nota de divergência de gabarito → status "divergente"
   ```

## Como alterar categorias

Edite `src/data/categories.ts` (nome, ícone, cor) e o tipo `CategoryId` em `src/types/index.ts`. A roleta, os filtros, as estatísticas e os rankings se ajustam sozinhos. As palavras-chave da classificação automática ficam em `src/engine/classify.ts`.

## Do BOT ao multiplayer online

A partida já é uma **máquina de estados serializável** (`engine/match.ts`: `createMatch → applySpin/applyCrownChoice → setQuestion → applyAnswer → advance`). Para jogar online:

1. **Backend** (Supabase/Firebase/PostgreSQL): criar as tabelas `questions`, `users`, `answers`, `matches`, `rankings`, espelhando `src/types`.
2. **Repositórios:** implementar `QuestionRepository` e `PlayerRepository` com o novo backend. A interface já está definida, então as telas não mudam.
3. **Matchmaking:** implementar `MatchmakingService.search` com uma fila no servidor, mantendo a lógica de faixa crescente de rating e o fallback para bot.
4. **Partida:** o servidor é a autoridade. Ele roda `engine/match.ts`, sorteia a roleta e a questão, e valida a resposta. A resposta correta não deve ir para o cliente antes do envio. Os clientes recebem o `MatchState` por realtime (Supabase Realtime, Firestore ou WebSocket). O turno de um humano remoto substitui o `botStep` em `MatchScreen`.
5. **Rankings:** trocar `services/rankings.ts` por consultas agregadas no servidor, incluindo o reset semanal.

## O que ainda falta

- **Explicações:** só 2022 Q1–20 têm explicação curta e completa. As outras 480 mostram o gabarito oficial e "explicação ainda não cadastrada", e podem ser preenchidas no Admin ou em `tools/annotations/`.
- **Subtemas e dificuldade** das questões sem anotação são **estimados automaticamente** por palavras-chave. Muitas ficam como "Geral" e vale revisar. O desempenho dos jogadores também ajusta a estimativa de dificuldade ao reclassificar uma questão.
- **Alternativas:** as provas da UNOESTE têm **5 alternativas (A–E)**. Elas foram mantidas assim para preservar a questão original e o gabarito, e o jogo aceita 4 ou 5.
- **Formatos de PDF:** o importador no navegador funciona bem com o formato UNOESTE. PDFs escaneados (sem texto) precisariam de OCR.
- **Multiplayer online real**, contas e login, e proteção de acesso ao Admin (hoje é local e aberto).
- **Ranking global:** hoje o ranking é local, com os perfis do aparelho mais os bots.
- Desafios semanais e temporadas do ranqueado.
