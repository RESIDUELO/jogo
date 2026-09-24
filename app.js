'use strict';

/* ================= Configuração ================= */
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const CONFIG = {
  learnSteps: [1, 10],   // minutos
  relearnSteps: [10],    // minutos
  graduatingIvl: 1,      // dias
  easyIvl: 4,            // dias
  startEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  newPerDay: 20,
  reviewsPerDay: 200,
  maxIvl: 36500,
};
const XP_BY_EASE = { 1: 1, 2: 3, 3: 5, 4: 6 };
const STORAGE_KEY = 'flashanki-v1';

/* ================= Estado ================= */
let state = load();
let session = null; // { deckId, card, shownAt, answered, stats }
let undoStack = [];
let editingId = null;

function defaultState() {
  const deckId = uid();
  const t = Date.now();
  const sample = [
    ['Capital da França', 'Paris'],
    ['Capital do Japão', 'Tóquio'],
    ['Capital da Austrália', 'Camberra'],
    ['Capital do Canadá', 'Ottawa'],
    ['Capital da Argentina', 'Buenos Aires'],
    ['Capital do Egito', 'Cairo'],
    ['Capital da Alemanha', 'Berlim'],
    ['Capital da Coreia do Sul', 'Seul'],
  ];
  return {
    decks: [{ id: deckId, name: 'Capitais do mundo', created: t }],
    cards: sample.map(([front, back], i) => newCard(deckId, front, back, t + i)),
    revlog: [],
    daily: {},
    game: { xp: 0, streak: 0, lastDay: null, bestCombo: 0, badges: [] },
  };
}

function newCard(deckId, front, back, created = Date.now()) {
  return {
    id: uid(), deckId, front, back, created,
    type: 'new', due: 0, ivl: 0, ease: CONFIG.startEase, step: 0, reps: 0, lapses: 0,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignora */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
}

/* ================= Utilidades ================= */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function $(sel) { return document.querySelector(sel); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfDay(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function endOfDay(t = Date.now()) { return startOfDay(t) + DAY; }
function addDays(t, n) { const d = new Date(startOfDay(t)); d.setDate(d.getDate() + n); return d.getTime(); }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }

function fmtIvl(ms) {
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))}min`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${(d / 30).toFixed(1).replace('.', ',')}me`;
  return `${(d / 365).toFixed(1).replace('.', ',')}a`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ================= Agendador (estilo Anki / SM-2) ================= */
// Retorna uma cópia do cartão já agendada para a resposta dada.
function schedule(card, ease, now = Date.now()) {
  const c = { ...card };
  c.reps++;

  const learning = c.type === 'new' || c.type === 'learn' || c.type === 'relearn';
  if (learning) {
    const relearn = c.type === 'relearn';
    const steps = relearn ? CONFIG.relearnSteps : CONFIG.learnSteps;
    if (c.type === 'new') { c.type = 'learn'; c.step = 0; }

    const graduate = (ivl) => {
      c.type = 'review';
      c.ivl = Math.min(CONFIG.maxIvl, ivl);
      c.step = 0;
      c.due = addDays(now, c.ivl);
    };

    if (ease === 1) {
      c.step = 0;
      c.due = now + steps[0] * MIN;
    } else if (ease === 2) {
      const delay = c.step === 0 && steps.length > 1
        ? (steps[0] + steps[1]) / 2
        : steps[c.step] * (c.step === 0 ? 1.5 : 1);
      c.due = now + delay * MIN;
    } else if (ease === 3) {
      if (c.step + 1 >= steps.length) {
        graduate(relearn ? Math.max(1, c.ivl) : CONFIG.graduatingIvl);
      } else {
        c.step++;
        c.due = now + steps[c.step] * MIN;
      }
    } else {
      graduate(relearn ? Math.max(1, c.ivl) + 1 : CONFIG.easyIvl);
    }
    return c;
  }

  // Cartão em revisão
  const late = Math.max(0, daysBetween(c.due, now));
  const hardIvl = Math.max(c.ivl + 1, Math.round(c.ivl * CONFIG.hardFactor));
  const goodIvl = Math.max(hardIvl + 1, Math.round((c.ivl + late / 2) * c.ease));
  const easyIvl = Math.max(goodIvl + 1, Math.round((c.ivl + late) * c.ease * CONFIG.easyBonus));

  if (ease === 1) {
    c.lapses++;
    c.ease = Math.max(CONFIG.minEase, c.ease - 0.2);
    c.ivl = 1;
    c.type = 'relearn';
    c.step = 0;
    c.due = now + CONFIG.relearnSteps[0] * MIN;
    return c;
  }
  if (ease === 2) { c.ease = Math.max(CONFIG.minEase, c.ease - 0.15); c.ivl = hardIvl; }
  if (ease === 3) { c.ivl = goodIvl; }
  if (ease === 4) { c.ease += 0.15; c.ivl = easyIvl; }
  c.ivl = Math.min(CONFIG.maxIvl, c.ivl);
  c.due = addDays(now, c.ivl);
  return c;
}

