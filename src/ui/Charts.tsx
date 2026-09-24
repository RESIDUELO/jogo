// Gráficos SVG leves (sem dependências).
export function LineChart({ points, height = 160, color = '#a78bfa', yMax = 1, fmt = (v: number) => `${Math.round(v * 100)}%`, bars }: { points: { label: string; v: number }[]; height?: number; color?: string; yMax?: number; fmt?: (v: number) => string; bars?: number[] }) {
  if (points.length === 0) return <div className="text-sm text-white/50 py-8 text-center">Sem dados ainda.</div>;
  const W = 600;
  const H = height;
  const pad = { l: 36, r: 10, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / yMax) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  const area = `${d} L${x(points.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
  const bmax = bars ? Math.max(1, ...bars) : 1;
  const step = Math.max(1, Math.ceil(points.length / 7));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g * yMax)} y2={y(g * yMax)} stroke="#ffffff14" />
          <text x={pad.l - 6} y={y(g * yMax)} fill="#ffffff66" fontSize="10" textAnchor="end" dominantBaseline="middle">
            {fmt(g * yMax)}
          </text>
        </g>
      ))}
      {bars?.map((b, i) => {
        const bw = Math.max(3, (iw / points.length) * 0.5);
        const bh = (b / bmax) * ih * 0.35;
        return <rect key={i} x={x(i) - bw / 2} y={pad.t + ih - bh} width={bw} height={bh} rx={2} fill="#ffffff1f" />;
      })}
      <path d={area} fill="url(#lc-fill)" />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.v)} r={3.5} fill={color}>
            <title>
              {p.label}: {fmt(p.v)}
              {bars ? ` · ${bars[i]} questões` : ''}
            </title>
          </circle>
          {i % step === 0 && (
            <text x={x(i)} y={H - 6} fill="#ffffff66" fontSize="10" textAnchor="middle">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function Donut({ value, color, size = 84, label }: { value: number; color: string; size?: number; label?: string }) {
  const r = 15.9;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#ffffff14" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${value * c} ${c}`} style={{ transition: 'stroke-dasharray 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="font-display font-bold" style={{ fontSize: size * 0.22 }}>
            {Math.round(value * 100)}%
          </div>
          {label && <div className="text-[9px] text-white/50 mt-0.5">{label}</div>}
        </div>
      </div>
    </div>
  );
}
