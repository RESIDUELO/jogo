export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function uid(prefix = ''): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Hash determinístico (FNV-1a) → [0, 1). Usado para comportamento consistente dos bots. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/** PRNG com semente (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, rnd: () => number = Math.random): T | undefined {
  let total = 0;
  const ws = items.map((i) => {
    const w = Math.max(0, weight(i));
    total += w;
    return w;
  });
  if (total <= 0) return items[Math.floor(rnd() * items.length)];
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Segunda-feira da semana (chave) — ranking semanal. */
export function weekStart(t = Date.now()): number {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('pt-BR');
export const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
export const fmtSec = (ms: number) => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