function intervalLabel(card, ease) {
  const now = Date.now();
  const c = schedule(card, ease, now);
  if (c.type === 'review') return c.ivl < 30 ? `${c.ivl}d` : fmtIvl(c.ivl * DAY);
  return fmtIvl(c.due - now);
}

/* ================= Filas ================= */
function daily(deckId) {
  const k = dayKey();
  if (!state.daily[k]) state.daily = { [k]: {} }; // descarta dias antigos
  if (!state.daily[k][deckId]) state.daily[k][deckId] = { new: 0, rev: 0 };
  return state.daily[k][deckId];
}

function deckQueues(deckId, now = Date.now()) {
  const cards = state.cards.filter(c => c.deckId === deckId);
  const eod = endOfDay(now);
  const lim = daily(deckId);
  const newCards = cards.filter(c => c.type === 'new').sort((a, b) => a.created - b.created);
  const learn = cards.filter(c => (c.type === 'learn' || c.type === 'relearn') && c.due < eod).sort((a, b) => a.due - b.due);
  const review = cards.filter(c => c.type === 'review' && c.due < eod).sort((a, b) => a.due - b.due);
  return {
    newCards: newCards.slice(0, Math.max(0, CONFIG.newPerDay - lim.new)),
    learn,
    review: review.slice(0, Math.max(0, CONFIG.reviewsPerDay - lim.rev)),
  };
}

function nextCard(deckId) {
  const now = Date.now();
  const q = deckQueues(deckId, now);
  const learnNow = q.learn.filter(c => c.due <= now);
  if (learnNow.length) return learnNow[0];
  // Intercala revisões e novos, como o Anki
  if (q.review.length && q.newCards.length) {
    return (session && session.stats.total % 4 === 3) ? q.newCards[0] : q.review[0];
  }
  if (q.review.length) return q.review[0];
  if (q.newCards.length) return q.newCards[0];
  // Só sobraram cartões em aprendizado para mais tarde: adianta o próximo
  if (q.learn.length) return q.learn[0];
  return null;
}

/* ================= Navegação ================= */
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.topbar nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  if (view !== 'study') stopTimer();
  if (view === 'decks') renderDecks();
  if (view === 'add') renderAdd();
  if (view === 'browse') renderBrowse();
  if (view === 'stats') renderStats();
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { editingId = null; session = null; show(nav.dataset.nav); }
});

/* ================= Baralhos ================= */
function renderDecks() {
  const tbody = $('#deck-list');
  if (!state.decks.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="hint">Nenhum baralho ainda. Crie um!</td></tr>';
    return;
  }
  tbody.innerHTML = state.decks.map(d => {
    const q = deckQueues(d.id);
    const n = (v, cls) => `<td class="n ${v ? cls : 'zero'}">${v}</td>`;
    return `<tr>
      <td class="name" data-deck="${d.id}">${esc(d.name)}</td>
      ${n(q.newCards.length, 'new')}${n(q.learn.length, 'learn')}${n(q.review.length, 'due')}
      <td class="n"><button class="icon" data-deck-opts="${d.id}" title="Opções">⚙</button></td>
    </tr>`;
  }).join('');
  renderPlayer();
}

