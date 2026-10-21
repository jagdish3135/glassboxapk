import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Architecture, Flow } from '../types';
import { computeLayout, route, roundedPath, KIND_COLOR, KIND_LABEL } from '../lib/layout';
import { Stage, type NodeState } from './Stage';
import { Icon } from './Icon';

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const SPEEDS = [0.5, 1, 2];

interface Props {
  arch: Architecture;
  flow: Flow;
  compact?: boolean;
  autoPlay?: boolean;
  /** Hold at step one until the player scrolls into view, then play. */
  startOnView?: boolean;
  /** Start over after the last step instead of stopping. */
  loop?: boolean;
  /** Stage only: no controls, caption or timeline (for decorative embeds). */
  bare?: boolean;
}

const TAIL = [0.035, 0.07, 0.105];

export function FlowPlayer({ arch, flow, compact = false, autoPlay = true, startOnView = false, loop = false, bare = false }: Props) {
  const layout = useMemo(() => computeLayout(arch), [arch]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(0);
  const [arrived, setArrived] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const tailRef = useRef<SVGGElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const instantRef = useRef(false);
  const doneRef = useRef(false);
  playingRef.current = playing;
  speedRef.current = speed;

  const last = flow.steps.length - 1;
  const step = flow.steps[Math.min(idx, last)];

  useEffect(() => {
    setIdx(0);
    setPlaying(autoPlay && !startOnView);
    setRun((r) => r + 1);
  }, [flow.id, autoPlay, startOnView]);

  useEffect(() => {
    const el = rootRef.current;
    if (!startOnView || !el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setIdx(0);
      setPlaying(true);
      setRun((r) => r + 1);
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, [startOnView, flow.id]);

  // Draw the active line behind the packet, then advance if playing.
  useEffect(() => {
    const path = pathRef.current, dot = dotRef.current, tail = tailRef.current;
    if (!path || !dot) return;
    setArrived(false);
    doneRef.current = false;
    const L = path.getTotalLength();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const instant = instantRef.current || reduce;
    instantRef.current = false;
    const dur = instant ? 0 : Math.max(700, L * 2.4) / speedRef.current;
    const draw = flow.steps[idx]?.kind !== 'error'; // error lines keep their dash pattern
    path.style.strokeDasharray = draw ? `${L} ${L}` : '';
    let raf = 0, timer = 0;
    const tails = tail ? Array.from(tail.children) as SVGCircleElement[] : [];
    const place = (u: number) => {
      const p = path.getPointAtLength(L * u);
      dot.setAttribute('transform', `translate(${p.x} ${p.y})`);
      if (draw) path.style.strokeDashoffset = String(L * (1 - u));
      tails.forEach((c, i) => {
        const q = path.getPointAtLength(L * Math.max(0, u - TAIL[i]));
        c.setAttribute('cx', String(q.x));
        c.setAttribute('cy', String(q.y));
      });
    };
    const finish = () => {
      const e = path.getPointAtLength(L);
      tails.forEach((c) => { c.setAttribute('cx', String(e.x)); c.setAttribute('cy', String(e.y)); });
      doneRef.current = true;
      setArrived(true);
      if (!playingRef.current) return;
      if (idx < last) timer = window.setTimeout(() => setIdx((i) => Math.min(i + 1, last)), 520 / speedRef.current);
      else if (loop) timer = window.setTimeout(() => { setIdx(0); setRun((r) => r + 1); }, 1800);
      else setPlaying(false);
    };
    if (!dur) { place(1); finish(); }
    else {
      const t0 = performance.now();
      const frame = (t: number) => {
        const u = Math.min(1, (t - t0) / dur);
        place(ease(u));
        if (u < 1) raf = requestAnimationFrame(frame); else finish();
      };
      place(0);
      raf = requestAnimationFrame(frame);
    }
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [idx, run, flow, layout, last, loop]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    const list = listRef.current;
    if (el && list) list.scrollTo({ top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [idx]);

  const involved = useMemo(() => new Set(flow.steps.flatMap((s) => [s.from, s.to])), [flow]);
  const visited = useMemo(() => new Set(flow.steps.slice(0, idx + 1).flatMap((s) => [s.from, s.to])), [flow, idx]);
  const nodeState = (id: string): NodeState =>
    id === step.from || id === step.to ? 'active' : visited.has(id) ? 'lit' : involved.has(id) ? 'idle' : 'dim';

  const pts = route(layout, step.from, step.to, step.kind);
  const end = pts[pts.length - 1];
  const color = KIND_COLOR[step.kind];

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    if (!doneRef.current) return;
    if (idx < last) setIdx(idx + 1);
    else { setIdx(0); setRun((r) => r + 1); }
  };
  const go = (i: number, instant = false) => {
    setPlaying(false);
    instantRef.current = instant;
    if (i === idx) setRun((r) => r + 1); else setIdx(Math.max(0, Math.min(last, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1, true); }
  };
  const nodeLabel = (id: string) => layout.nodes[id]?.label ?? id;

  return (
    <div ref={rootRef} className={`player${compact ? ' player-compact' : ''}${bare ? ' player-bare' : ''}`}
      tabIndex={bare ? undefined : 0} onKeyDown={bare ? undefined : onKey}
      aria-label={`Flow player: ${flow.name}. Space to play or pause, arrow keys to step.`}>
      <Stage
        layout={layout}
        nodeState={nodeState}
        focusX={((layout.nodes[step.from]?.cx ?? 0) + (layout.nodes[step.to]?.cx ?? 0)) / 2}
        label={`System diagram for the ${flow.name} flow`}
        under={
          <g>
            {flow.steps.slice(0, idx).map((s, i) => (
              <path key={i} d={roundedPath(route(layout, s.from, s.to, s.kind))} className="trail"
                stroke={KIND_COLOR[s.kind]} strokeDasharray={s.kind === 'error' ? '5 5' : undefined} />
            ))}
          </g>
        }
        over={
          <g>
            <path ref={pathRef} d={roundedPath(pts)} className="active-path" stroke={color}
              strokeDasharray={step.kind === 'error' ? '7 6' : undefined} markerEnd={arrived ? 'url(#tip)' : undefined} />
            {arrived && end && (
              <circle key={`${flow.id}-${idx}-${run}`} cx={end[0]} cy={end[1]} r="6" className="ripple" stroke={color} />
            )}
            <g ref={tailRef} className="tail" aria-hidden="true">
              {TAIL.map((_, i) => <circle key={i} r={4 - i} fill={color} opacity={0.5 - i * 0.14} cx="-40" cy="-40" />)}
            </g>
            <g ref={dotRef} className="packet" transform="translate(-40 -40)">
              <circle r="9" fill={color} opacity="0.35" filter="url(#glow)" />
              <circle r="5.5" fill={color} />
              <circle r="2" fill="#fff" />
            </g>
          </g>
        }
      />

      {!bare && (<>
      <div className="player-bar">
        <div className="controls">
          <button className="ctl" onClick={() => go(idx - 1, true)} aria-label="Previous step" disabled={idx === 0}><Icon name="prev" size={16} /></button>
          <button className="ctl ctl-main" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <button className="ctl" onClick={() => go(idx + 1)} aria-label="Next step" disabled={idx === last}><Icon name="next" size={16} /></button>
          <button className="ctl" onClick={() => { setPlaying(true); instantRef.current = false; setIdx(0); setRun((r) => r + 1); }} aria-label="Restart flow"><Icon name="restart" size={16} /></button>
        </div>
        <div className="scrub" role="group" aria-label="Steps">
          {flow.steps.map((s, i) => (
            <button key={i} className={`seg${i < idx ? ' seg-done' : ''}${i === idx ? ' seg-now' : ''}`}
              style={{ ['--c' as string]: KIND_COLOR[s.kind] }} onClick={() => go(i)} aria-label={`Step ${i + 1}: ${s.text}`} title={`${i + 1}. ${s.text}`} />
          ))}
        </div>
        <p className="kbd-hint" aria-hidden="true"><kbd>Space</kbd> play · <kbd>←</kbd><kbd>→</kbd> step</p>
        <div className="speed" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} role="radio" aria-checked={speed === s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>

      <div className="player-body">
        <div className="caption" aria-live="polite">
          <div className="caption-meta">
            <span className="step-no">{String(idx + 1).padStart(2, '0')}<span>/{String(flow.steps.length).padStart(2, '0')}</span></span>
            <span className="badge" style={{ ['--c' as string]: color }}><i />{KIND_LABEL[step.kind]}</span>
            <span className={`conf conf-${step.confidence}`} title={step.confidence === 'verified' ? 'Observed when the app ran' : 'Found in the code, not yet observed at runtime'}>
              {step.confidence === 'verified' ? <Icon name="check" size={13} /> : null}{step.confidence}
            </span>
          </div>
          <div className="caption-swap" key={`${flow.id}-${idx}`}>
            <p className="caption-text">{step.text}</p>
            <div className="caption-route">
              <span>{nodeLabel(step.from)}</span><Icon name="arrow" size={14} /><span>{nodeLabel(step.to)}</span>
            </div>
          </div>
          <code className="caption-ref" key={`ref-${flow.id}-${idx}`}><Icon name="code" size={14} />{step.ref}</code>
        </div>

        {!compact && (
          <ol className="timeline" ref={listRef}>
            {flow.steps.map((s, i) => (
              <li key={i} data-i={i}>
                <button className={`tl${i === idx ? ' tl-now' : ''}${i < idx ? ' tl-done' : ''}`} onClick={() => go(i)}>
                  <span className="tl-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="tl-dot" style={{ background: KIND_COLOR[s.kind] }} />
                  <span className="tl-text">{s.text}<small>{nodeLabel(s.from)} → {nodeLabel(s.to)}</small></span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      </>)}
    </div>
  );
}
