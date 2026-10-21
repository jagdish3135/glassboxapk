import { useEffect, useRef } from 'react';
import type { Flow, FlowGroup, Report } from '../types';
import { FlowPlayer } from './FlowPlayer';
import { KIND_COLOR } from '../lib/layout';

const GROUPS: { id: FlowGroup; label: string }[] = [
  { id: 'happy', label: 'Happy paths' },
  { id: 'edge', label: 'Error and edge paths' },
  { id: 'background', label: 'Background' },
  { id: 'third-party', label: 'Third-party' },
];

interface Props {
  report: Report;
  flowId: string | null;
  onSelect: (id: string) => void;
  onOpenSample: () => void;
}

export function Flows({ report, flowId, onSelect, onOpenSample }: Props) {
  if (!report.flows.length) return <NoFlows report={report} onOpenSample={onOpenSample} />;
  const flow = report.flows.find((f) => f.id === flowId) ?? report.flows[0];

  return (
    <div className="flows">
      <nav className="library" aria-label="Flow library">
        <p className="lib-total"><b>{report.flows.length}</b> flows detected</p>
        {GROUPS.map((g) => {
          const list = report.flows.filter((f) => f.group === g.id);
          if (!list.length) return null;
          return (
            <div key={g.id} className="lib-group">
              <p className="lib-head">{g.label}<span>{list.length}</span></p>
              {list.map((f) => <FlowCard key={f.id} flow={f} group={g.label} on={f.id === flow.id} onClick={() => onSelect(f.id)} />)}
            </div>
          );
        })}
      </nav>
      <section className="flow-main">
        <header className="flow-head">
          <div>
            <p className="eyebrow">{GROUPS.find((g) => g.id === flow.group)?.label}</p>
            <h2 className="flow-title">{flow.name}</h2>
            <p className="flow-summary">{flow.summary}</p>
          </div>
          <dl className="flow-ends">
            <div><dt>Starts at</dt><dd className="mono">{flow.entry}</dd></div>
            <div><dt>Ends with</dt><dd>{flow.goal}</dd></div>
          </dl>
        </header>
        <FlowPlayer arch={report.architecture} flow={flow} />
      </section>
    </div>
  );
}

function FlowCard({ flow, group, on, onClick }: { flow: Flow; group: string; on: boolean; onClick: () => void }) {
  const verified = flow.steps.filter((s) => s.confidence === 'verified').length;
  const ref = useRef<HTMLButtonElement>(null);
  // Keep the selected card visible when the library is a horizontal rail (mobile).
  useEffect(() => {
    const el = ref.current, rail = el?.closest('.library');
    if (!on || !el || !rail || rail.scrollWidth <= rail.clientWidth) return;
    const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    rail.scrollBy({ left: el.getBoundingClientRect().left - rail.getBoundingClientRect().left - pad, behavior: 'smooth' });
  }, [on]);
  return (
    <button ref={ref} className={`fcard${on ? ' fcard-on' : ''}`} onClick={onClick} aria-current={on ? 'true' : undefined}>
      <span className="fcard-group">{group}</span>
      <span className="fcard-name">{flow.name}</span>
      <span className="fcard-strip" aria-hidden="true">
        {flow.steps.map((s, i) => <i key={i} style={{ background: KIND_COLOR[s.kind] }} />)}
      </span>
      <span className="fcard-meta">{flow.steps.length} steps · {verified ? `${Math.round((verified / flow.steps.length) * 100)}% verified` : 'inferred from code'}</span>
    </button>
  );
}

function NoFlows({ report, onOpenSample }: { report: Report; onOpenSample: () => void }) {
  return (
    <div className="noflows">
      <div className="card noflows-card">
        <p className="eyebrow">Flow tracing</p>
        <h2 className="flow-title">{report.source === 'agent' ? `No flows traced for ${report.app.name} yet.` : `The browser scan found where ${report.app.name}'s flows start.`}</h2>
        <p>Tracing each flow step by step (screen → ViewModel → API → response) needs the decompiled code, which your AI agent reads. Put the APK in the repo's <code>apks/</code> folder and ask your agent <code>Analyze apks/{report.fileName}</code>. Until then no steps are shown here, and nothing is made up.</p>
        <p>These are the {report.entryPoints.length} entry points found in the manifest. Each one is the start of at least one flow:</p>
        <ul className="seeds">
          {report.entryPoints.slice(0, 12).map((e, i) => (
            <li key={i}><span className={`entry-kind ek-${e.kind.replace(' ', '-')}`}>{e.kind}</span><span className="mono">{e.target.split('.').pop()}</span><span className="muted">{e.detail}</span></li>
          ))}
        </ul>
        <button className="btn btn-ink" onClick={onOpenSample}>Watch full flows in the sample report</button>
      </div>
    </div>
  );
}