let currentDeck = null;
$('#deck-list').addEventListener('click', e => {
  const id = e.target.closest('[data-deck]')?.dataset.deck || e.target.closest('[data-deck-opts]')?.dataset.deckOpts;
  if (id) openOverview(id);
});

function openOverview(id) {
  currentDeck = id;
  const deck = state.decks.find(d => d.id === id);
  const q = deckQueues(id);
  $('#ov-title').textContent = deck.name;
  $('#ov-new').textContent = q.newCards.length;
  $('#ov-learn').textContent = q.learn.length;
  $('#ov-due').textContent = q.review.length;
  $('#btn-study').disabled = !(q.newCards.length + q.learn.length + q.review.length);
  show('overview');
}

$('#btn-new-deck').onclick = () => {
  const name = prompt('Nome do novo baralho:');
  if (!name || !name.trim()) return;
  state.decks.push({ id: uid(), name: name.trim(), created: Date.now() });
  save(); renderDecks();
};
$('#btn-rename-deck').onclick = () => {
  const deck = state.decks.find(d => d.id === currentDeck);
  const name = prompt('Novo nome:', deck.name);
  if (!name || !name.trim()) return;
  deck.name = name.trim(); save(); openOverview(deck.id);
};
$('#btn-delete-deck').onclick = () => {
  const deck = state.decks.find(d => d.id === currentDeck);
  const count = state.cards.filter(c => c.deckId === deck.id).length;
  if (!confirm(`Excluir "${deck.name}" e seus ${count} cartões?`)) return;
  state.decks = state.decks.filter(d => d.id !== deck.id);
  state.cards = state.cards.filter(c => c.deckId !== deck.id);
  save(); show('decks');
};
$('#btn-study').onclick = () => startSession(currentDeck);

/* ================= Estudo ================= */
let timerId = null;
function stopTimer() { clearInterval(timerId); timerId = null; }

