<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/banner-dark.svg">
    <img src="docs/readme/banner-light.svg" alt="GlassBoxAPK: hand your AI an APK, watch how it works" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://glassboxapk.vercel.app"><img src="https://img.shields.io/badge/🌐_Website-glassboxapk.vercel.app-141414?style=for-the-badge" alt="Website"></a>
  <a href="https://glassboxapk.vercel.app/app.html#/sample/flows"><img src="https://img.shields.io/badge/▶_Live_demo-ff5a1f?style=for-the-badge" alt="Open the live demo"></a>
  <a href="docs/readme/fooddash-deck.pptx"><img src="https://img.shields.io/badge/📊_Sample_PPT-141414?style=for-the-badge" alt="Download a sample PowerPoint deck"></a>
  <a href="docs/readme/fooddash-report.pdf"><img src="https://img.shields.io/badge/📄_Sample_PDF-47443e?style=for-the-badge" alt="Open a sample PDF report"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/works_with-Claude_Code_·_Codex_·_Cursor-141414" alt="Works with Claude Code, Codex and Cursor">
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white" alt="Vite 5">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/decompiler-jadx-47443e" alt="jadx">
  <img src="https://img.shields.io/badge/tests-49_passing-2d7d4f" alt="49 tests passing">
  <img src="https://img.shields.io/badge/server-none,_runs_on_localhost-141414" alt="No server, runs on localhost">
</p>

<p align="center">
  <b><a href="#-see-it-in-action">Demo</a></b> ·
  <b><a href="#-how-it-works">How it works</a></b> ·
  <b><a href="#%EF%B8%8F-the-explainer">The explainer</a></b> ·
  <b><a href="#-export-to-ppt-and-pdf">Export</a></b> ·
  <b><a href="#-quick-start">Quick start</a></b> ·
  <b><a href="#-what-your-agent-runs">Agent workflow</a></b> ·
  <b><a href="#-faq">FAQ</a></b>
</p>

---

## 🎬 See it in action

<p align="center">
  <a href="docs/readme/demo.mp4"><img src="docs/readme/demo.webp" alt="Claude Code analyses apks/fooddash.apk, writes the report and opens the animated flow in the browser" width="72%"></a>
</p>

<p align="center"><sub>▶ <a href="docs/readme/demo.mp4"><b>Watch it as MP4</b></a> · preview not moving? <a href="docs/readme/demo.gif">Open the GIF</a> · 🌐 <a href="https://glassboxapk.vercel.app"><b>glassboxapk.vercel.app</b></a></sub></p>

You add this repo to your AI coding agent. You drop an APK into `apks/` and say **"Analyze apks/your-app.apk"**. The agent decompiles it, traces every flow from an entry point to a goal, and opens an animated system design of the app in your browser.

### 🧊 The website: the glass box opens

<table>
  <tr>
    <td width="50%"><img src="docs/readme/landing-hero.webp" alt="Landing page hero: a glass APK box with the custom cursor turned into a magnifier lens"></td>
    <td width="50%"><img src="docs/readme/landing-crack.webp" alt="Scrolling cracks the box into glass layers labelled manifest, activities, screens and network"></td>
  </tr>
  <tr>
    <td><img src="docs/readme/landing-flows.webp" alt="The layers become flow nodes, with glowing lines and packets between them"></td>
    <td><img src="docs/readme/landing-deck.webp" alt="The nodes snap into a slide deck that flips, standing for the PPT and PDF export"></td>
  </tr>
</table>

