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

- **Antes da partida:** escolha a(s) **prova(s)** e as **áreas** em disputa (a roleta só tem as áreas escolhidas), e se a partida é rápida ou longa.
- **Partida estilo Perguntados:** roleta, 2 minutos por questão, medidor de coroa, questão da coroa, vitória por coroas; bots (Interno → Especialista), PvP local e **PvP online**.
- **Online (Supabase):** login por e-mail/senha, **buscar adversário** (rating parecido, janela crescente, oferta de BOT se ninguém aparecer), **sala privada com código/link**, partida sincronizada em tempo real, **ranking de jogadores** (geral, semanal, rating e por área).
- **Relatório de fim de partida:** todas as questões respondidas, acerto/erro, sua resposta × correta, enunciado completo, recorte da **questão original do PDF** e opção de **salvar em PDF/imprimir**. Também acessível pelo histórico no Perfil.
- **Fidelidade:** texto extraído do PDF com correção da hifenização e, para cada questão, o recorte da página original ("ver questão original").
- Progressão (XP, níveis, coins, missões, conquistas, streak), itens (fora do online), estatísticas, questões erradas, treino, loja.

## Configurar o online (uma vez)

1. Crie um projeto grátis em https://supabase.com.
2. **SQL Editor** → cole `supabase/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: deixe habilitado. Para testar rápido, desative *Confirm email* (senão cada cadastro precisa confirmar pelo e-mail). Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL*.
4. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para `public/online-config.json`:
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
   ```
   (a chave anon é pública por design; a segurança vem das regras RLS do schema). Sem esse arquivo preenchido, o jogo funciona offline e esconde o online.

Modelo de confiança: as estatísticas do perfil (XP, rating) são enviadas pelo próprio cliente — adequado para um grupo de estudo; para competição aberta, mover o cálculo de rating para funções no servidor.

## Adicionar questões / provas

As questões **não são editadas no app**. Para adicionar uma prova, envie o PDF ao Claude neste repositório; o pipeline faz o resto:

```bash
pip install pymupdf
python3 tools/extract_unoeste.py prova.pdf      # texto, gabarito, anuladas, imagens e recortes originais
# registrar a prova em tools/exams.json (id, título, faixas de categoria)
npm run bank                                     # gera public/banco/*.json
```
Explicações/subtemas opcionais em `tools/annotations/<id>.txt` (formato descrito em `tools/build_bank.py`).

## Testes locais do online

`npm run dev` e abra `/?online=mock&slot=A` e `/?online=mock&slot=B` em duas abas: um backend simulado no navegador permite jogar os dois lados sem Supabase.

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
  services/     questionRepo (banco estático), playerRepo (localStorage), online/ (Supabase + backend simulado), rankings
  state/        store React: liga UI ↔ motor ↔ repositórios
  ui/ screens/  componentes e telas
```

**Motor ≠ banco ≠ interface.** O motor recebe estado e devolve novo estado e eventos. A interface só desenha e toca sons. As questões ficam em JSON, nunca nos componentes. O banco base é carregado por `fetch`. 

**Anti-repetição** (`engine/selection.ts`): a escolha da questão é aleatória com pesos. Questões nunca vistas têm peso alto. Questões erradas voltam depois de algumas horas, como revisão. Questões acertadas reaparecem devagar, conforme o tempo passa. Questões vistas há menos de 30 min quase nunca saem. Na partida, a mesma questão não se repete, nem entre os dois jogadores.

**Integridade:** a resposta sempre vem do gabarito oficial. Questões **anuladas** nunca entram em partidas normais. No treino, elas entram só se a opção estiver ligada em Ajustes. Questões **divergentes** só aparecem no treino, com um aviso.

## Como alterar categorias

Edite `src/data/categories.ts` (nome, ícone, cor) e o tipo `CategoryId` em `src/types/index.ts`. A roleta, os filtros, as estatísticas e os rankings se ajustam sozinhos. As palavras-chave da classificação automática ficam em `src/engine/classify.ts`.

## O que ainda falta

- Explicações: só 2022 Q1–20 têm explicação; as demais mostram o gabarito oficial.
- Subtemas/dificuldade estimados automaticamente (muitos ficam "Geral").
- Rating calculado no cliente (ver "Modelo de confiança").
