import { useMemo, useRef, useState } from 'react';
import type { Card } from '../types';
import { useGame } from '../state/store';
import { Modal, Panel } from '../components/ui';
import { addDeck, deleteCard, deleteDeck, importRows, queueCounts, renameDeck, resetCardProgress, startBattle, upsertCard } from '../engine/game';
import { accuracy, isMastered } from '../engine/srs';
import { fmt } from '../engine/util';
import { parseCards } from '../storage/csv';

export function Decks() {
  const { s, run, go } = useGame();
  const [browse, setBrowse] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Card> | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => s.decks.map(d => {
    const cards = s.cards.filter(c => c.deckId === d.id);
    const q = queueCounts(s, d.id);
    return {
      deck: d, total: cards.length, due: q.review + q.learning, fresh: q.fresh,
      mastered: cards.filter(isMastered).length, acc: accuracy(cards), xp: cards.reduce((a, c) => a + c.xpEarned, 0),
      hard: cards.filter(c => c.hard).length,
    };
  }), [s]);

  const study = (deckId: string | null) => {
    run(x => startBattle(x, x.currentRegion, deckId));
    go('battle');
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    const parsed = parseCards(text);
    if (!parsed.length) { setImportMsg('Nenhum card encontrado. Use o formato: Frente,Verso,Deck,Tags'); return; }
    const fallback = f.name.replace(/\.[^.]+$/, '');
    const r = run(x => importRows(x, parsed, fallback)) as ReturnType<typeof importRows>;
    setImportMsg(`✔ ${r.added} cards importados${r.decks ? `, ${r.decks} deck(s) criado(s)` : ''}${parsed.length - r.added ? ` · ${parsed.length - r.added} duplicados ignorados` : ''}. Já disponíveis para estudo!`);
  };

  return (
    <div className="decks-screen">
      <Panel title="📚 Decks" right={
        <div className="row">
          <button className="btn btn-sm" onClick={() => { const n = prompt('Nome do deck:'); if (n?.trim()) run(x => addDeck(x, n)); }}>+ Novo deck</button>
          <button className="btn btn-sm" onClick={() => setEditing({ deckId: s.decks[0]?.id, front: '', back: '', tags: [] })} disabled={!s.decks.length}>+ Novo card</button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>⬆ Importar CSV/TXT</button>
        </div>
      }>
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" hidden onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ''; }} />
        {importMsg && <p className="hint-box" onClick={() => setImportMsg(null)}>{importMsg}</p>}
        <div className="deck-list">
          <div className="deck-card all">
            <div className="deck-head"><h3 className="cinzel">Todos os decks</h3></div>
            <div className="deck-nums"><span><b>{fmt(s.cards.length)}</b> cards</span><span className="c-due"><b>{rows.reduce((a, r) => a + r.due, 0)}</b> para revisar</span><span className="c-new"><b>{rows.reduce((a, r) => a + r.fresh, 0)}</b> novos hoje</span></div>
            <button className="btn btn-primary" onClick={() => study(null)}>⚔️ Estudar tudo</button>
          </div>
          {rows.map(r => (
            <div key={r.deck.id} className="deck-card">
              <div className="deck-head">
                <h3 className="cinzel">{r.deck.name}</h3>
                <div className="deck-menu">
                  <button className="icon-btn" title="Ver cards" onClick={() => setBrowse(r.deck.id)}>🔍</button>
                  <button className="icon-btn" title="Renomear" onClick={() => { const n = prompt('Novo nome:', r.deck.name); if (n?.trim()) run(x => renameDeck(x, r.deck.id, n)); }}>✎</button>
                  <button className="icon-btn" title="Excluir" onClick={() => confirm(`Excluir "${r.deck.name}" e ${r.total} cards?`) && run(x => deleteDeck(x, r.deck.id))}>🗑</button>
                </div>
              </div>
              <div className="deck-nums">
                <span><b>{fmt(r.total)}</b> cards</span>
                <span className="c-due"><b>{r.due}</b> para revisar</span>
                <span className="c-new"><b>{r.fresh}</b> novos hoje</span>
                <span className="c-mastered"><b>{r.mastered}</b> dominados</span>
                <span><b>{Math.round(r.acc * 100)}%</b> acerto</span>
                <span className="xp-text"><b>{fmt(r.xp)}</b> XP gerado</span>
                {r.hard > 0 && <span className="bad"><b>{r.hard}</b> difíceis</span>}
              </div>
              <div className="deck-mastery"><div style={{ width: `${r.total ? (100 * r.mastered) / r.total : 0}%` }} /></div>
              <button className="btn btn-primary" onClick={() => study(r.deck.id)}>⚔️ Estudar</button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Formato de importação">
        <p className="muted small">CSV com cabeçalho opcional <code>Front,Back,Deck,Tags</code>. Também aceita ponto-e-vírgula, TAB (exportação em texto do Anki) e aspas:</p>
        <pre className="code">{`Front,Back,Deck,Tags
"Qual a causa mais comum de choque séptico?","Infecção bacteriana","Sepse","UTI"
"Vasopressor de 1ª escolha no choque séptico?","Noradrenalina","Sepse","UTI farmaco"`}</pre>
        <p className="muted small">Sem a coluna Deck, os cards vão para um deck com o nome do arquivo. Tags podem ser separadas por espaço.</p>
      </Panel>

      {browse && <CardBrowser deckId={browse} onClose={() => setBrowse(null)} onEdit={c => setEditing(c)} />}
      {editing && <CardEditor card={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CardBrowser({ deckId, onClose, onEdit }: { deckId: string; onClose: () => void; onEdit: (c: Card) => void }) {
  const { s, run } = useGame();
  const [q, setQ] = useState('');
  const deck = s.decks.find(d => d.id === deckId);
  const cards = s.cards.filter(c => c.deckId === deckId)
    .filter(c => !q || (c.front + c.back + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal onClose={onClose} className="wide">
      <div className="modal-head">
        <h3 className="cinzel">{deck?.name}</h3>
        <input className="search" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn btn-sm" onClick={() => onEdit({ deckId, front: '', back: '', tags: [] } as unknown as Card)}>+ Card</button>
        <button className="btn btn-sm" onClick={onClose}>Fechar</button>
      </div>
      <div className="table-wrap">
        <table className="cards-table">
          <thead><tr><th>Pergunta</th><th>Resposta</th><th>Estado</th><th>✔/✘</th><th></th></tr></thead>
          <tbody>
            {cards.map(c => (
              <tr key={c.id}>
                <td>{c.hard && <span className="bad">⚠ </span>}{c.front}</td>
                <td className="muted">{c.back}</td>
                <td>{c.state === 'new' ? <span className="c-new">Novo</span> : c.state === 'learning' ? <span className="c-learn">Aprendendo</span> : isMastered(c) ? <span className="c-mastered">Dominado</span> : <span className="c-due">{c.interval}d</span>}</td>
                <td>{c.correct}/{c.wrong}</td>
                <td className="nowrap">
                  <button className="icon-btn" onClick={() => onEdit(c)}>✎</button>
                  <button className="icon-btn" onClick={() => confirm('Excluir card?') && run(x => deleteCard(x, c.id))}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cards.length && <p className="muted">Nenhum card.</p>}
      </div>
      <button className="link" onClick={() => confirm('Reiniciar o progresso de repetição espaçada deste deck?') && run(x => resetCardProgress(x, deckId))}>Reiniciar progresso do deck</button>
    </Modal>
  );
}

function CardEditor({ card, onClose }: { card: Partial<Card>; onClose: () => void }) {
  const { s, run } = useGame();
  const [deckId, setDeckId] = useState(card.deckId ?? s.decks[0]?.id ?? '');
  const [front, setFront] = useState(card.front ?? '');
  const [back, setBack] = useState(card.back ?? '');
  const [tags, setTags] = useState((card.tags ?? []).join(' '));
  const [msg, setMsg] = useState('');
  const save = (again: boolean) => {
    if (!front.trim() || !back.trim()) return;
    run(x => upsertCard(x, { id: card.id, deckId, front: front.trim(), back: back.trim(), tags: tags.split(/\s+/).filter(Boolean) }));
    if (again && !card.id) { setFront(''); setBack(''); setMsg('✔ Card adicionado'); } else onClose();
  };
  return (
    <Modal onClose={onClose}>
      <h3 className="cinzel">{card.id ? 'Editar card' : 'Novo card'}</h3>
      <label className="field">Deck
        <select value={deckId} onChange={e => setDeckId(e.target.value)}>{s.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </label>
      <label className="field">Pergunta<textarea rows={3} value={front} onChange={e => setFront(e.target.value)} autoFocus /></label>
      <label className="field">Resposta<textarea rows={3} value={back} onChange={e => setBack(e.target.value)} /></label>
      <label className="field">Tags (separadas por espaço)<input value={tags} onChange={e => setTags(e.target.value)} /></label>
      {msg && <p className="good small">{msg}</p>}
      <div className="row-center">
        <button className="btn btn-primary" onClick={() => save(true)}>{card.id ? 'Salvar' : 'Adicionar'}</button>
        <button className="btn" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
