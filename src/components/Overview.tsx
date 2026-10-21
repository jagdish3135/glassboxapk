import { useEffect, useState } from 'react';
import type { Report, SdkCategory } from '../types';

const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const SIZE_COLORS = ['var(--ink)', 'var(--signal)', 'var(--steel)', 'var(--violet)', 'var(--ink-3)'];

export function Overview({ report }: { report: Report }) {
  const r = report;
  const dangerous = r.permissions.filter((p) => p.risk !== 'normal');
  const byCat = r.sdks.reduce<Record<string, typeof r.sdks>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {});
  const cats = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length) as SdkCategory[];
  const total = r.size.reduce((a, p) => a + p.bytes, 0) || 1;

  return (
    <div className="overview">
      <section className="card stack-card reveal" style={{ ['--d' as string]: '0ms' }}>
        <p className="eyebrow">Built with</p>
        <h3 className="stack-name">{r.stack.primary}</h3>
        <p className="stack-lang">{r.stack.language}</p>
        <ul className="signals">
          {r.stack.signals.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </section>

      <section className="metrics reveal" style={{ ['--d' as string]: '60ms' }}>
        <Metric n={r.sdks.length} label="SDKs and libraries" />
        <Metric n={dangerous.length} label="Sensitive permissions" warn={dangerous.length > 0} />
        <Metric n={r.entryPoints.length} label="Entry points" />
        <Metric n={r.components.activities} label="Activities" />
        <Metric n={r.hosts.length} label="Hosts in code" />
        <Metric n={r.apiPaths.length} label="API paths found" />
      </section>

      <section className="card sdk-card reveal" style={{ ['--d' as string]: '120ms' }}>
        <header className="card-head"><h3>SDKs and libraries</h3><span className="count">{r.sdks.length}</span></header>
        {cats.length === 0 && <p className="muted">No known SDKs matched. The code may be heavily obfuscated.</p>}
        <div className="sdk-groups">
          {cats.map((c) => (
            <div key={c} className="sdk-group">
              <p className="sdk-cat">{c}</p>
              <ul className="chips">
                {byCat[c].map((s) => (
                  <li key={s.name}>
                    <span className="chip chip-tip" tabIndex={0} data-tip={s.evidence}>{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card perm-card reveal" style={{ ['--d' as string]: '180ms' }}>
        <header className="card-head"><h3>Permissions</h3><span className="count">{r.permissions.length}</span></header>
        <ul className="perms">
          {r.permissions.map((p) => (
            <li key={p.name} className={`perm perm-${p.risk}`}>
              <span className="perm-name">{p.short}</span>
              <span className="perm-why">{p.why ?? (p.name.startsWith('android.permission.') ? 'Granted at install' : p.name.split('.').slice(0, -2).join('.'))}</span>
              {p.risk !== 'normal' && <span className="perm-tag">{p.risk}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card entry-card reveal" style={{ ['--d' as string]: '240ms' }}>
        <header className="card-head"><h3>Entry points</h3><span className="count">{r.entryPoints.length}</span></header>
        <p className="muted small">Every way the app can be started. Each one is the start of at least one flow.</p>
        <ul className="entries">
          {r.entryPoints.slice(0, 30).map((e, i) => (
            <li key={i}>
              <span className={`entry-kind ek-${e.kind.replace(' ', '-')}`}>{e.kind}</span>
              <span className="entry-target mono">{e.target.split('.').pop()}</span>
              <span className="entry-detail">{e.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card size-card reveal" style={{ ['--d' as string]: '300ms' }}>
        <header className="card-head"><h3>What takes up space</h3><span className="count">{fmtBytes(r.app.sizeBytes)}</span></header>
        <div className="sizebar" role="img" aria-label="APK size breakdown">
          {r.size.map((p, i) => <span key={p.label} style={{ width: `${(p.bytes / total) * 100}%`, background: SIZE_COLORS[i % SIZE_COLORS.length], ['--i' as string]: i }} />)}
        </div>
        <ul className="size-legend">
          {r.size.map((p, i) => (
            <li key={p.label}><i style={{ background: SIZE_COLORS[i % SIZE_COLORS.length] }} />{p.label}<span>{fmtBytes(p.bytes)} · {Math.round((p.bytes / total) * 100)}%</span></li>
          ))}
        </ul>
        {r.stack.abis.length > 0 && <p className="muted small">CPU architectures: <span className="mono">{r.stack.abis.join(', ')}</span></p>}
      </section>

      <section className="card net-card reveal" style={{ ['--d' as string]: '360ms' }}>
        <header className="card-head"><h3>Network surface</h3></header>
        <div>
          <p className="sdk-cat">Hosts found in the code</p>
          {r.hosts.length ? <ul className="mono-list">{r.hosts.map((h) => <li key={h}>{h}</li>)}</ul> : <p className="muted small">None found. URLs may be built at runtime or loaded from config.</p>}
        </div>
        <div>
          <p className="sdk-cat">API paths</p>
          {r.apiPaths.length ? <ul className="mono-list">{r.apiPaths.map((h) => <li key={h}>{h}</li>)}</ul> : <p className="muted small">No versioned API paths found in string constants.</p>}
        </div>
      </section>
    </div>
  );
}

function useCountUp(target: number, ms = 900, delay = 150) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const u = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(Math.round(target * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

function Metric({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  const v = useCountUp(n);
  return (
    <div className={`metric${warn ? ' metric-warn' : ''}`}>
      <span className="metric-n" aria-label={String(n)}>{v.toLocaleString()}</span>
      <span className="metric-l">{label}</span>
    </div>
  );
}