function startSession(deckId) {
  session = { deckId, card: null, answered: false, combo: 0, started: Date.now(),
    stats: { total: 0, again: 0, xp: 0, time: 0 } };
  undoStack = [];
  stopTimer();
  timerId = setInterval(() => {
    if (!session) return;
    const s = Math.floor((Date.now() - session.started) / 1000);
    $('#timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  $('#timer').textContent = '0:00';
  $('#combo').textContent = '';
  show('study');
  nextQuestion();
}

function nextQuestion() {
  const card = nextCard(session.deckId);
  if (!card) return finishSession();
  renderQuestion(card);
}

function renderQuestion(card) {
  session.card = card;
  session.answered = false;
  session.shownAt = Date.now();
  const q = deckQueues(session.deckId);
  $('#st-new').textContent = q.newCards.length;
  $('#st-learn').textContent = q.learn.length;
  $('#st-due').textContent = q.review.length;
  const kind = card.type === 'new' ? 'st-new' : card.type === 'review' ? 'st-due' : 'st-learn';
  ['st-new', 'st-learn', 'st-due'].forEach(id => { $('#' + id).style.textDecoration = id === kind ? 'underline' : ''; });
  $('#card-front').textContent = card.front;
  $('#card-back').textContent = '';
  $('#card-sep').hidden = true;
  $('#btn-show').hidden = false;
  $('#ease-buttons').hidden = true;
  $('#btn-undo').disabled = !undoStack.length;
}

function showAnswer() {
  if (!session || session.answered || !session.card) return;
  session.answered = true;
  $('#card-back').textContent = session.card.back;
  $('#card-sep').hidden = false;
  $('#btn-show').hidden = true;
  $('#ease-buttons').hidden = false;
  for (let e = 1; e <= 4; e++) $('#iv-' + e).textContent = intervalLabel(session.card, e);
}

function answer(ease) {
  if (!session || !session.answered) return;
  const now = Date.now();
  const old = session.card;
  const idx = state.cards.findIndex(c => c.id === old.id);
  undoStack.push({
    card: { ...old },
    game: JSON.parse(JSON.stringify(state.game)),
    daily: JSON.parse(JSON.stringify(state.daily)),
    revlogLen: state.revlog.length,
    session: { combo: session.combo, stats: { ...session.stats } },
  });
  if (undoStack.length > 20) undoStack.shift();

  const lim = daily(old.deckId);
  if (old.type === 'new') lim.new++;
  else if (old.type === 'review') lim.rev++;

  const updated = schedule(old, ease, now);
  state.cards[idx] = updated;
  const time = Math.min(60000, now - session.shownAt);
  state.revlog.push({ t: now, cid: old.id, ease, type: old.type, ivl: updated.ivl, time });

  // --- Jogo: combo, XP, sequência ---
  const cardEl = $('#card');
  cardEl.classList.remove('flash-good', 'flash-bad');
  void cardEl.offsetWidth;
  if (ease === 1) {
    session.combo = 0;
    session.stats.again++;
    cardEl.classList.add('flash-bad');
  } else {
    session.combo++;
    cardEl.classList.add('flash-good');
  }
  const bonus = Math.floor(session.combo / 5);
  const gained = XP_BY_EASE[ease] + bonus;
  session.stats.xp += gained;
  session.stats.total++;
  session.stats.time += time;
  gainXp(gained);
  state.game.bestCombo = Math.max(state.game.bestCombo, session.combo);
  updateStreak();
  const comboEl = $('#combo');
  comboEl.textContent = session.combo >= 3 ? `Combo x${session.combo}!` : '';
  comboEl.classList.remove('pop'); void comboEl.offsetWidth;
  if (session.combo >= 3) comboEl.classList.add('pop');
  checkBadges();

  save();
  nextQuestion();
}

function undo() {
  const u = undoStack.pop();
  if (!u || !session) return;
  const idx = state.cards.findIndex(c => c.id === u.card.id);
  if (idx >= 0) state.cards[idx] = u.card;
  state.game = u.game;
  state.daily = u.daily;
  state.revlog.length = u.revlogLen;
  session.combo = u.session.combo;
  session.stats = u.session.stats;
  save();
  renderPlayer();
  $('#combo').textContent = session.combo >= 3 ? `Combo x${session.combo}!` : '';
  renderQuestion(u.card);
  toast('Resposta desfeita');
}

function finishSession() {
  stopTimer();
  const s = session.stats;
  const acc = s.total ? Math.round(100 * (s.total - s.again) / s.total) : 0;
  $('#summary').innerHTML = `
    <span>Cartões estudados</span><b>${s.total}</b>
    <span>Acertos</span><b>${acc}%</b>
    <span>XP ganho</span><b>+${s.xp}</b>
    <span>Tempo</span><b>${Math.round(s.time / 1000)}s</b>
    <span>Sequência</span><b>🔥 ${state.game.streak} dia(s)</b>`;
  session = null;
  show('done');
}

$('#btn-show').onclick = showAnswer;
$('#ease-buttons').addEventListener('click', e => {
  const b = e.target.closest('[data-ease]');
  if (b) answer(Number(b.dataset.ease));
});
$('#btn-undo').onclick = undo;
$('#btn-edit-current').onclick = () => { if (session?.card) openEditor(session.card.id, 'study'); };

document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#add-form').requestSubmit(); }
    return;
  }
  if (!$('#view-study').classList.contains('active')) return;
  if (tag === 'BUTTON') document.activeElement.blur();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (session && !session.answered) showAnswer(); else answer(3);
  } else if (['1', '2', '3', '4'].includes(e.key)) {
    answer(Number(e.key));
  }
});

