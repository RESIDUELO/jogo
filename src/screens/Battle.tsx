import { useCallback, useEffect, useRef, useState } from 'react';
import type { Grade, SessionStats } from '../types';
import { useGame } from '../state/store';
import { Bar, Modal, Panel } from '../components/ui';
import { REGIONS, REGION_BY_ID } from '../data/world';
import { CLASS_BY_ID, SKILLS } from '../data/content';
import {
  answer, canFightBoss, challengeBoss, endSession, enterPractice, queueCounts, startBattle, usePotion, useSkill,
} from '../engine/game';
import { derived } from '../engine/progression';
import { previewLabel } from '../engine/srs';
import { fmt, fmtDuration } from '../engine/util';
import { sfx } from '../sound';

interface Floater { id: number; text: string; cls: string; target: 'enemy' | 'player'; x: number }
interface Particle { id: number; dx: number; dy: number; color: string }

const GRADES: { g: Grade; label: string; short: string; cls: string }[] = [
  { g: 1, label: 'Errei', short: 'Errei', cls: 'g-again' },
  { g: 2, label: 'Acertei com dificuldade', short: 'Difícil', cls: 'g-hard' },
  { g: 3, label: 'Acertei', short: 'Acertei', cls: 'g-good' },
  { g: 4, label: 'Dominei', short: 'Dominei', cls: 'g-easy' },
];

export function Battle() {
  const { s } = useGame();
  const [summary, setSummary] = useState<SessionStats | null>(null);
  return (
    <>
      {s.battle ? <Arena onEnd={setSummary} /> : <BattleSetup />}
      {summary && <SessionSummary stats={summary} onClose={() => setSummary(null)} />}
    </>
  );
}

