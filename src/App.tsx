import { useEffect, useState } from 'react';
import type { Report } from './types';
import { SAMPLE_REPORT } from './data/sample';
import { Home } from './pages/Home';
import { ReportPage, type Tab } from './pages/ReportPage';
import { ReportProblem } from './pages/ReportProblem';
import { useAgentReport } from './lib/reports';

// Routes: #/  ·  #/sample/<tab>[/<flowId>]  ·  #/scan/<tab>[/<flowId>] (browser scan)
//         #/report/<name>[/<tab>[/<flowId>]]  (reports/<name>.json, written by an AI agent)
function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

const TABS: Tab[] = ['overview', 'map', 'flows'];
const STORE_KEY = 'glassbox:last-scan';

// The last scan survives a page refresh within the tab; it never leaves the browser.
function loadScan(): Report | null {
  try { const raw = sessionStorage.getItem(STORE_KEY); return raw ? (JSON.parse(raw) as Report) : null; } catch { return null; }
}
function saveScan(r: Report) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch { /* storage full or blocked */ }
}

export default function App() {
  const hash = useHash();
  const [scanned, setScanned] = useState<Report | null>(loadScan);
  const parts = hash.replace(/^#/, '').split('/');
  const kind = parts[1];
  const name = kind === 'report' ? decodeURIComponent(parts[2] ?? '') || null : null;
  const [rawTab, flowId] = kind === 'report' ? parts.slice(3) : parts.slice(2);
  // An agent report opens on its flows; the others open on the overview.
  const tab = (TABS.includes(rawTab as Tab) ? rawTab : kind === 'report' ? 'flows' : 'overview') as Tab;
  const loaded = useAgentReport(name);
  const report = kind === 'sample' ? SAMPLE_REPORT : kind === 'scan' ? scanned : loaded.state === 'ok' ? loaded.report : null;

  useEffect(() => {
    if (kind === 'scan' && !scanned) window.location.hash = '#/';
  }, [kind, scanned]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [kind, name, tab]);

  const base = kind === 'report' && name ? `report/${encodeURIComponent(name)}` : kind;
  const go = (k: string, t: Tab = 'overview', f?: string) => { window.location.hash = `#/${k}/${t}${f ? '/' + f : ''}`; };

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <a href="#/" className="brand" aria-label="GlassBoxAPK home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="var(--ink)" /><path d="M16 3 28 9.5 16 16 4 9.5z" fill="#2a2f31" /><path d="M16 16v13M16 16 28 9.5M16 16 4 9.5" stroke="#8fa3a6" strokeWidth="1" fill="none" /><circle cx="16" cy="16" r="3.2" fill="var(--signal)" /></svg>
          <span>GlassBox<span className="brand-apk">APK</span></span>
        </a>
        <nav className="topnav">
          {kind === 'report' && report && <a href={`#/${base}/flows`} className="on">{report.app.name}</a>}
          <a href="#/sample/flows" className={kind === 'sample' ? 'on' : ''}>Sample report</a>
          {scanned && <a href="#/scan/overview" className={kind === 'scan' ? 'on' : ''}>{scanned.app.name}</a>}
          <a href="#/" className="btn btn-ink btn-sm">All reports</a>
        </nav>
      </header>

      {report ? (
        <ReportPage
          key={base}
          report={report}
          tab={tab}
          flowId={flowId ?? null}
          navigate={(t, f) => go(base, t, f)}
          onOpenSample={() => go('sample', 'flows')}
        />
      ) : kind === 'report' ? (
        <ReportProblem name={name ?? ''} loaded={loaded} />
      ) : (
        <Home onReport={(r) => { setScanned(r); saveScan(r); go('scan'); }} onSample={(t) => go('sample', (t as Tab) ?? 'overview')} />
      )}
    </>
  );
}
