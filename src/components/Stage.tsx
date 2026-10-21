import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Layout } from '../lib/layout';

export type NodeState = 'active' | 'lit' | 'dim' | 'idle';

interface Props {
  layout: Layout;
  nodeState?: (id: string) => NodeState;
  selected?: string | null;
  onNodeClick?: (id: string) => void;
  under?: ReactNode;
  over?: ReactNode;
  label: string;
  /** x (in diagram units) to keep in view when the stage is narrower than the diagram. */
  focusX?: number;
}

/** The glass case: columns, nodes, and whatever paths are drawn under and over them. */
export function Stage({ layout, nodeState, selected, onNodeClick, under, over, label, focusX }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (focusX === undefined || !el || el.scrollWidth <= el.clientWidth) return;
    const scale = el.scrollWidth / layout.width;
    el.scrollTo({ left: focusX * scale - el.clientWidth / 2, behavior: 'smooth' });
  }, [focusX, layout.width]);

  // Fade whichever edge has more diagram beyond it, so narrow screens hint at the rest.
  const [edge, setEdge] = useState({ l: false, r: false });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  return (
    <div className="stage">
      <div className="stage-sheen" aria-hidden="true" />
      {edge.r && !touched && <span className="stage-hint" aria-hidden="true">Swipe to see more →</span>}
      <div className={`stage-scroll${edge.l ? ' fade-l' : ''}${edge.r ? ' fade-r' : ''}`} ref={scrollRef}
        onTouchStart={() => setTouched(true)} onPointerDown={() => setTouched(true)}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={label} className="stage-svg">
          <defs>
            <marker id="tip" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1.5 1.5 8 5l-6.5 3.5" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.07)" />
            </pattern>
          </defs>
          <rect width={layout.width} height={layout.height} fill="url(#dots)" />
          {layout.columns.map((c, i) => (
            <g key={i}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="14" className="col-panel" />
              <text x={c.x + 14} y={c.y + 22} className="col-label">{String(i + 1).padStart(2, '0')} · {c.label}</text>
            </g>
          ))}
          {under}
          {Object.values(layout.nodes).map((n) => {
            const st = nodeState?.(n.id) ?? 'idle';
            const cls = `node node-${st}${selected === n.id ? ' node-selected' : ''}${onNodeClick ? ' node-click' : ''}`;
            return (
              <g key={n.id} className={cls} onClick={onNodeClick ? () => onNodeClick(n.id) : undefined}
                tabIndex={onNodeClick ? 0 : undefined} role={onNodeClick ? 'button' : undefined}
                aria-label={onNodeClick ? `${n.label}${n.sub ? ', ' + n.sub : ''}` : undefined}
                onKeyDown={onNodeClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodeClick(n.id); } } : undefined}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" className="node-box" />
                <rect x={n.x} y={n.y + 12} width="3" height={n.h - 24} rx="1.5" className="node-tick" />
                <text x={n.x + 16} y={n.y + 25} className="node-label">{n.label}</text>
                {n.sub && <text x={n.x + 16} y={n.y + 44} className="node-sub">{n.sub}</text>}
              </g>
            );
          })}
          {over}
        </svg>
      </div>
    </div>
  );
}
