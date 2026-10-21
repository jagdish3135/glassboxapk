import { useRef, useState } from 'react';
import { HeroDemo } from './HeroDemo';
import { AgentSetup } from './AgentSetup';
import { ExportShowcase } from './ExportShowcase';
import { Command } from './Command';
import { REPO_URL, DEMO_URL } from './config';
import { FlowPlayer } from '../components/FlowPlayer';
import { GlassCube } from '../components/GlassCube';
import { Icon } from '../components/Icon';
import { SAMPLE_REPORT } from '../data/sample';
import { useScrollReveal } from '../lib/useScrollReveal';
import { KIND_COLOR } from '../lib/layout';

const DEMO_FLOWS = ['login', 'order', 'refresh', 'offline'].map((id) => SAMPLE_REPORT.flows.find((f) => f.id === id)!).filter(Boolean);

const FAQ: [string, string][] = [
  ['Which AI agents does it work with?', 'Claude Code, Codex and Cursor, plus any coding agent that follows the AGENTS.md convention. The repo includes the instruction files each of them reads, so you only have to ask.'],
  ['Does my APK get uploaded anywhere?', 'GlassBoxAPK has no server. The APK stays in your local copy of the repo and the viewer runs on localhost. Your AI agent sends the code it reads to its own model provider, under that provider’s terms, the same as any other coding task.'],
  ['Which apps work best?', 'Native Kotlin and Java apps give the most detailed flows. Flutter and React Native apps work with less detail, because their logic ships as compiled Dart or JavaScript bytecode.'],
  ['What do I need installed?', 'Git, Node.js 18 or newer, a Java runtime for the decompiler, and the AI agent you already use.'],
  ['What is it for?', 'Studying how Android apps are built: their architecture, the flows behind each screen and the services they talk to. GlassBox shows analysis and code references, never decompiled source, and it doesn’t help clone apps.'],
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useScrollReveal(root);
  const [flowId, setFlowId] = useState(DEMO_FLOWS[0].id);
  const flow = DEMO_FLOWS.find((f) => f.id === flowId) ?? DEMO_FLOWS[0];

  return (
    <div ref={root} className="landing">
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <a href="#top" className="brand" aria-label="GlassBoxAPK">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="var(--ink)" /><path d="M16 3 28 9.5 16 16 4 9.5z" fill="#2a2f31" /><path d="M16 16v13M16 16 28 9.5M16 16 4 9.5" stroke="#8fa3a6" strokeWidth="1" fill="none" /><circle cx="16" cy="16" r="3.2" fill="var(--signal)" /></svg>
          <span>GlassBox<span className="brand-apk">APK</span></span>
        </a>
        <nav className="topnav" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#demo">Demo</a>
          <a href="#export">Export</a>
          <a href="#faq">FAQ</a>
          <a href={REPO_URL} className="btn btn-ink btn-sm" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </header>

      <main id="top">
        {/* ---------- Hero ---------- */}
        <section className="l-hero">
          <div className="l-hero-copy">
            <p className="kicker reveal" style={{ ['--d' as string]: '0ms' }}>Early preview · for Claude Code, Codex and Cursor</p>
            <h1 className="hero-title l-title reveal" style={{ ['--d' as string]: '80ms' }}>
              Hand your AI an APK.<br />Watch how it <em>works</em>.
            </h1>
            <p className="l-lede reveal" style={{ ['--d' as string]: '160ms' }}>
              GlassBoxAPK is a repo you add to your AI coding agent. Give it an Android APK and it traces every flow, then opens an animated system design in your browser. Export it to PPT or PDF.
            </p>
            <div className="l-cta reveal" style={{ ['--d' as string]: '240ms' }}>
              <Command lines={[`git clone ${REPO_URL}`]} />
              <div className="l-cta-row">
                <a className="btn btn-ink" href="#how">Set it up <Icon name="arrow" size={16} /></a>
                <a className="btn btn-ghost" href={DEMO_URL}>Open the live demo</a>
              </div>
            </div>
          </div>
          <div className="l-hero-art reveal" style={{ ['--d' as string]: '200ms' }}>
            <HeroDemo />
          </div>
        </section>

        <section className="agents-strip sr" aria-label="Works with">
          <span className="eyebrow">Works with</span>
          <ul>
            <li>Claude Code</li><li>Codex</li><li>Cursor</li><li>Any agent that reads AGENTS.md</li>
          </ul>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="l-section">
          <div className="l-head sr">
            <p className="eyebrow">How it works</p>
            <h2 className="section-title">Four steps, no server.</h2>
            <p className="section-lede">Your agent does the reading. GlassBox gives it the method and shows you the result.</p>
          </div>
          <div className="sr"><AgentSetup /></div>
        </section>

        {/* ---------- Live demo ---------- */}
        <section id="demo" className="l-section l-demo">
          <div className="l-head sr">
            <p className="eyebrow">This is what opens in your browser</p>
            <h2 className="section-title">Every flow, step by step.</h2>
            <p className="section-lede">
              A sample report for <b>FoodDash</b>, a made-up food delivery app. Orange is a request, green is a response, violet is something stored on the device, and red is an error.
            </p>
          </div>
          <div className="demo-flows sr" role="tablist" aria-label="Sample flows">
            {DEMO_FLOWS.map((f) => (
              <button key={f.id} role="tab" aria-selected={f.id === flow.id} className={`dflow${f.id === flow.id ? ' on' : ''}`} onClick={() => setFlowId(f.id)}>
                <span>{f.name}</span>
                <span className="dflow-strip" aria-hidden="true">{f.steps.map((s, i) => <i key={i} style={{ background: KIND_COLOR[s.kind] }} />)}</span>
              </button>
            ))}
          </div>
          <div className="sr">
            <FlowPlayer arch={SAMPLE_REPORT.architecture} flow={flow} compact startOnView />
          </div>
          <a className="btn btn-ghost l-demo-cta sr" href={DEMO_URL}>Open the full sample report <Icon name="arrow" size={16} /></a>
        </section>

        {/* ---------- Features ---------- */}
        <section className="l-section">
          <div className="l-head sr">
            <p className="eyebrow">What you get</p>
            <h2 className="section-title">More than a list of classes.</h2>
          </div>
          <div className="bento">
            <article className="bt bt-wide bt-dark sr">
              <span className="bt-n">01</span>
              <h3>A system map you can click</h3>
              <p>Entry points, the app's layers, the backend hosts it talks to and every third party, in one diagram. Click a box to see what it connects to.</p>
              <div className="bt-map" aria-hidden="true">{Array.from({ length: 4 }, (_, c) => <span key={c}>{Array.from({ length: 3 }, (_, r) => <i key={r} className={(c + r) % 3 === 0 ? 'hot' : ''} />)}</span>)}</div>
            </article>
            <article className="bt sr">
              <span className="bt-n">02</span>
              <h3>Every flow</h3>
              <p>Happy paths, error paths, background jobs and third-party calls, each traced from an entry point to a goal.</p>
              <ul className="bt-groups"><li>Happy</li><li>Edge</li><li>Background</li><li>Third-party</li></ul>
            </article>
            <article className="bt sr">
              <span className="bt-n">03</span>
              <h3>Steps linked to code</h3>
              <p>Each step names the class, file or API call behind it, so you can check it yourself.</p>
              <code className="bt-ref"><Icon name="code" size={13} />OrderApi.confirm()</code>
            </article>
            <article className="bt sr">
              <span className="bt-n">04</span>
              <h3>Honest confidence</h3>
              <p>Steps are marked <b>verified</b> when seen at runtime, or <b>inferred</b> when only found in the code.</p>
              <span className="bt-conf"><em className="v">verified</em><em className="i">inferred</em></span>
            </article>
            <article className="bt sr">
              <span className="bt-n">05</span>
              <h3>The full inventory</h3>
              <p>Stack, SDKs, permissions ranked by risk, deep links, hosts, API paths and what takes up space.</p>
            </article>
            <article className="bt bt-full sr">
              <span className="bt-n">06</span>
              <h3>Private by default</h3>
              <p>There is no GlassBox server. The APK, the report and the viewer all stay on your machine.</p>
              <span className="bt-local"><Icon name="lock" size={14} />localhost only</span>
            </article>
          </div>
        </section>

        {/* ---------- Export ---------- */}
        <section id="export" className="l-section">
          <div className="l-head sr">
            <p className="eyebrow">Take it to the meeting</p>
            <h2 className="section-title">Export to PPT or PDF.</h2>
            <p className="section-lede">Two buttons in the viewer turn the whole report into something you can present or send.</p>
          </div>
          <div className="sr"><ExportShowcase /></div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="l-section l-faq">
          <div className="l-head sr">
            <p className="eyebrow">Questions</p>
            <h2 className="section-title">Good to know.</h2>
          </div>
          <div className="faq sr">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}<span aria-hidden="true">+</span></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="l-final sr">
          <div className="l-final-copy">
            <h2 className="section-title">Give your AI an APK.</h2>
            <p className="section-lede">Clone the repo, open it in your agent, and watch the first flow in a few minutes.</p>
            <Command lines={[`git clone ${REPO_URL}`]} dark />
            <div className="l-cta-row">
              <a className="btn btn-signal" href={REPO_URL} target="_blank" rel="noreferrer">View on GitHub</a>
              <a className="btn btn-ghost-light" href={DEMO_URL}>Open the live demo</a>
            </div>
          </div>
          <div className="l-final-art"><GlassCube /></div>
        </section>
      </main>

      <footer className="foot">
        <span className="brand-mini">GlassBox<span>APK</span></span>
        <span className="muted small">Built for studying how apps are designed. GlassBox shows analysis, never decompiled source.</span>
      </footer>
    </div>
  );
}
