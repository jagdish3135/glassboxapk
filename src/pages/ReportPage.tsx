import { useLayoutEffect, useRef, useState } from 'react';
import type { Report } from '../types';
import { Overview } from '../components/Overview';
import { SystemMap } from '../components/SystemMap';
import { Flows } from '../components/Flows';
import { Icon } from '../components/Icon';

export type Tab = 'overview' | 'map' | 'flows';

interface Props {
  report: Report;
  tab: Tab;
  flowId: string | null;
  navigate: (tab: Tab, flowId?: string) => void;
  onOpenSample: () => void;
}

type Format = 'pptx' | 'pdf';

/** Both exporters are loaded on first click, so the viewer stays light. */
function ExportButtons({ report }: { report: Report }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (f: Format) => {
    setBusy(f);
    setError(null);
    try {
      if (f === 'pptx') await (await import('../lib/export/pptx')).downloadPptx(report);
      else (await import('../lib/export/pdf')).downloadPdf(report);
    } catch (e) {
      setError(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="rhead-actions">
      <button className="btn btn-ink btn-sm" onClick={() => run('pptx')} disabled={busy !== null} aria-busy={busy === 'pptx'}>
        <Icon name="download" size={15} />{busy === 'pptx' ? 'Building deck…' : 'Export PPT'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => run('pdf')} disabled={busy !== null} aria-busy={busy === 'pdf'}>
        <Icon name="download" size={15} />{busy === 'pdf' ? 'Building PDF…' : 'Export PDF'}
      </button>
      {error && <p className="drop-error" role="alert">{error}</p>}
    </div>
  );
}

const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export function ReportPage({ report, tab, flowId, navigate, onOpenSample }: Props) {
  const r = report;
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'map', label: 'System map' },
    { id: 'flows', label: 'Flows', n: r.flows.length || undefined },
  ];

  // Sliding underline under the active tab.
  const tabsRef = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const btn = tabsRef.current?.querySelector<HTMLElement>('.tab-on');
      if (btn) setInk({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab]);

  return (
    <main className="report">
      <header className="rhead reveal" style={{ ['--d' as string]: '0ms' }}>
        <div className="monogram" aria-hidden="true">{r.app.name.charAt(0)}</div>
        <div className="rhead-id">
          <p className="eyebrow">
            {r.source === 'sample' ? 'Sample report · fictional app'
              : r.source === 'agent' ? `Analysed by your AI agent · ${r.fileName}`
              : `Scanned in your browser${r.scanMs !== undefined ? ` in ${fmtMs(r.scanMs)}` : ''}`}
          </p>
          <h1 className="rhead-name">{r.app.name}</h1>
          <p className="mono rhead-pkg">{r.app.packageName}</p>
          <ExportButtons report={r} />
        </div>
        <dl className="rhead-facts">
          <div><dt>Version</dt><dd>{r.app.versionName}<small> ({r.app.versionCode})</small></dd></div>
          <div><dt>Android</dt><dd>API {r.app.minSdk}–{r.app.targetSdk}</dd></div>
          <div><dt>Size</dt><dd>{fmtBytes(r.app.sizeBytes)}</dd></div>
          <div><dt>Stack</dt><dd>{r.stack.primary}</dd></div>
        </dl>
      </header>

      <nav className="tabs" role="tablist" aria-label="Report sections" ref={tabsRef}>
        {ink && <span className="tab-ink" style={{ transform: `translateX(${ink.x}px)`, width: ink.w }} aria-hidden="true" />}
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' tab-on' : ''}`} onClick={() => navigate(t.id)}>
            {t.label}{t.n ? <span className="tab-n">{t.n}</span> : null}
          </button>
        ))}
      </nav>

      <div className="tabpanel" role="tabpanel" key={tab}>
        {tab === 'overview' && <Overview report={r} />}
        {tab === 'map' && <SystemMap report={r} onOpenFlow={(id) => navigate('flows', id)} />}
        {tab === 'flows' && <Flows report={r} flowId={flowId} onSelect={(id) => navigate('flows', id)} onOpenSample={onOpenSample} />}
      </div>
    </main>
  );
}
