import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { HeroDemo } from './HeroDemo';
import { AgentSetup } from './AgentSetup';
import { ExportShowcase } from './ExportShowcase';
import { Command } from './Command';
import { Loader } from './Loader';
import { REPO_URL, DEMO_URL } from './config';
import { loadBus, prefersReducedMotion, webglAvailable } from './story';
import { useLandingMotion, wipeTo } from './motion';
import { FlowPlayer } from '../components/FlowPlayer';
import { Cursor } from '../components/Cursor';
import { Icon } from '../components/Icon';
import { SAMPLE_REPORT } from '../data/sample';
import { useScrollReveal } from '../lib/useScrollReveal';
import { KIND_COLOR } from '../lib/layout';

// three.js, R3F and the scene load lazily, after the headline has painted.
const Scene = lazy(() => import('./three/Scene'));
const Showcase = lazy(() => import('./three/Showcase'));

const POSTER = `${import.meta.env.BASE_URL}landing/poster.webp`;
const CREDITS_URL = `${REPO_URL}/blob/main/CREDITS.md`;
const DEMO_FLOWS = ['login', 'order', 'refresh', 'offline'].map((id) => SAMPLE_REPORT.flows.find((f) => f.id === id)!).filter(Boolean);

const FAQ: [string, string][] = [
  ['Which AI agents does it work with?', 'Claude Code, Codex and Cursor, plus any coding agent that follows the AGENTS.md convention. The repo includes the instruction files each of them reads, so you only have to ask.'],
  ['Does my APK get uploaded anywhere?', 'GlassBoxAPK has no server. The APK stays in your local copy of the repo and the viewer runs on localhost. Your AI agent sends the code it reads to its own model provider, under that provider’s terms, the same as any other coding task.'],
  ['Which apps work best?', 'Native Kotlin and Java apps give the most detailed flows. Flutter and React Native apps work with less detail, because their logic ships as compiled Dart or JavaScript bytecode.'],
  ['What do I need installed?', 'Git, Node.js 18 or newer, a Java runtime for the decompiler, and the AI agent you already use.'],
  ['What is it for?', 'Studying how Android apps are built: their architecture, the flows behind each screen and the services they talk to. GlassBox shows analysis and code references, never decompiled source, and it doesn’t help clone apps.'],
];

const CHAPTERS = [
  { k: '01 · Decompile', title: 'The box cracks open.', body: 'Your agent decompiles the APK and splits it into layers: the manifest, the activities, the screens and the network code.' },
  { k: '02 · Trace', title: 'Layers become flow nodes.', body: 'Every entry point starts a flow. The layers spread out into the boxes a request passes through, from a tap on the screen to the server and back.' },
  { k: '03 · Animate', title: 'Every flow lights up, step by step.', body: 'Requests go out, responses come back, data lands on the device. Each step names the class or API call behind it.' },
  { k: '04 · Export', title: 'Then it becomes a deck.', body: 'One click turns the report into a PowerPoint deck or a PDF: a title slide, the system map, then a slide for every step.' },
];

const SECTIONS = 7;

