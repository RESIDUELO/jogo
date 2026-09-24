# 🩺 Residuelo — duelos de flashcards de residência médica

Jogo web estilo **Perguntados** com **flashcards** de residência médica. Você gira a roleta, responde cartões das 5 grandes áreas, junta coroas e sobe de nível.

- **5 grandes áreas:** GO · Clínica · Cirurgia · Preventiva · Pediatria, cada uma com subtemas aninhados (ex.: Clínica › Cardiologia › Arritmias I)
- **Baralho atual:** 5801 flashcards (91 baralhos MEDCARDS)

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build em dist/
```

## O que já funciona

- **Antes da partida**, quem cria a partida/sala escolhe: **temas** (grandes áreas e subtemas, com caixas de seleção em árvore), **tempo por rodada** (15 s a 2 min) e partida rápida/longa. Na vez de responder, você vê a pergunta, mostra a resposta e diz se acertou. A roleta só tem as áreas escolhidas.
- **Quem espera a vez vê a pergunta** que o adversário está respondendo e, depois, a resposta e o resultado.
- Bots (Interno → Especialista), PvP local e **PvP online** (Supabase: conta ou visitante, **sala de espera** (lista de quem está disponível; convite que a outra pessoa aceita ou recusa), sala com código, ranking).
- **Relatório de fim de partida** com cada cartão, acerto/erro e resposta; **Baralho** para navegar, buscar e **baixar** cartões (.txt ou .apkg do Anki, de tudo ou de qualquer área/subtema); treino, cartões errados, estatísticas, XP, missões, conquistas, loja.

## Publicação

A cada push, o GitHub Actions (`.github/workflows/build.yml`) compila o site e o publica no GitHub Pages (branch `gh-pages`). O site é um app instalável (PWA) e funciona offline depois da primeira abertura. O GitHub Pages gratuito exige repositório **público**.

## Configurar o online (uma vez)

1. Crie um projeto grátis em https://supabase.com.
2. **SQL Editor** → cole `supabase/schema.sql` → **Run** (já inclui a sala de espera; quem já tinha rodado antes só precisa rodar `supabase/lobby.sql`).
3. **Authentication → Providers → Email**: deixe habilitado. Para testar rápido, desative *Confirm email* (senão cada cadastro precisa confirmar pelo e-mail). Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL*.
4. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para `public/online-config.json`:
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
   ```
   (a chave anon é pública por design; a segurança vem das regras RLS do schema). Sem esse arquivo preenchido, o jogo funciona offline e esconde o online.

Modelo de confiança: as estatísticas do perfil (XP, rating) são enviadas pelo próprio cliente — adequado para um grupo de estudo; para competição aberta, mover o cálculo de rating para funções no servidor.

## Adicionar flashcards

1. No Anki, exporte o baralho como **.apkg** (marque "compatível com versões antigas" se aparecer).
2. Coloque o arquivo na pasta **`flashcards/`** (pelo site do GitHub: *Add file → Upload files*).
3. Diga em que área/subtema ele entra em **`tools/cards-map.json`** (ex.: `{ "match": "arritmias", "path": ["CLI", "Cardiologia"] }`). Baralhos com subdecks no formato `CLI::Cardiologia::Arritmias` não precisam disso.
4. **Commit.** O GitHub Actions monta `public/cards/deck.json` e publica o site. Se um baralho ficar sem área, o build avisa quais faltam.

Ou mande os .apkg para o Claude. Localmente: `python3 tools/build_cards.py`.

## Testes locais do online

`npm run dev` e abra `/?online=mock&slot=A` e `/?online=mock&slot=B` em duas abas: um backend simulado no navegador permite jogar os dois lados sem Supabase.

## Arquitetura

```
flashcards/*.apkg           ← baralhos do Anki (fonte)
tools/cards-map.json        ← baralho → área › subtemas
tools/build_cards.py        ← .apkg → public/cards/deck.json (+ imagens em public/cards/img/)
tools/export_apkg.py        ← gera public/cards/apkg/*.apkg (um por pasta, para download)
src/
  types/        modelo de dados: Flashcard, Question (pergunta jogável), Player, AnswerRecord, MatchSummary…
  data/         categorias, níveis/ligas, bots, loja, conquistas, missões
  engine/       regras puras: cards.ts (árvore de temas), match.ts, scoring, elo, selection (anti-repetição), bot, player, stats
  services/     questionRepo (baralho estático), playerRepo (localStorage), online/ (Supabase + simulado), rankings
  state/        store React
  ui/ screens/  componentes e telas
```

**Motor ≠ baralho ≠ interface.** O motor recebe estado e devolve novo estado e eventos. A interface só desenha e toca sons. Os flashcards ficam em JSON, carregados por `fetch`.

**Anti-repetição** (`engine/selection.ts`): a escolha da questão é aleatória com pesos. Questões nunca vistas têm peso alto. Questões erradas voltam depois de algumas horas, como revisão. Questões acertadas reaparecem devagar, conforme o tempo passa. Questões vistas há menos de 30 min quase nunca saem. Na partida, a mesma questão não se repete, nem entre os dois jogadores.

## Como alterar categorias

Edite `src/data/categories.ts` (nome, ícone, cor) e o tipo `CategoryId` em `src/types/index.ts`. A roleta, os filtros, as estatísticas e os rankings se ajustam sozinhos.

## O que ainda falta

- Rating calculado no cliente (ver "Modelo de confiança").
