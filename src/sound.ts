// Efeitos sonoros sintetizados (Web Audio) — sem arquivos externos.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) { enabled = v; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  hit: () => { tone(180, 0.12, 'square', 0.05, 0, -80); tone(90, 0.15, 'triangle', 0.06); },
  crit: () => { tone(220, 0.1, 'square', 0.06, 0, -100); tone(660, 0.18, 'triangle', 0.05, 0.05); tone(990, 0.2, 'sine', 0.04, 0.1); },
  hurt: () => { tone(120, 0.25, 'sawtooth', 0.05, 0, -60); },
  flip: () => { tone(520, 0.06, 'sine', 0.03); },
  kill: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, i * 0.07)); },
  loot: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'sine', 0.04, i * 0.06)); },
  level: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.05, i * 0.09)); },
  quest: () => { tone(880, 0.12, 'sine', 0.04); tone(1320, 0.2, 'sine', 0.04, 0.1); },
};