[glassboxapk.vercel.app](https://glassboxapk.vercel.app) is a scroll story built with React Three Fiber, GSAP ScrollTrigger and Lenis. The hero model is made in Blender by [scripts/blender/glass_box.py](scripts/blender/glass_box.py). Hover the box and the cursor becomes a lens that zooms the 3D. With reduced motion, or without WebGL, the page shows a still render instead. Outside assets are listed in [CREDITS.md](CREDITS.md).

---

## ⚡ How it works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme/how-it-works-dark.svg">
    <img src="docs/readme/how-it-works-light.svg" alt="1 Add the repo, 2 open your agent, 3 hand it the APK, 4 watch and export" width="100%">
  </picture>
</p>

| | What happens | Where |
|:-:|---|---|
| 🧩 | **Decompile.** jadx turns the APK into readable code for the agent | `work/<name>/` (stays local) |
| 📋 | **Inventory.** Stack, SDKs, permissions, entry points, hosts, API paths, size | `reports/<name>.json` |
| 🔍 | **Trace.** Screen → ViewModel → repository → endpoint → response, storage writes, error branches | the agent, following [AGENTS.md](AGENTS.md) |
| ✅ | **Validate.** Checked against the report types; steps must point at real boxes; no source code allowed | `npm run validate-report` |
| 🌐 | **View.** The viewer opens the report and reloads when it changes | `localhost:5173/app.html#/report/<name>` |

---

## ▶️ The explainer

<p align="center">
  <a href="docs/readme/flow.mp4"><img src="docs/readme/flow.webp" alt="The Session expired flow playing: a 401, a token refresh and an automatic retry, step by step" width="88%"></a>
</p>

Every flow plays step by step on the app's system map. The caption says what happens, and the code chip names the class, method or endpoint behind it.

| Colour | Means |
|---|---|
| 🟠 **Request** | a call or user action going out |
| 🟢 **Response** | data coming back |
| 🟣 **Storage** | something read from or written to the device |
| 🔴 **Error** | a failure path: 401s, timeouts, declined payments, offline fallbacks |

Flows are grouped into **happy paths**, **error and edge paths**, **background** jobs and **third-party** calls. Play, pause, step with <kbd>←</kbd> <kbd>→</kbd>, or change the speed.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/system-map.jpg" alt="System map: click a box to see what it connects to and which flows pass through it"></td>
    <td width="50%"><img src="docs/readme/overview.jpg" alt="Overview: SDKs by category and permissions ranked by risk"></td>
  </tr>
  <tr>
    <td align="center"><b>🗺 System map</b><br><sub>Click a box to see its connections and the flows that pass through it</sub></td>
    <td align="center"><b>📋 Full inventory</b><br><sub>Stack, SDKs with evidence, permissions ranked by risk, entry points, network, size</sub></td>
  </tr>
</table>

---

## 📤 Export to PPT and PDF

<p align="center"><img src="docs/readme/report-header.jpg" alt="Export PPT and Export PDF buttons in the report header" width="80%"></p>

Two buttons in every report header. Both run in your browser.

<table>
  <tr>
    <td width="33%"><img src="docs/readme/slide-1.jpg" alt="Title slide"></td>
    <td width="33%"><img src="docs/readme/slide-2.jpg" alt="System map slide drawn with shapes"></td>
    <td width="33%"><img src="docs/readme/slide-6.jpg" alt="One slide per flow step"></td>
  </tr>
  <tr>
    <td align="center"><sub>Title + flow list</sub></td>
    <td align="center"><sub>System map, drawn as shapes</sub></td>
    <td align="center"><sub>One slide per step: route, caption, code ref</sub></td>
  </tr>
</table>

**📊 PowerPoint** ([sample deck](docs/readme/fooddash-deck.pptx)): real text and shapes, so everything is editable. Speaker notes carry each step's details.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/pdf-page-1.jpg" alt="PDF page 1: app facts, stack and system map"></td>
    <td width="50%"><img src="docs/readme/pdf-page-6.jpg" alt="PDF page 6: numbered flow steps with code references"></td>
  </tr>
</table>

**📄 PDF** ([sample report](docs/readme/fooddash-report.pdf)): stack, SDKs, permissions, entry points, network, size, the system map, and every flow as a numbered step list with its code references.

---

## 🚀 Quick start

You need **Git**, **Node.js 18+**, **Java 11+** and **[jadx](https://github.com/skylot/jadx/releases)**. `npm run decompile` tells you how to install anything that's missing.

```bash
git clone https://github.com/jagdish3135/glassboxapk
```

```bash
cd glassboxapk && npm install
```

Open the folder in your agent (`claude`, `codex`, or Cursor's agent chat), put an APK in `apks/`, and ask:

```
Analyze apks/your-app.apk
```

<details>
<summary><b>No APK to hand? Try the sample</b></summary>

```bash
npm run sample-report
```

```bash
npm run view fooddash
```

That writes the fictional FoodDash app to `reports/fooddash.json` and opens it.
</details>

---

## 🤖 What your agent runs

| Command | What it does |
|---|---|
| `npm run decompile apks/x.apk` | Checks Java and jadx (with install help), decompiles into `work/x/` |
| `npm run scan apks/x.apk` | Writes the inventory part of `reports/x.json` |
| `npm run validate-report reports/x.json` | Validates the report. Exit code 0 = valid |
| `npm run view x` | Starts the viewer (or reuses a running one), prints the URLs, opens the report |

The full method, with search patterns for endpoints, auth, storage, push and obfuscated code, is in **[AGENTS.md](AGENTS.md)**. Claude Code reads it through [CLAUDE.md](CLAUDE.md).

<details>
<summary><b>📁 Folders</b></summary>

| Folder | What goes there | In git? |
|---|---|---|
| `apks/` | The APKs you want to study | No (only its README) |
| `work/` | jadx output, for the agent to read | No |
| `reports/` | `<name>.json` reports, read by the viewer | No |
| `tools/` | Optional local jadx (`tools/jadx/bin/jadx`) | No |

`work/` and `reports/` are whitelisted in `.ignore`, so ripgrep-based search tools can still read them.
</details>

<details>
<summary><b>🛠 Development</b></summary>

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type check and build to `dist/` |
| `npm run serve` | Serve the production build |
| `npm test` | 49 checks: the APK scanner on a synthetic APK, the validator on good and broken reports, and both exports (files go to `test/out/`) |
| `npm run test:e2e` | Playwright check of the website at 1440 px and 390 px: loader, scroll story, cursor, the call to action into the viewer, and the reduced-motion poster. Add `-- --shots` to save screenshots to `test/out/landing/` |
| `node docs/readme/capture.mjs` | Re-capture the README screenshots and videos from a running viewer |
| `node docs/readme/make-svgs.mjs` | Regenerate the README banner and diagram |

```
AGENTS.md / CLAUDE.md   the analysis workflow
scripts/                decompile, scan, validate, view, reports dev-server plugin
src/types.ts            the Report / Flow / FlowStep contract
src/lib/validate.ts     report validator, typed against types.ts
src/lib/export/         PPTX (pptxgenjs) and PDF (jsPDF) builders
src/components/         FlowPlayer, SystemMap, Overview
src/landing/            the website
```
</details>

---

## ❓ FAQ

<details>
<summary><b>Does my APK get uploaded anywhere?</b></summary>

No. GlassBoxAPK has no server. The APK, the decompiled code and the report stay in your local copy of the repo, and the viewer runs on localhost. Your AI agent sends the code it reads to its own model provider, as with any coding task.
</details>

<details>
<summary><b>Which apps work best?</b></summary>

Native Kotlin and Java apps give the most detail, even when obfuscated. Flutter and React Native apps work with less detail, because their logic ships as compiled Dart or JavaScript bytecode.
</details>

<details>
<summary><b>What does "inferred" mean on a step?</b></summary>

The step was found by reading the code, not observed while the app ran. Every step an agent traces statically is marked inferred.
</details>

<details>
<summary><b>Does the report contain the app's code?</b></summary>

No. A report holds descriptions and references (class, method, file and endpoint names). The validator rejects anything that looks like source code.
</details>

---

<p align="center"><sub>Built for studying how apps are designed. GlassBox shows analysis, never decompiled source.</sub></p>
