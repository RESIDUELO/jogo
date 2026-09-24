// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; slideTo?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const v = opts.vol ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function arpeggio(notes: number[], step: number, dur: number, type: OscillatorType = 'triangle', vol = 0.16) {
  notes.forEach((n, i) => tone(n, dur, { type, vol, delay: i * step }));
}

export const sfx = {
  click: () => tone(660, 0.05, { type: 'square', vol: 0.05 }),
  tick: () => tone(1200 + Math.random() * 200, 0.03, { type: 'square', vol: 0.05 }),
  spinStart: () => tone(220, 0.35, { type: 'sawtooth', vol: 0.06, slideTo: 660 }),
  land: () => arpeggio([523, 784], 0.08, 0.2, 'triangle', 0.14),
  correct: () => arpeggio([523, 659, 784, 1047], 0.07, 0.22),
  wrong: () => {
    tone(220, 0.25, { type: 'sawtooth', vol: 0.1, slideTo: 140 });
    tone(207, 0.3, { type: 'square', vol: 0.05, delay: 0.05, slideTo: 110 });
  },
  timeTick: () => tone(880, 0.06, { type: 'square', vol: 0.07 }),
  timeout: () => tone(330, 0.5, { type: 'sawtooth', vol: 0.1, slideTo: 90 }),
  xp: () => arpeggio([880, 1175], 0.05, 0.12, 'sine', 0.1),
  coin: () => arpeggio([1319, 1760], 0.06, 0.12, 'square', 0.05),
  crown: () => arpeggio([392, 523, 659, 784, 1047, 1319], 0.08, 0.35, 'triangle', 0.16),
  achievement: () => arpeggio([659, 784, 988, 1319], 0.1, 0.4, 'triangle', 0.15),
  levelUp: () => {
    arpeggio([523, 659, 784, 1047, 1319, 1568], 0.07, 0.3, 'square', 0.07);
    arpeggio([262, 330, 392, 523], 0.1, 0.5, 'triangle', 0.12);
  },
  victory: () => {
    arpeggio([523, 523, 523, 698], 0.13, 0.25, 'square', 0.08);
    arpeggio([784, 880, 1047], 0.15, 0.6, 'triangle', 0.14);
  },
  defeat: () => arpeggio([392, 370, 349, 262], 0.22, 0.45, 'triangle', 0.13),
  powerup: () => tone(440, 0.3, { type: 'sine', vol: 0.14, slideTo: 1320 }),
};
