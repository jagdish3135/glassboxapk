import { useMemo, useState } from 'react';
import type { Report } from '../types';
import { computeLayout, route, roundedPath } from '../lib/layout';
import { Stage } from './Stage';

interface Props {
  report: Report;
  onOpenFlow?: (flowId: string) => void;
}

export function SystemMap({ report, onOpenFlow }: Props) {
  const arch = report.architecture;
  const layout = useMemo(() => computeLayout(arch), [arch]);
  const [selected, setSelected] = useState<string | null>(null);

  const links = useMemo(() => {
    if (arch.links?.length) return arch.links;
    const seen = new Set<string>();
    const out: { from: string; to: string }[] = [];
    for (const f of report.flows) for (const s of f.steps) {
      const key = [s.from, s.to].sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push({ from: s.from, to: s.to }); }
    }
    return out;
  }, [arch, report.flows]);

  const touching = selected ? report.flows.filter((f) => f.steps.some((s) => s.from === selected || s.to === selected)) : [];
  const neighbours = selected ? new Set(links.flatMap((l) => (l.from === selected ? [l.to] : l.to === selected ? [l.from] : []))) : null;
  const node = selected ? layout.nodes[selected] : null;

  return (
    <div className="map-wrap">
      <Stage
        layout={layout}
        label={`System map of ${report.app.name}`}
        selected={selected}
        onNodeClick={(id) => setSelected((s) => (s === id ? null : id))}
        nodeState={(id) => (!selected ? 'idle' : id === selected ? 'active' : neighbours?.has(id) ? 'lit' : 'dim')}
        under={
          <g>
            {links.map((l, i) => {
              const d = roundedPath(route(layout, l.from, l.to, 'storage'));
              const hot = selected && (l.from === selected || l.to === selected);
              return (
                <g key={i}>
                  <path id={`lk-${i}`} d={d} className={`map-link${hot ? ' map-link-hot' : ''}`} />
                  <circle r="2.6" className="ambient">
                    <animateMotion dur={`${3.2 + (i % 5) * 0.7}s`} begin={`${(i * 0.37) % 3}s`} repeatCount="indefinite">
                      <mpath href={`#lk-${i}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}
          </g>
        }
      />
      <aside className="map-side">
        {!node ? (
          <div className="map-hint">
            <p className="eyebrow">How to read this</p>
            <p>Each column is one layer of the system. Lines show which parts talk to each other. The moving dots are the traffic between them.</p>
            <p>Click any box to see what it connects to{report.flows.length ? ' and which flows pass through it' : ''}.</p>
            {report.source === 'scan' && (
              <p className="muted">Built from the manifest, the compiled classes and the URL strings in this APK. Backend boxes are hosts found in the code, so some may be CDNs or third parties.</p>
            )}
          </div>
        ) : (
          <div>
            <p className="eyebrow">{arch.columns[node.col]}</p>
            <h3 className="map-title">{node.label}</h3>
            {node.sub && <p className="mono muted">{node.sub}</p>}
            <p className="map-sub">Connects to</p>
            <ul className="chips">
              {[...(neighbours ?? [])].map((id) => (
                <li key={id}><button className="chip" onClick={() => setSelected(id)}>{layout.nodes[id]?.label}</button></li>
              ))}
            </ul>
            {touching.length > 0 && (
              <>
                <p className="map-sub">Flows through here</p>
                <ul className="map-flows">
                  {touching.map((f) => (
                    <li key={f.id}><button onClick={() => onOpenFlow?.(f.id)}>{f.name}<span>{f.steps.length} steps →</span></button></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