/* ================= Gamificação ================= */
function xpForLevel(l) { return 100 * l; }
function levelInfo(xp) {
  let level = 1, rest = xp;
  while (rest >= xpForLevel(level)) { rest -= xpForLevel(level); level++; }
  return { level, rest, need: xpForLevel(level) };
}
function gainXp(n) {
  const before = levelInfo(state.game.xp).level;
  state.game.xp += n;
  const after = levelInfo(state.game.xp).level;
  if (after > before) toast(`⬆ Subiu para o nível ${after}!`);
  renderPlayer();
}
function updateStreak() {
  const today = dayKey();
  const g = state.game;
  if (g.lastDay === today) return;
  const yesterday = dayKey(addDays(Date.now(), -1));
  g.streak = g.lastDay === yesterday ? g.streak + 1 : 1;
  g.lastDay = today;
  renderPlayer();
}
function currentStreak() {
  const g = state.game;
  if (g.lastDay === dayKey() || g.lastDay === dayKey(addDays(Date.now(), -1))) return g.streak;
  return 0;
}
function renderPlayer() {
  const info = levelInfo(state.game.xp);
  $('#level').textContent = `Nv ${info.level}`;
  $('#xpfill').style.width = `${(100 * info.rest / info.need).toFixed(1)}%`;
  $('#xpfill').parentElement.title = `${info.rest} / ${info.need} XP`;
  $('#streak').textContent = `🔥 ${currentStreak()}`;
}

const BADGES = [
  { id: 'first', name: 'Primeiro passo', desc: 'Responda seu primeiro cartão', test: () => state.revlog.length >= 1 },
  { id: 'r100', name: 'Centenário', desc: 'Faça 100 revisões', test: () => state.revlog.length >= 100 },
  { id: 'r1000', name: 'Maratonista', desc: 'Faça 1000 revisões', test: () => state.revlog.length >= 1000 },
  { id: 'combo10', name: 'Em chamas', desc: 'Faça um combo de 10', test: () => state.game.bestCombo >= 10 },
  { id: 'combo50', name: 'Imparável', desc: 'Faça um combo de 50', test: () => state.game.bestCombo >= 50 },
  { id: 'streak3', name: 'Constância', desc: 'Estude 3 dias seguidos', test: () => state.game.streak >= 3 },
  { id: 'streak30', name: 'Hábito de ferro', desc: 'Estude 30 dias seguidos', test: () => state.game.streak >= 30 },
  { id: 'mature', name: 'Memória de elefante', desc: 'Tenha um cartão com intervalo ≥ 21 dias', test: () => state.cards.some(c => c.ivl >= 21) },
  { id: 'lvl5', name: 'Veterano', desc: 'Alcance o nível 5', test: () => levelInfo(state.game.xp).level >= 5 },
  { id: 'creator', name: 'Criador', desc: 'Tenha 50 cartões', test: () => state.cards.length >= 50 },
];
function checkBadges() {
  for (const b of BADGES) {
    if (!state.game.badges.includes(b.id) && b.test()) {
      state.game.badges.push(b.id);
      toast(`🏆 Conquista: ${b.name}`);
    }
  }
}

/* ================= Adicionar / Editar ================= */
let editReturn = 'add';
function fillDeckSelect(sel, withAll) {
  sel.innerHTML = (withAll ? '<option value="">Todos os baralhos</option>' : '') +
    state.decks.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}
