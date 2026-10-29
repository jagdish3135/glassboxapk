import { useEffect, useMemo, useState } from 'react';
import { loadBus } from './story';

// An isometric cube split into 12 glass shards. Each shard flies into place as loading progresses.
const C = [50, 50], T = [50, 14], UR = [81, 32], LR = [81, 68], B = [50, 86], LL = [19, 68], UL = [19, 32];
const FACES: { pts: number[][]; tone: string }[] = [
  { pts: [T, UR, C, UL], tone: 'top' },
  { pts: [UR, LR, B, C], tone: 'right' },
  { pts: [UL, C, B, LL], tone: 'left' },
];

// The loader starts leaving by 2.4 s at the latest, so the page is never blocked for more than ~3 s.
const MAX_WAIT = 2400;

export function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  const shards = useMemo(() => {
    const out: { d: string; tone: string; dx: number; dy: number; r: number }[] = [];
    FACES.forEach((f, fi) => {
      const [a, b, c, d] = f.pts;
      const m = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4];
      [[a, b], [b, c], [c, d], [d, a]].forEach(([p, q], k) => {
        const i = fi * 4 + k;
        const ang = (i * 137.5 * Math.PI) / 180;
        out.push({
          d: `M${p[0]} ${p[1]}L${q[0]} ${q[1]}L${m[0]} ${m[1]}Z`,
          tone: f.tone,
          dx: Math.cos(ang) * (60 + (i % 3) * 18),
          dy: Math.sin(ang) * (60 + (i % 4) * 14),
          r: ((i * 53) % 90) - 45,
        });
      });
    });
    return out;
  }, []);

  useEffect(() => {
    const off = loadBus.on(setPct);
    const cap = window.setTimeout(() => setPct(100), MAX_WAIT);
    return () => { off(); clearTimeout(cap); };
  }, []);

  useEffect(() => {
    if (pct < 100 || leaving) return;
    const t1 = window.setTimeout(() => { setLeaving(true); onDone(); }, 180);
    return () => clearTimeout(t1);
  }, [pct, leaving, onDone]);

  useEffect(() => {
    if (!leaving) return;
    const t2 = window.setTimeout(() => setGone(true), 650);
    return () => clearTimeout(t2);
  }, [leaving]);

  if (gone) return null;
  const placed = Math.round((pct / 100) * shards.length);

  return (
    <div className={`loader${leaving ? ' loader-out' : ''}`} data-loader={leaving ? 'done' : 'loading'}>
      <div className="loader-in" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="loader-cube">
          {shards.map((s, i) => (
            <path key={i} d={s.d} className={`shard shard-${s.tone}${i < placed ? ' in' : ''}`}
              style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, ['--r' as string]: `${s.r}deg`, ['--i' as string]: i }} />
          ))}
        </svg>
        <p className="loader-pct">{String(Math.round(pct)).padStart(3, '0')}<span>%</span></p>
        <p className="loader-cap">Assembling the glass box</p>
      </div>
      <p className="sr-only" role="status">{leaving ? 'Loaded' : 'Loading'}</p>
    </div>
  );
}
