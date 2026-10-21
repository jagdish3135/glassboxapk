import { useEffect, useState } from 'react';
import { FlowPlayer } from '../components/FlowPlayer';
import { SAMPLE_REPORT } from '../data/sample';
import { Icon } from '../components/Icon';

type Line =
  | { kind: 'shell' | 'ask'; text: string }
  | { kind: 'info' | 'step' | 'done' | 'open'; text: string; meta?: string };

// An example session with the fictional sample app. Typed lines animate; output lines appear.
const SCRIPT: Line[] = [
  { kind: 'shell', text: 'cd glassboxapk && claude' },
  { kind: 'info', text: 'Agent ready · instructions loaded from CLAUDE.md' },
  { kind: 'ask', text: 'Analyze apks/fooddash.apk' },
  { kind: 'step', text: 'Decompiling the APK', meta: '4,212 classes' },
  { kind: 'step', text: 'Reading AndroidManifest.xml', meta: '5 entry points' },
  { kind: 'step', text: 'Tracing flows from each entry point', meta: '8 flows' },
  { kind: 'step', text: 'Linking every step to its code', meta: '96 refs' },
  { kind: 'done', text: 'Wrote reports/fooddash.json' },
  { kind: 'open', text: 'Opened localhost:5173/#/report/fooddash' },
];

const demoFlow = SAMPLE_REPORT.flows.find((f) => f.id === 'order') ?? SAMPLE_REPORT.flows[0];

export function HeroDemo() {
  const [shown, setShown] = useState(0);   // lines fully shown
  const [typed, setTyped] = useState(0);   // chars typed of the current typed line
  const [run, setRun] = useState(0);
  const opened = shown >= SCRIPT.length;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(SCRIPT.length); return; }
    if (shown >= SCRIPT.length) return;
    const line = SCRIPT[shown];
    const typing = line.kind === 'shell' || line.kind === 'ask';
    let t: number;
    if (typing && typed < line.text.length) {
      t = window.setTimeout(() => setTyped((n) => n + 1), shown === 0 && typed === 0 ? 700 : 34 + Math.random() * 40);
    } else {
      const pause = typing ? 420 : line.kind === 'step' ? 620 : 380;
      t = window.setTimeout(() => { setShown((s) => s + 1); setTyped(0); }, pause);
    }
    return () => clearTimeout(t);
  }, [shown, typed, run]);

  const replay = () => { setShown(0); setTyped(0); setRun((r) => r + 1); };

  return (
    <div className="hdemo" aria-label="Example: an AI agent analyses an APK, then the flows open in the browser">
      <div className="term">
        <div className="term-bar">
          <i /><i /><i />
          <span>Example session · Claude Code</span>
          <button className="term-replay" onClick={replay} aria-label="Replay the example"><Icon name="restart" size={13} /></button>
        </div>
        <div className="term-body" aria-live="off">
          {SCRIPT.slice(0, Math.min(shown + 1, SCRIPT.length)).map((l, i) => {
            const current = i === shown && !opened;
            const typing = l.kind === 'shell' || l.kind === 'ask';
            if (current && !typing) return null;
            const text = current ? l.text.slice(0, typed) : l.text;
            return (
              <p key={`${run}-${i}`} className={`tm tm-${l.kind}`}>
                {l.kind === 'shell' && <span className="t-ps">$</span>}
                {l.kind === 'ask' && <span className="t-ps">›</span>}
                {l.kind === 'step' && <span className="t-mark">●</span>}
                {(l.kind === 'done' || l.kind === 'open') && <span className="t-ok">✓</span>}
                <span>{text}</span>
                {current && <span className="t-caret" />}
                {'meta' in l && l.meta && <span className="t-meta">{l.meta}</span>}
              </p>
            );
          })}
        </div>
      </div>

      <div className={`bwin${opened ? ' bwin-open' : ''}`}>
        <div className="bwin-bar">
          <i /><i /><i />
          <span className="bwin-url"><Icon name="lock" size={11} />localhost:5173/#/report/fooddash</span>
        </div>
        <div className="bwin-body">
          {opened ? (
            <>
              <div className="bwin-head">
                <span className="bwin-app">FoodDash</span>
                <span className="bwin-flow">{demoFlow.name}<em>{demoFlow.steps.length} steps</em></span>
              </div>
              <FlowPlayer arch={SAMPLE_REPORT.architecture} flow={demoFlow} bare loop />
            </>
          ) : (
            <div className="bwin-wait"><span /><span /><span />Waiting for the report…</div>
          )}
        </div>
      </div>
    </div>
  );
}
