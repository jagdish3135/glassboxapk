import { useRef, useState } from 'react';
import { GlassCube } from '../components/GlassCube';
import { Dropzone } from '../components/Dropzone';
import { FlowPlayer } from '../components/FlowPlayer';
import { ReportList } from '../components/ReportList';
import { SAMPLE_REPORT } from '../data/sample';
import { useScrollReveal } from '../lib/useScrollReveal';
import type { Report } from '../types';

const demoFlow = SAMPLE_REPORT.flows[0];

export function Home({ onReport, onSample }: { onReport: (r: Report) => void; onSample: (path?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLElement>(null);
  useScrollReveal(root);

  return (
    <main ref={root}>
      <ReportList />
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker reveal" style={{ ['--d' as string]: '0ms' }}>System design explainer for Android apps</p>
          <h1 className="hero-title reveal" style={{ ['--d' as string]: '80ms' }}>
            See <em>through</em><br />any Android app.
          </h1>
          <p className="hero-lede reveal" style={{ ['--d' as string]: '160ms' }}>
            Drop in an APK. GlassBox opens it up, draws its system design and plays every flow step by step. Each step links back to the code it came from.
          </p>
          <div className="reveal" style={{ ['--d' as string]: '240ms' }}>
            <Dropzone onReport={onReport} onSample={() => onSample()} onBusy={setBusy} />
          </div>
        </div>
        <div className="hero-art reveal" style={{ ['--d' as string]: '120ms' }}>
          <GlassCube busy={busy} />
        </div>
      </section>

      <section className="demo">
        <div className="demo-head sr">
          <p className="eyebrow">This is the explainer</p>
          <h2 className="section-title">Watch a login, not a list of classes.</h2>
          <p className="section-lede">
            Here's the <b>{demoFlow.name}</b> flow from the sample report. Orange is a request, green is a response, violet is something written to the device, and red is an error.
          </p>
        </div>
        <div className="sr">
          <FlowPlayer arch={SAMPLE_REPORT.architecture} flow={demoFlow} compact startOnView />
        </div>
        <button className="btn btn-ghost demo-cta sr" onClick={() => onSample('flows')}>See all {SAMPLE_REPORT.flows.length} flows in the sample report</button>
      </section>

      <section className="how">
        <h2 className="section-title sr">What you get from one APK</h2>
        <ol className="how-grid">
          <li className="sr"><span className="how-n">01</span><h3>System map</h3><p>Entry points, the app's layers, its backend hosts and the third parties, all in one diagram you can click through.</p></li>
          <li className="sr"><span className="how-n">02</span><h3>Every flow</h3><p>Happy paths, error paths, background jobs and third-party calls, each defined from an entry point to a goal.</p></li>
          <li className="sr"><span className="how-n">03</span><h3>Code-linked steps</h3><p>Each step names the class, file or API call behind it, and says whether it was seen at runtime or only found in the code.</p></li>
          <li className="sr"><span className="how-n">04</span><h3>The full inventory</h3><p>Stack, SDKs, permissions, deep links, hosts, API paths and size, read straight from the package.</p></li>
        </ol>
      </section>

      <footer className="foot">
        <span className="brand-mini">GlassBox<span>APK</span></span>
        <span className="muted small">Built for studying how apps are designed. GlassBox shows analysis, never decompiled source.</span>
      </footer>
    </main>
  );
}
