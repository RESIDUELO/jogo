// Peças visuais da partida, compartilhadas entre a partida local/bot e a online.
import { CAT, CATEGORIES } from '../data/categories';
import { missingCrowns, setupCats, type CompetitorState, type MatchState } from '../engine/match';
import type { CategoryId, Question } from '../types';
import { altLetters } from '../types';
import { AltContent, IMG_BASE } from './QuestionPlay';
import { topicLabel } from '../engine/cards';
import { COSMETIC } from '../data/shop';
import type { Competitor } from '../engine/match';
import { levelFromXp } from '../engine/progression';
import type { Player } from '../types';
import { Avatar } from './common';

export function competitorFromPlayer(p: Player): Competitor {
  return {
    id: p.id,
    name: p.name,
    avatar: COSMETIC[p.cosmetics.avatar]?.value ?? '🩺',
    frame: COSMETIC[p.cosmetics.frame]?.value,
    kind: 'human',
    level: levelFromXp(p.xp).level,
    rating: p.rating,
  };
}

export type Overlay = { kind: 'intro' } | { kind: 'turn'; text: string; sub?: string } | { kind: 'cat'; cat: CategoryId; crown?: boolean } | null;

export interface OpponentView {
  q: Question;
  phase: 'thinking' | 'result';
  correct: boolean;
  chosen: string | null;
  ms: number;
  points: number;
}

export function Overlays({ overlay, match }: { overlay: Overlay; match: MatchState }) {
  if (!overlay) return null;
  if (overlay.kind === 'intro') return <VsIntro a={match.players[0]} b={match.players[1]} mode={match.mode} match={match} />;
  if (overlay.kind === 'turn')
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-none">
        <div className="text-center animate-pop">
          <div className="font-display text-4xl sm:text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,.4)]">{overlay.text}</div>
          {overlay.sub && <div className="mt-2 text-white/70">{overlay.sub}</div>}
        </div>
      </div>
    );
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center pointer-events-none" style={{ background: `radial-gradient(circle, ${CAT[overlay.cat].color}88, #0b0a1fee 70%)` }}>
      <div className="text-center animate-pop">
        <div className="text-7xl mb-2">{overlay.crown ? '👑' : CAT[overlay.cat].icon}</div>
        <div className="font-display text-5xl font-bold text-white drop-shadow-[0_4px_0_rgba(0,0,0,.35)]">{CAT[overlay.cat].name}!</div>
        {overlay.crown && <div className="text-amber-200 mt-1 font-semibold">Pergunta da coroa</div>}
      </div>
    </div>
  );
}

function CrownSlots({ p, small, cats }: { p: CompetitorState; small?: boolean; cats: CategoryId[] }) {
  return (
    <div className="flex gap-1">
      {CATEGORIES.filter((c) => cats.includes(c.id)).map((c) => {
        const has = p.crowns.includes(c.id);
        return (
          <div
            key={c.id}
            title={c.full}
            className={`${small ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm'} rounded-full grid place-items-center border-2 transition ${has ? 'animate-pop' : 'opacity-40 grayscale'}`}
            style={{ background: has ? c.color : 'transparent', borderColor: c.color }}
          >
            {has ? c.icon : ''}
          </div>
        );
      })}
    </div>
  );
}

export function MatchHud({ match }: { match: MatchState }) {
  const [a, b] = match.players;
  const side = (p: CompetitorState, idx: 0 | 1) => {
    const active = match.turn === idx && match.phase !== 'end';
    return (
      <div className={`flex-1 min-w-0 rounded-2xl p-2.5 sm:p-3 border transition ${active ? 'bg-violet-500/20 border-violet-400/60 shadow-lg shadow-violet-500/20' : 'bg-ink-800/70 border-white/5'} ${idx === 1 ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 ${idx === 1 ? 'flex-row-reverse' : ''}`}>
          <Avatar emoji={p.avatar} frame={p.frame} size={40} />
          <div className="min-w-0">
            <div className="font-display font-semibold truncate text-sm sm:text-base">{p.name}</div>
            <div className="text-[11px] text-white/50">
              Nível {p.level} {p.kind === 'bot' && '· BOT'}
            </div>
          </div>
        </div>
        <div className={`mt-2 flex ${idx === 1 ? 'justify-end' : ''}`}>
          <CrownSlots p={p} small cats={setupCats(match)} />
        </div>
        <div className={`mt-2 flex items-center gap-2 ${idx === 1 ? 'flex-row-reverse' : ''}`}>
          <div className="flex gap-1">
            {Array.from({ length: match.config.meterSize }).map((_, i) => (
              <div key={i} className={`w-4 h-2 rounded-full ${i < p.meter ? 'bg-amber-300 shadow shadow-amber-300/50' : 'bg-white/15'}`} />
            ))}
          </div>
          <div className="font-display text-sm text-amber-200">{p.score.toLocaleString('pt-BR')}</div>
          {p.streak >= 2 && <div className="text-[11px] text-orange-300">🔥{p.streak}</div>}
        </div>
      </div>
    );
  };
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2 bg-ink-950/85 backdrop-blur">
      <div className="flex items-stretch gap-2">
        {side(a, 0)}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="font-display text-xl font-bold text-white/80">VS</div>
          <div className="text-[10px] text-white/40 whitespace-nowrap">
            {Math.min(match.round, match.config.maxRounds)}/{match.config.maxRounds}
          </div>
        </div>
        {side(b, 1)}
      </div>
    </div>
  );
}