/** The cell row that opens every section, like the title strip on a drawing sheet. */
function SecBar({ n, label, note }: { n: number; label: string; note: string }) {
  const nn = String(n).padStart(2, '0');
  return (
    <div className="secbar" aria-hidden="true">
      <span className="sb-n">§ {nn}</span>
      <span className="sb-label">{label}</span>
      <span className="sb-note">{note}</span>
      <span className="sb-count">{nn} / {String(SECTIONS).padStart(2, '0')}</span>
    </div>
  );
}

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Links into the viewer get a short wipe instead of a hard cut. */
function onWipe(e: MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  wipeTo(e.currentTarget.href);
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const storyEl = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);
  useScrollReveal(root);

  const [reduced] = useState(prefersReducedMotion);
  const [three] = useState(() => !reduced && webglAvailable());
  const mobile = useMedia('(max-width: 720px)');
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(true);
  const [eventSource, setEventSource] = useState<HTMLElement | null>(null);
  const [flowId, setFlowId] = useState(DEMO_FLOWS[0].id);
  const flow = DEMO_FLOWS.find((f) => f.id === flowId) ?? DEMO_FLOWS[0];

  useEffect(() => { setEventSource(document.getElementById('root')); }, []);

  // The final panel's 3D canvas is only created once the panel is about a screen away.
  const finalArt = useRef<HTMLDivElement>(null);
  const [finalNear, setFinalNear] = useState(false);
  useEffect(() => {
    const el = finalArt.current;
    if (!el || finalNear) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setFinalNear(true); io.disconnect(); } }, { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [finalNear]);

  // Render the 3D only while the story is on screen and the tab is visible.
  useEffect(() => {
    const el = storyEl.current;
    if (!el) return;
    let onScreen = true;
    const sync = () => setActive(onScreen && document.visibilityState === 'visible');
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { rootMargin: '0px 0px 0px 0px' });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, []);

  const onLoaded = useCallback(() => {
    setLoaded(true);
    document.documentElement.classList.add('is-loaded');
  }, []);

  useLandingMotion({ root, storyEl, header }, !reduced, loaded);

  return (
    <div ref={root} className={`landing${three ? ' has-3d' : ' has-poster'}`}>
      <div className="grain" aria-hidden="true" />
      <Cursor mode="full" />
      <Loader onDone={onLoaded} />

      <div className={`l-canvas${active ? '' : ' is-off'}`} aria-hidden="true">
        {three && eventSource ? (
          <Suspense fallback={null}>
            <Scene active={active} mobile={mobile} eventSource={eventSource} />
          </Suspense>
        ) : (
          <img className="l-poster" src={POSTER} alt="" onLoad={() => loadBus.emit(100)} onError={() => loadBus.emit(100)} />
        )}
        <div className="l-scrim" />
      </div>

      <header ref={header} className="topbar on-dark">
        <div className="bar-in">
          <a href="#top" className="brand" aria-label="GlassBoxAPK">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="var(--ink)" /><path d="M16 3 28 9.5 16 16 4 9.5z" fill="#2a2f31" /><path d="M16 16v13M16 16 28 9.5M16 16 4 9.5" stroke="#8fa3a6" strokeWidth="1" fill="none" /><circle cx="16" cy="16" r="3.2" fill="var(--signal)" /></svg>
            <span>GlassBox<span className="brand-apk">APK</span></span>
          </a>
          <nav className="bar-nav" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#demo">Demo</a>
            <a href="#export">Export</a>
            <a href="#faq">FAQ</a>
            <a href={REPO_URL} className="bar-cta" target="_blank" rel="noreferrer">GitHub <Icon name="arrow" size={14} /></a>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ---------- The 3D story: the glass box opens ---------- */}
        <section ref={storyEl} className="story" aria-label="How GlassBoxAPK works, as a scroll story">
          <div className="chap chap-hero">
            <div className="chap-card hero-card">
              <p className="kicker" data-rise>Early preview · for Claude Code, Codex and Cursor</p>
              <h1 className="hero-title l-title" data-split="hero">
                Hand your AI an APK. Watch how it <em>works</em>.
              </h1>
              <p className="l-lede" data-rise>
                GlassBoxAPK is a repo you add to your AI coding agent. Give it an Android APK and it traces every flow, then opens an animated system design in your browser. Export it to PPT or PDF.
              </p>
              <div className="l-cta" data-rise>
                <Command lines={[`git clone ${REPO_URL}`]} dark />
                <div className="l-cta-row">
                  <a className="btn btn-signal" href={DEMO_URL} onClick={onWipe} data-magnetic>Open the live demo <Icon name="arrow" size={16} /></a>
                  <a className="btn btn-ghost-light" href="#how" data-magnetic>Set it up</a>
                </div>
              </div>
            </div>
            <p className="scroll-cue" aria-hidden="true"><span />Scroll to open the box</p>
          </div>

          {CHAPTERS.map((c, i) => (
            <div key={c.k} className={`chap chap-${i + 1}`}>
              <div className="chap-card">
                <p className="chap-k">{c.k}</p>
                <h2 className="chap-title" data-split>{c.title}</h2>
                <p className="chap-body" data-rise>{c.body}</p>
              </div>
            </div>
          ))}

          <div className="chap chap-cta">
            <div className="chap-card">
              <p className="chap-k">05 · Your turn</p>
              <h2 className="chap-title" data-split>Open the box yourself.</h2>
              <p className="chap-body" data-rise>Play every flow of a sample app in the live demo, then point your agent at a real APK.</p>
              <div className="l-cta-row" data-rise>
                <a className="btn btn-signal" href={DEMO_URL} onClick={onWipe} data-magnetic data-cta="open-demo">Open the live demo <Icon name="arrow" size={16} /></a>
                <a className="btn btn-ghost-light" href="#how" data-magnetic>Set it up</a>
              </div>
            </div>
          </div>
        </section>

        <div className="sheet">
          {/* ---------- In practice ---------- */}
          <section className="l-practice">
            <SecBar n={1} label="In practice" note="Agent session → browser viewer" />
            <div className="l-body practice-grid">
              <div className="l-head-col">
                <h2 className="section-title" data-split>Your agent works in the terminal. You watch in the browser.</h2>
                <p className="section-lede">Ask it to analyse an APK. When the report is written, the viewer opens on localhost with every flow ready to play.</p>
              </div>
              <figure className="fig" data-cursor="watch">
                <figcaption className="fig-cap"><span>Fig. 01</span><span>Agent session → browser viewer</span></figcaption>
                <div className="fig-dim" aria-hidden="true"><i /><span>localhost · no server</span><i /></div>
                <HeroDemo />
                <span className="crop tl" aria-hidden="true" /><span className="crop tr" aria-hidden="true" />
                <span className="crop bl" aria-hidden="true" /><span className="crop br" aria-hidden="true" />
              </figure>
            </div>
          </section>

          <section className="agents-strip sr" aria-label="Works with">
            <span className="as-label">Works with</span>
            <ul>
              <li>Claude Code</li><li>Codex</li><li>Cursor</li><li>Any agent that reads AGENTS.md</li>
            </ul>
            <span className="as-rev">Rev. 0.2 · early preview</span>
          </section>

          {/* ---------- How it works ---------- */}
          <section id="how">
            <SecBar n={2} label="How it works" note="Clone · open · analyse · watch" />
            <div className="l-body">
              <div className="l-head sr">
                <h2 className="section-title">Four steps, no server.</h2>
                <p className="section-lede">Your agent does the reading. GlassBox gives it the method and shows you the result.</p>
              </div>
              <div className="sr"><AgentSetup /></div>
            </div>
          </section>

          {/* ---------- Live demo ---------- */}
          <section id="demo" className="l-demo">
            <SecBar n={3} label="Live demo" note="This is what opens in your browser" />
            <div className="l-body">
              <div className="l-head sr">
                <h2 className="section-title">Every flow, step by step.</h2>
                <p className="section-lede">
                  A sample report for <b>FoodDash</b>, a made-up food delivery app. Orange is a request, green is a response, violet is something stored on the device, and red is an error.
                </p>
              </div>
              <div className="demo-flows sr" role="tablist" aria-label="Sample flows">
                {DEMO_FLOWS.map((f, i) => (
                  <button key={f.id} role="tab" aria-selected={f.id === flow.id} className={`dflow${f.id === flow.id ? ' on' : ''}`} onClick={() => setFlowId(f.id)}>
                    <span className="dflow-n">F.{String(i + 1).padStart(2, '0')}</span>
                    <span>{f.name}</span>
                    <span className="dflow-strip" aria-hidden="true">{f.steps.map((s, j) => <i key={j} style={{ background: KIND_COLOR[s.kind] }} />)}</span>
                  </button>
                ))}
              </div>
              <div className="sr">
                <FlowPlayer arch={SAMPLE_REPORT.architecture} flow={flow} compact startOnView />
              </div>
              <a className="btn btn-ghost l-demo-cta sr" href={DEMO_URL} onClick={onWipe} data-magnetic>Open the full sample report <Icon name="arrow" size={16} /></a>
            </div>
          </section>

          {/* ---------- Features ---------- */}
          <section>
            <SecBar n={4} label="What you get" note="One report per APK" />
            <div className="l-body">
              <div className="l-head sr">
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
            </div>
          </section>

          {/* ---------- Export ---------- */}
          <section id="export">
            <SecBar n={5} label="Export" note="Take it to the meeting" />
            <div className="l-body">
              <div className="l-head sr">
                <h2 className="section-title">Export to PPT or PDF.</h2>
                <p className="section-lede">Two buttons in the viewer turn the whole report into something you can present or send.</p>
              </div>
              <div className="sr"><ExportShowcase /></div>
            </div>
          </section>

          {/* ---------- FAQ ---------- */}
          <section id="faq" className="l-faq">
            <SecBar n={6} label="Questions" note="Good to know" />
            <div className="l-body">
              <div className="l-head sr">
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
            </div>
          </section>

          {/* ---------- Final CTA ---------- */}
          <section className="l-final-wrap">
            <SecBar n={7} label="Get started" note="One command" />
            <div className="l-final sr">
              <div className="l-final-copy">
                <h2 className="section-title">Give your AI an APK.</h2>
                <p className="section-lede">Clone the repo, open it in your agent, and watch the first flow in a few minutes.</p>
                <Command lines={[`git clone ${REPO_URL}`]} dark />
                <div className="l-cta-row">
                  <a className="btn btn-signal" href={REPO_URL} target="_blank" rel="noreferrer" data-magnetic>View on GitHub</a>
                  <a className="btn btn-ghost-light" href={DEMO_URL} onClick={onWipe} data-magnetic>Open the live demo</a>
                </div>
              </div>
              <div className="l-final-art" ref={finalArt}>
                {three && !mobile && finalNear ? (
                  <Suspense fallback={<img src={POSTER} alt="" loading="lazy" />}>
                    <Showcase />
                  </Suspense>
                ) : (
                  <img src={POSTER} alt="" loading="lazy" />
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="foot sheet-foot">
        <span className="brand-mini">GlassBox<span>APK</span></span>
        <span className="muted small">Built for studying how apps are designed. GlassBox shows analysis, never decompiled source.</span>
        <a className="foot-credits small" href={CREDITS_URL} target="_blank" rel="noreferrer">Credits</a>
      </footer>

      <div className="wipe" aria-hidden="true" />
    </div>
  );
}
