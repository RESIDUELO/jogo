# ⚔️ Residência Quest

MMORPG de estudo em que **cada flashcard é um golpe**. Revisão espaçada no estilo Anki transformada em combate, XP, loot, bosses e progressão de personagem. O estudo é o centro: **estudar = progredir**.

**Jogar:** https://pablo61616161-huemmm.github.io/seila/

## Como jogar

1. Crie seu personagem e escolha uma classe (Guerreiro, Mago, Assassino, Clérigo; Médico desbloqueia no nível 15).
2. No **Início**, veja as missões diárias e clique em **Iniciar aventura**.
3. Na batalha, leia a pergunta, pense na resposta e clique em **Revelar resposta** (Espaço).
4. Classifique honestamente:
   - **Errei (1)**: você recebe dano, o combo zera e o card volta em 1 min.
   - **Acertei com dificuldade (2)**: dano moderado e intervalo curto.
   - **Acertei (3)**: dano alto e intervalo normal.
   - **Dominei (4)**: crítico garantido, mais XP, mais chance de loot e intervalo longo.
5. Derrote inimigos para ganhar XP, ouro, fragmentos e equipamentos. Depois de alguns abates, o **boss** da região aparece. Derrotá-lo (e ter o nível recomendado) libera a próxima região.
6. Equipe itens no **Inventário**, distribua pontos no **Personagem** e resgate recompensas em **Missões**.

Quando não há mais cards pendentes, a masmorra fica "limpa". Você pode encerrar e receber o bônus de sessão, ou continuar no **Treino livre** (25% das recompensas, sem loot). Assim, não dá para "farmar" sem estudar de verdade.

## Importar flashcards

Em **Decks → Importar CSV/TXT**:

```csv
Front,Back,Deck,Tags
"Qual a causa mais comum de choque séptico?","Infecção bacteriana","Sepse","UTI"
```

- O cabeçalho é opcional. Aceita vírgula, ponto-e-vírgula ou TAB (exportação "Notas em texto simples" do Anki).
- Os decks são criados automaticamente. Sem a coluna Deck, os cards vão para um deck com o nome do arquivo.
- Duplicatas (mesma frente e verso) são ignoradas. Os cards ficam disponíveis na hora.

## Salvar / exportar

- O progresso é salvo automaticamente no `localStorage` a cada ação.
- Em **Opções → Exportar save**, você baixa um arquivo `.json` com tudo: personagem, cards, histórico, inventário, missões etc.
- Em **Opções → Importar save** (ou na tela inicial), você restaura esse arquivo em outro navegador ou dispositivo.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local
npm run build    # typecheck + build em dist/
```

Estrutura:

```
src/
  types.ts            # modelo de dados (SaveData = documento único persistido)
  data/               # conteúdo estático: regiões, inimigos, classes, itens, cards demo
  engine/             # regras puras (sem React): SRS, combate, loot, quests, progressão
  storage/            # SaveRepository (localStorage hoje, API amanhã) + parser CSV
  state/store.tsx     # provider React: executa ações do motor, persiste e emite eventos
  components/ screens/
```

O motor (`engine/game.ts`) recebe o save e devolve `{ novo save, eventos }`. A UI só transforma eventos em efeitos visuais. Para adicionar login e sincronização, basta implementar outro `SaveRepository`. A lógica pode até ser movida para um servidor sem mudanças.

### Deploy no GitHub Pages

O site é servido a partir do branch `gh-pages`, que contém o conteúdo de `dist/` (o `vite.config.ts` usa `base: './'`).