function renderAdd() {
  if (!state.decks.length) state.decks.push({ id: uid(), name: 'Padrão', created: Date.now() });
  fillDeckSelect($('#add-deck'));
  const editing = editingId && state.cards.find(c => c.id === editingId);
  $('#add-title').textContent = editing ? 'Editar cartão' : 'Adicionar cartão';
  $('#add-submit').firstChild.textContent = editing ? 'Salvar ' : 'Adicionar ';
  $('#add-cancel').hidden = !editing;
  $('#add-reverse').parentElement.hidden = !!editing;
  if (editing) {
    $('#add-deck').value = editing.deckId;
    $('#add-front').value = editing.front;
    $('#add-back').value = editing.back;
  } else {
    if (currentDeck && state.decks.some(d => d.id === currentDeck)) $('#add-deck').value = currentDeck;
    $('#add-front').value = '';
    $('#add-back').value = '';
  }
  $('#add-flash').textContent = '';
  setTimeout(() => $('#add-front').focus(), 0);
}
function openEditor(id, from) {
  editingId = id;
  editReturn = from;
  show('add');
}
function closeEditor() {
  const from = editReturn;
  editingId = null;
  if (from === 'study' && session) {
    session.card = state.cards.find(c => c.id === session.card.id);
    show('study');
    $('#card-front').textContent = session.card.front;
    if (session.answered) $('#card-back').textContent = session.card.back;
  } else {
    show(from);
  }
}
$('#add-cancel').onclick = closeEditor;
$('#add-form').addEventListener('submit', e => {
  e.preventDefault();
  const front = $('#add-front').value.trim();
  const back = $('#add-back').value.trim();
  const deckId = $('#add-deck').value;
  if (!front || !back) return;
  if (editingId) {
    const c = state.cards.find(x => x.id === editingId);
    Object.assign(c, { front, back, deckId });
    save();
    toast('Cartão salvo');
    closeEditor();
    return;
  }
  state.cards.push(newCard(deckId, front, back));
  if ($('#add-reverse').checked) state.cards.push(newCard(deckId, back, front, Date.now() + 1));
  currentDeck = deckId;
  checkBadges();
  save();
  $('#add-front').value = '';
  $('#add-back').value = '';
  $('#add-front').focus();
  $('#add-flash').textContent = `✔ Adicionado a "${state.decks.find(d => d.id === deckId).name}"`;
});