/* ---------------- Seleção de masmorra ---------------- */
function BattleSetup() {
  const { s, run } = useGame();
  const [region, setRegion] = useState(s.currentRegion);
  const [deck, setDeck] = useState<string>('');
  const counts = queueCounts(s, deck || null);
  return (
    <div className="setup">
      <Panel title="⚔️ Entrar em uma masmorra">
        <p className="muted">Escolha a região (define os inimigos) e o deck (define os cards). Cada resposta é um golpe.</p>
        <div className="setup-regions">
          {REGIONS.map(r => {
            const rp = s.regions[r.id];
            return (
              <button key={r.id} disabled={!rp.unlocked} className={`region-pick${region === r.id ? ' selected' : ''}`} onClick={() => setRegion(r.id)}>
                <span className="rp-icon">{rp.unlocked ? r.icon : '🔒'}</span>
                <b>{r.name}</b>
                <small>Nv. {r.level}+</small>
              </button>
            );
          })}
        </div>
        <label className="field">
          Deck
          <select value={deck} onChange={e => setDeck(e.target.value)}>
            <option value="">Todos os decks</option>
            {s.decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <div className="setup-counts">
          <span className="c-new">{counts.fresh} novos</span>
          <span className="c-learn">{counts.learning} aprendendo</span>
          <span className="c-due">{counts.review} para revisar</span>
        </div>
        <button className="btn btn-primary btn-big" onClick={() => run(x => startBattle(x, region, deck || null))}>
          {counts.total ? 'Entrar na batalha' : 'Treino livre (nada pendente)'}
        </button>
      </Panel>
    </div>
  );
}

/* ---------------- Arena ---------------- */
function Arena({ onEnd }: { onEnd: (s: SessionStats) => void }) {
  const { s, run, subscribe, go } = useGame();
  const b = s.battle!;
  const card = b.cardId ? s.cards.find(c => c.id === b.cardId) ?? null : null;
  const deckName = card ? s.decks.find(d => d.id === card.deckId)?.name : '';
  const region = REGION_BY_ID[b.regionId];
  const rp = s.regions[b.regionId];
  const d = derived(s);
  const p = s.player;
  const counts = queueCounts(s, b.deckId);

  const [revealed, setRevealed] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [fx, setFx] = useState({ enemyHit: 0, playerHit: 0, kill: 0, crit: 0 });
  const [banner, setBanner] = useState<{ id: number; text: string; cls: string } | null>(null);
  const [dialog, setDialog] = useState<{ name: string; taunt: string } | null>(null);
  const [killed, setKilled] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const fid = useRef(1);

  useEffect(() => { setRevealed(false); shownAt.current = Date.now(); }, [b.cardId]);

  const float = useCallback((text: string, cls: string, target: 'enemy' | 'player') => {
    const f = { id: fid.current++, text, cls, target, x: Math.random() * 60 - 30 };
    setFloaters(x => [...x, f]);
    setTimeout(() => setFloaters(x => x.filter(y => y.id !== f.id)), 1300);
  }, []);

  useEffect(() => subscribe(events => {
    let delay = 0;
    for (const e of events) {
      switch (e.type) {
        case 'damage': {
          float(`−${fmt(e.amount)}`, e.perfect ? 'fl-perfect' : e.crit ? 'fl-crit' : 'fl-dmg', 'enemy');
          if (e.perfect) showBanner('PERFEITO!', 'bn-perfect');
          else if (e.crit) showBanner('CRÍTICO!', 'bn-crit');
          if (e.weak) setTimeout(() => float('FRAQUEZA!', 'fl-weak', 'enemy'), 150);
          setFx(f => ({ ...f, enemyHit: f.enemyHit + 1, crit: e.crit ? f.crit + 1 : f.crit }));
          burst(e.crit ? 18 : 8, e.perfect ? '#ffd76a' : e.crit ? '#ff9d3a' : '#e8d8b0');
          if (e.crit) sfx.crit(); else sfx.hit();
          break;
        }
        case 'hurt':
          float(`−${fmt(e.amount)}`, 'fl-hurt', 'player');
          setFx(f => ({ ...f, playerHit: f.playerHit + 1 }));
          sfx.hurt();
          break;
        case 'miss': float('ERROU', 'fl-miss', 'enemy'); break;
        case 'drop': delay += 150; setTimeout(() => float(e.text, 'fl-drop', 'enemy'), delay + 300); break;
        case 'heal': float(`+${fmt(e.amount)} HP`, 'fl-heal', 'player'); break;
        case 'xp': delay += 120; setTimeout(() => float(`+${fmt(e.amount)} XP`, 'fl-xp', 'player'), delay); break;
        case 'gold': delay += 120; setTimeout(() => float(`+${fmt(e.amount)} 🪙`, 'fl-gold', 'player'), delay); break;
        case 'combo': if (e.value % 5 === 0 || e.value === 3) showBanner(`${e.label} x${e.value}`, 'bn-combo'); break;
        case 'kill':
          setKilled(e.name);
          setFx(f => ({ ...f, kill: f.kill + 1 }));
          setTimeout(() => setKilled(null), 1100);
          sfx.kill();
          break;
        case 'phase': setDialog({ name: e.name, taunt: e.taunt }); break;
        case 'faint': setDialog(null); break;
      }
    }
  }), [subscribe, float]); // eslint-disable-line react-hooks/exhaustive-deps

  function showBanner(text: string, cls: string) {
    const id = Date.now() + Math.random();
    setBanner({ id, text, cls });
    setTimeout(() => setBanner(bn => (bn?.id === id ? null : bn)), 900);
  }

  function burst(n: number, color: string) {
    const ps = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 70;
      return { id: fid.current++, dx: Math.cos(a) * r, dy: Math.sin(a) * r, color };
    });
    setParticles(x => [...x, ...ps]);
    setTimeout(() => setParticles(x => x.filter(p => !ps.includes(p))), 700);
  }

  const reveal = useCallback(() => { if (card && !revealed) { setRevealed(true); sfx.flip(); } }, [card, revealed]);

  const grade = useCallback((g: Grade) => {
    if (!revealed || !card) return;
    const ms = Math.min(60_000, Date.now() - shownAt.current);
    run(x => answer(x, g, ms));
  }, [revealed, card, run]);

  const finish = useCallback(() => {
    const stats = { ...b.session };
    run(endSession);
    onEnd(stats);
  }, [b.session, run, onEnd]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!revealed) reveal(); else grade(3);
      } else if (['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) as Grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reveal, grade, revealed]);

  const enemy = b.enemy;
  const bossReady = !enemy.isBoss && canFightBoss(s, b.regionId);
  const elapsed = Date.now() - b.session.startedAt;
  const cls = CLASS_BY_ID[p.classId];

  return (
    <div className={`arena${fx.playerHit ? ' ' : ''}`}>
      <div className="arena-top">
        <div className="arena-region">
          <span>{region.icon}</span>
          <div>
            <b>{region.name}</b>
            <small className="muted">{b.deckId ? s.decks.find(x => x.id === b.deckId)?.name : 'Todos os decks'}{b.practice && ' · Treino livre'}</small>
          </div>
        </div>
        <Minimap kills={rp.kills} need={region.killsForBoss} boss={enemy.isBoss} />
        <div className="arena-queue">
          <span className="c-new" title="Novos">{counts.fresh}</span>
          <span className="c-learn" title="Aprendendo">{counts.learning}</span>
          <span className="c-due" title="Para revisar">{counts.review}</span>
        </div>
      </div>

      <div className="stage">
        <div className="stage-bg" data-region={region.id} />
        {/* Jogador */}
        <div key={`p${fx.playerHit}`} className={`fighter player${fx.playerHit ? ' hit' : ''}`}>
          <div className="fighter-portrait player-portrait"><span>{cls.icon}</span></div>
          <div className="fighter-info">
            <b>{p.name}</b> <small className="muted">Nv {p.level}</small>
            <Bar kind="hp" value={p.hp} max={d.maxHp} label={`${fmt(p.hp)}/${fmt(d.maxHp)}`} />
            <Bar kind="mana" value={p.mana} max={d.maxMana} label={`${fmt(p.mana)}/${fmt(d.maxMana)}`} />
          </div>
          {floaters.filter(f => f.target === 'player').map(f => (
            <span key={f.id} className={`floater ${f.cls}`} style={{ left: `calc(50% + ${f.x}px)` }}>{f.text}</span>
          ))}
          {p.combo >= 2 && (
            <div key={p.combo} className={`combo-counter${p.combo >= 10 ? ' hot' : ''}${p.combo >= 50 ? ' absurd' : ''}`}>
              COMBO <b>x{p.combo}</b>
            </div>
          )}
        </div>

        <div className="versus">VS</div>

        {/* Inimigo */}
        <div className={`fighter enemy${enemy.isBoss ? ' boss' : ''}`}>
          <div className="fighter-info">
            <div className="enemy-name">
              {enemy.isBoss && <span className="boss-tag">BOSS</span>}
              <b>{enemy.name}</b> <small className="muted">Nv {enemy.level}</small>
            </div>
            <Bar kind="enemy" big={enemy.isBoss} value={enemy.hp} max={enemy.maxHp} label={`${fmt(enemy.hp)} / ${fmt(enemy.maxHp)}`} />
            {enemy.isBoss && (
              <div className="phases">
                {enemy.phases.map((ph, i) => <span key={ph} className={i < enemy.phase ? 'done' : i === enemy.phase ? 'now' : ''}>{ph}</span>)}
              </div>
            )}
            {s.settings.weaknesses && enemy.weakness.length > 0 && (
              <div className="weakness">Fraqueza: {enemy.weakness.map(w => <span key={w}>{w}</span>)}</div>
            )}
          </div>
          <div key={`${enemy.defId}-${enemy.maxHp}-${fx.kill}`} className="enemy-wrap spawn">
            <div key={fx.enemyHit} className={`fighter-portrait enemy-portrait${fx.enemyHit ? ' hit' : ''}${fx.crit ? '' : ''}`}>
              <span>{enemy.icon}</span>
            </div>
            {particles.map(pt => (
              <i key={pt.id} className="particle" style={{ '--dx': `${pt.dx}px`, '--dy': `${pt.dy}px`, background: pt.color } as React.CSSProperties} />
            ))}
          </div>
          {floaters.filter(f => f.target === 'enemy').map(f => (
            <span key={f.id} className={`floater ${f.cls}`} style={{ left: `calc(50% + ${f.x}px)` }}>{f.text}</span>
          ))}
          {killed && <div className="killed">{killed} derrotado!</div>}
        </div>
        {banner && <div key={banner.id} className={`banner ${banner.cls}`}>{banner.text}</div>}
      </div>

      {dialog && (
        <div className="dialog-box" onClick={() => setDialog(null)}>
          <div className="dialog-portrait">{enemy.icon}</div>
          <div>
            <div className="dialog-name">{enemy.name} — <em>Fase: {dialog.name}</em></div>
            <p>{dialog.taunt}</p>
          </div>
          <button className="btn btn-sm">✕</button>
        </div>
      )}

      <div className="arena-main">
        <div className="card-zone">
          {card ? (
            <div className={`flashcard${revealed ? ' revealed' : ''}${card.hard ? ' is-hard' : ''}`}>
              <div className="fc-meta">
                <span className="fc-deck">{deckName}</span>
                {card.tags.slice(0, 4).map(t => <span key={t} className="fc-tag">#{t}</span>)}
                {card.state === 'new' && <span className="fc-badge new">NOVO</span>}
                {card.hard && <span className="fc-badge hard">CARD DIFÍCIL · recompensa especial</span>}
              </div>
              <div className="fc-q">{card.front}</div>
              {revealed && (
                <>
                  <div className="fc-sep" />
                  <div className="fc-a">{card.back}</div>
                </>
              )}
              <div className="fc-actions">
                {!revealed ? (
                  <button className="btn btn-primary btn-big reveal" onClick={reveal}>Revelar resposta <kbd>Espaço</kbd></button>
                ) : (
                  <div className="grades">
                    {GRADES.map(gr => (
                      <button key={gr.g} className={`grade ${gr.cls}`} onClick={() => grade(gr.g)}>
                        <small>{b.practice && card.state === 'review' && card.due > Date.now() ? 'treino' : previewLabel(card, gr.g)}</small>
                        <b><span className="long">{gr.label}</span><span className="short">{gr.short}</span></b>
                        <kbd>{gr.g}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {revealed && <p className="honesty muted small">Seja honesto: "Dominei" empurra o card para longe — errar agora é melhor que esquecer na prova.</p>}
            </div>
          ) : (
            <div className="flashcard done">
              <h2 className="cinzel">🏁 Masmorra limpa!</h2>
              <p>Você revisou todos os cards pendentes {b.deckId ? 'deste deck' : ''} por agora. Excelente trabalho.</p>
              <p className="muted small">Volte mais tarde para as próximas revisões — a repetição espaçada é o que fixa o conteúdo.</p>
              <div className="row-center">
                <button className="btn btn-primary" onClick={finish}>Encerrar e receber bônus</button>
                <button className="btn" onClick={() => run(enterPractice)}>Treino livre (25% XP)</button>
              </div>
            </div>
          )}
        </div>

        <aside className="arena-side">
          <Panel title="Habilidades">
            <div className="skills">
              {SKILLS.map(sk => {
                const locked = p.level < sk.level;
                const active = (sk.id === 'foco' && b.focus) || (sk.id === 'protecao' && b.ward);
                return (
                  <button key={sk.id} className={`skill${active ? ' active' : ''}`} disabled={locked || p.mana < sk.mana || active}
                    onClick={() => run(x => useSkill(x, sk.id))} title={`${sk.desc} (${sk.mana} mana)`}>
                    <span>{locked ? '🔒' : sk.icon}</span>
                    <small>{locked ? `Nv ${sk.level}` : `${sk.mana} MP`}</small>
                  </button>
                );
              })}
              <button className="skill" disabled={!s.consumables.hpPotion || p.hp >= d.maxHp} onClick={() => run(x => usePotion(x, 'hp'))} title="Poção de Vida">
                <span>🧪</span><small>×{s.consumables.hpPotion}</small>
              </button>
              <button className="skill" disabled={!s.consumables.manaPotion || p.mana >= d.maxMana} onClick={() => run(x => usePotion(x, 'mana'))} title="Poção de Mana">
                <span>🔷</span><small>×{s.consumables.manaPotion}</small>
              </button>
            </div>
          </Panel>
          <Panel title="Sessão">
            <ul className="kv">
              <li><span>Cards</span><b>{b.session.answered}</b></li>
              <li><span>Acertos</span><b>{b.session.answered ? Math.round((100 * b.session.correct) / b.session.answered) : 0}%</b></li>
              <li><span>XP</span><b className="xp-text">+{fmt(b.session.xp)}</b></li>
              <li><span>Ouro</span><b className="gold-text">+{fmt(b.session.gold)}</b></li>
              <li><span>Abates</span><b>{b.session.kills}</b></li>
              <li><span>Tempo</span><b>{fmtDuration(elapsed)}</b></li>
            </ul>
            {b.session.answered < 10 && <p className="muted small">Responda {10 - b.session.answered} cards para garantir o bônus de sessão.</p>}
          </Panel>
          {bossReady && (
            <button className="btn btn-boss" onClick={() => run(challengeBoss)}>☠️ Enfrentar {region.boss.name}</button>
          )}
          <div className="row">
            <button className="btn btn-sm" onClick={finish}>Encerrar sessão</button>
            <button className="btn btn-sm" onClick={() => go('map')}>Mapa</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Minimap({ kills, need, boss }: { kills: number; need: number; boss: boolean }) {
  return (
    <div className="minimap" title="Progresso da região">
      {Array.from({ length: need }, (_, i) => (
        <span key={i} className={`mm-node${i < kills ? ' done' : ''}${!boss && i === kills ? ' here' : ''}`} />
      ))}
      <span className={`mm-node mm-boss${boss ? ' here' : ''}${kills >= need ? ' ready' : ''}`}>☠</span>
    </div>
  );
}

function SessionSummary({ stats, onClose }: { stats: SessionStats; onClose: () => void }) {
  const { go } = useGame();
  const acc = stats.answered ? Math.round((100 * stats.correct) / stats.answered) : 0;
  return (
    <Modal onClose={onClose} className="summary-modal">
      <h2 className="cinzel">Relatório da Expedição</h2>
      <div className="summary-grid">
        <div><b>{stats.answered}</b><span>cards</span></div>
        <div><b>{acc}%</b><span>acertos</span></div>
        <div><b className="xp-text">+{fmt(stats.xp)}</b><span>XP</span></div>
        <div><b className="gold-text">+{fmt(stats.gold)}</b><span>ouro</span></div>
        <div><b>{stats.kills}</b><span>abates</span></div>
        <div><b>x{stats.maxCombo}</b><span>maior combo</span></div>
      </div>
      {stats.loot.length > 0 && <p className="muted">Itens: {stats.loot.join(', ')}</p>}
      {stats.answered < 10 && <p className="muted small">Sessões com 10+ cards recebem um bônus de XP e ouro.</p>}
      <div className="row-center">
        <button className="btn btn-primary" onClick={() => { onClose(); go('dashboard'); }}>Voltar à vila</button>
        <button className="btn" onClick={() => { onClose(); go('inventory'); }}>Inventário</button>
      </div>
    </Modal>
  );
}