function VsIntro({ a, b, mode, match }: { a: CompetitorState; b: CompetitorState; mode: string; match: MatchState }) {
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-gradient-to-br from-indigo-950 via-ink-950 to-fuchsia-950">
      <div className="w-full max-w-md px-6">
        <div className="text-center text-xs tracking-[0.3em] text-white/50 mb-2">{mode === 'ranked' ? 'PARTIDA RANQUEADA' : mode === 'pvp-local' ? 'DUELO LOCAL' : mode === 'pvp-online' ? 'DUELO ONLINE' : 'DUELO'}</div>
        <div className="flex justify-center gap-1">
          {setupCats(match).map((c) => (
            <span key={c} className="w-7 h-7 rounded-full grid place-items-center text-sm" style={{ background: CAT[c].color }}>
              {CAT[c].icon}
            </span>
          ))}
        </div>
        <div className="text-center text-[11px] text-white/50 mt-2 mb-6 px-2">
          {match.setup.topics?.length ? match.setup.topics.slice(0, 3).map((t) => topicLabel(t) || CAT[t as CategoryId]?.name).join(' · ') + (match.setup.topics.length > 3 ? ` +${match.setup.topics.length - 3}` : '') : 'Todos os temas'}
          <br />
          ⏱️ {match.setup.timeSec} s por pergunta
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center animate-slideIn">
            <Avatar emoji={a.avatar} frame={a.frame} size={88} className="mx-auto" />
            <div className="font-display mt-2 font-bold">{a.name}</div>
            <div className="text-xs text-white/50">
              Nível {a.level} · {a.rating}
            </div>
          </div>
          <div className="font-display text-5xl font-bold text-amber-300 animate-pop [animation-delay:400ms]">VS</div>
          <div className="text-center animate-slideIn [animation-delay:200ms]">
            <Avatar emoji={b.avatar} frame={b.frame} size={88} className="mx-auto" />
            <div className="font-display mt-2 font-bold">{b.name}</div>
            <div className="text-xs text-white/50">
              Nível {b.level} · {b.rating}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrownChoice({ player, match, onChoose }: { player: CompetitorState; match: MatchState; onChoose: (c: CategoryId) => void }) {
  const miss = missingCrowns(player, match);
  return (
    <div className="text-center animate-pop pt-4">
      <div className="text-6xl animate-glow">👑</div>
      <h2 className="font-display text-3xl font-bold mt-2">Medidor cheio!</h2>
      <p className="text-white/60 mt-1 mb-5">Escolha a coroa que você quer disputar. Acertando a pergunta, a coroa é sua.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
        {miss.map((c) => (
          <button
            key={c}
            onClick={() => onChoose(c)}
            className="rounded-2xl p-4 font-display font-bold text-white border-b-4 hover:-translate-y-1 active:translate-y-0 transition shadow-lg"
            style={{ background: `linear-gradient(160deg, ${CAT[c].color}, ${CAT[c].dark})`, borderColor: CAT[c].dark }}
          >
            <div className="text-3xl">{CAT[c].icon}</div>
            {CAT[c].name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OpponentTurnCard({ view, name, avatar, onSkip }: { view: OpponentView; name: string; avatar: string; onSkip?: () => void }) {
  const c = CAT[view.q.category];
  const done = view.phase === 'result';
  const flash = view.q.kind === 'flash';
  return (
    <div className="rounded-3xl p-5 border border-white/10 bg-ink-800/80 animate-slideIn">
      <div className="flex items-center gap-3">
        <div className="text-4xl">{avatar}</div>
        <div className="min-w-0">
          <div className="font-display font-semibold">{name} está respondendo</div>
          <div className="text-xs truncate" style={{ color: c.color }}>
            {c.icon} {c.name} · {view.q.subtopic}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-black/25 p-4">
        <p className="text-base sm:text-lg leading-relaxed whitespace-pre-line">{view.q.text}</p>
        {view.q.images?.map((img) => <img key={img} src={IMG_BASE + img} alt="" className="mt-2 w-full max-h-60 object-contain rounded-xl bg-white" loading="lazy" />)}
      </div>
      {!flash && (
        <div className="mt-3 space-y-1.5 text-sm">
          {altLetters(view.q).map((l) => (
            <div
              key={l}
              className={`rounded-xl px-3 py-2 border ${
                done && l === view.q.answer ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100' : done && l === view.chosen ? 'border-rose-400/60 bg-rose-500/15 text-rose-100' : 'border-white/10 bg-white/5 text-white/80'
              }`}
            >
              <b className="mr-1">{l})</b> <AltContent q={view.q} l={l} />
            </div>
          ))}
        </div>
      )}
      {flash && done && (
        <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm whitespace-pre-line">
          <div className="text-[11px] tracking-wider text-emerald-300 mb-1">RESPOSTA</div>
          {view.q.answerText}
        </div>
      )}
      {view.phase === 'thinking' ? (
        <div className="mt-4 flex items-center gap-2 text-white/80">
          <span className="thinking-dots">
            <i />
            <i />
            <i />
          </span>
          pensando...
        </div>
      ) : (
        <div className={`mt-4 rounded-2xl p-3 font-display text-xl font-bold animate-pop ${view.correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
          {view.correct ? `✔ Acertou! +${view.points} pts` : view.chosen ? `✖ Errou (marcou ${view.chosen})` : flash && view.ms > 0 ? '✖ Errou' : '⏰ Tempo esgotado'}
          <span className="block text-xs font-sans font-normal text-white/50 mt-0.5">
            {(view.ms / 1000).toFixed(1)} s{!flash && view.q.answer ? ` · resposta correta: ${view.q.answer}` : ''}
          </span>
        </div>
      )}
      {done && onSkip && (
        <div className="mt-3 text-right">
          <button onClick={onSkip} className="text-xs text-white/50 hover:text-white underline">
            pular ›
          </button>
        </div>
      )}
    </div>
  );
}