/* ================= Navegar ================= */
function renderBrowse() {
  const sel = $('#browse-deck');
  const prev = sel.value;
  fillDeckSelect(sel, true);
  sel.value = prev;
  const term = $('#search').value.trim().toLowerCase();
  const deckName = Object.fromEntries(state.decks.map(d => [d.id, d.name]));
  const rows = state.cards
    .filter(c => !sel.value || c.deckId === sel.value)
    .filter(c => !term || c.front.toLowerCase().includes(term) || c.back.toLowerCase().includes(term))
    .sort((a, b) => b.created - a.created);
  const dueLabel = c => {
    if (c.type === 'new') return '<span class="new">Novo</span>';
    const d = daysBetween(Date.now(), c.due);
    if (c.type !== 'review') return '<span class="learn">Aprendendo</span>';
    return d <= 0 ? '<span class="due">Hoje</span>' : new Date(c.due).toLocaleDateString('pt-BR');
  };
  $('#browse-list').innerHTML = rows.length ? rows.map(c => `<tr>
      <td title="${esc(c.front)}">${esc(c.front)}</td>
      <td title="${esc(c.back)}">${esc(c.back)}</td>
      <td>${esc(deckName[c.deckId] || '?')}</td>
      <td>${dueLabel(c)}</td>
      <td>${c.type === 'review' ? c.ivl + 'd' : '—'}</td>
      <td class="n"><button class="icon" data-edit="${c.id}" title="Editar">✎</button><button class="icon" data-del="${c.id}" title="Excluir">🗑</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="hint">Nenhum cartão encontrado.</td></tr>';
}
$('#search').addEventListener('input', renderBrowse);
$('#browse-deck').addEventListener('change', renderBrowse);
$('#browse-list').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) openEditor(edit.dataset.edit, 'browse');
  if (del && confirm('Excluir este cartão?')) {
    state.cards = state.cards.filter(c => c.id !== del.dataset.del);
    save(); renderBrowse();
  }
});

/* ================= Estatísticas ================= */
function renderStats() {
  const today = startOfDay();
  const todayLog = state.revlog.filter(r => r.t >= today);
  const correct = todayLog.filter(r => r.ease > 1).length;
  const mature = state.cards.filter(c => c.type === 'review' && c.ivl >= 21).length;
  const young = state.cards.filter(c => c.type === 'review' && c.ivl < 21).length;
  const learning = state.cards.filter(c => c.type === 'learn' || c.type === 'relearn').length;
  const fresh = state.cards.filter(c => c.type === 'new').length;
  const tomorrow = state.cards.filter(c => c.type === 'review' && c.due >= endOfDay() && c.due < endOfDay() + DAY).length;
  const info = levelInfo(state.game.xp);
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  $('#stat-grid').innerHTML = [
    stat(todayLog.length, 'Revisões hoje'),
    stat(todayLog.length ? Math.round(100 * correct / todayLog.length) + '%' : '—', 'Acertos hoje'),
    stat(Math.round(todayLog.reduce((s, r) => s + r.time, 0) / 60000) + ' min', 'Tempo hoje'),
    stat(tomorrow, 'Revisões amanhã'),
    stat(fresh, 'Novos'),
    stat(learning, 'Aprendendo'),
    stat(young, 'Jovens (< 21d)'),
    stat(mature, 'Maduros (≥ 21d)'),
    stat(`Nv ${info.level}`, `${state.game.xp} XP total`),
    stat(`🔥 ${currentStreak()}`, 'Sequência de dias'),
    stat(state.game.bestCombo, 'Maior combo'),
    stat(state.revlog.length, 'Revisões no total'),
  ].join('');

  const counts = [];
  for (let i = 29; i >= 0; i--) {
    const s = addDays(Date.now(), -i);
    const e = addDays(Date.now(), -i + 1);
    counts.push({ day: new Date(s).toLocaleDateString('pt-BR'), n: state.revlog.filter(r => r.t >= s && r.t < e).length });
  }
  const max = Math.max(1, ...counts.map(c => c.n));
  $('#chart').innerHTML = counts.map(c => `<div style="height:${(100 * c.n / max).toFixed(1)}%" title="${c.day}: ${c.n} revisões"></div>`).join('');

  $('#badges').innerHTML = BADGES.map(b =>
    `<li class="${state.game.badges.includes(b.id) ? 'got' : ''}">🏆 ${esc(b.name)}<small>${esc(b.desc)}</small></li>`).join('');
}

/* ================= Importar / Exportar ================= */
$('#btn-export').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `flashanki-${dayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$('#btn-import').onclick = () => $('#import-file').click();
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      if (!Array.isArray(data.decks) || !Array.isArray(data.cards)) throw new Error('formato');
      if (confirm('Substituir todos os dados atuais pelo arquivo? (Cancelar = mesclar)')) {
        state = { ...defaultState(), ...data };
      } else {
        const ids = new Set(state.cards.map(c => c.id));
        const deckIds = new Set(state.decks.map(d => d.id));
        state.decks.push(...data.decks.filter(d => !deckIds.has(d.id)));
        state.cards.push(...data.cards.filter(c => !ids.has(c.id)));
      }
      toast('Importação concluída');
    } else {
      const deck = { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), created: Date.now() };
      let n = 0;
      const t = Date.now();
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim() || line.startsWith('#')) continue;
        const parts = line.includes('\t') ? line.split('\t') : line.split(';');
        if (parts.length < 2) continue;
        state.cards.push(newCard(deck.id, parts[0].trim(), parts.slice(1).join(' ').trim(), t + n++));
      }
      if (!n) throw new Error('vazio');
      state.decks.push(deck);
      toast(`${n} cartões importados em "${deck.name}"`);
    }
    checkBadges();
    save();
    renderDecks();
  } catch (err) {
    alert('Não foi possível importar este arquivo.');
  }
});

/* ================= Início ================= */
renderPlayer();
show('decks');
