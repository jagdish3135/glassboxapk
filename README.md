# GlassBoxAPK

> **Hand your AI an APK. Watch how it works.**

GlassBoxAPK is a system design explainer for Android apps, built as a repo you add to your AI coding agent (Claude Code, Codex, Cursor, or any agent that reads `AGENTS.md`). Give the agent an APK and it decompiles it, traces every flow from an entry point to a goal, and writes a report. The viewer then opens in your browser: a clickable system map, and each flow played as an animation, step by step, with the class, file or API call behind every step. One click exports the whole thing to **PPT** or **PDF**.

There is no GlassBox server. The APK, the decompiled code, the report and the viewer all stay on your machine.

See [IDEA.md](IDEA.md) for the product vision and roadmap.

## Quick start

You need Git, Node.js 18+, Java 11+ and [jadx](https://github.com/skylot/jadx/releases) (the decompiler; `npm run decompile` tells you how to install it if it's missing).

```bash
git clone https://github.com/jagdish3135/glassboxapk
```

```bash
cd glassboxapk && npm install
```

Open the folder in your agent (`claude`, `codex`, or Cursor's agent chat), drop an APK into `apks/`, and ask:

```
Analyze apks/your-app.apk
```

The agent follows [AGENTS.md](AGENTS.md) (Claude Code reads it through [CLAUDE.md](CLAUDE.md)). It ends by opening `http://localhost:5173/app.html#/report/your-app`.

No APK to hand? `npm run sample-report` writes the fictional FoodDash sample to `reports/fooddash.json`, and `npm run view fooddash` opens it.

## What the agent does

| Step | Command | Result |
|---|---|---|
| 1. Decompile | `npm run decompile apks/x.apk` | Checks Java and jadx, decompiles into `work/x/` |
| 2. Inventory | `npm run scan apks/x.apk` | Writes `reports/x.json`: app facts, stack, SDKs, permissions, entry points, size, hosts, API paths, a starter map |
| 3. Trace | (the agent reads `work/x/`) | Adds the system map and the flows: screen → ViewModel → repository → Retrofit endpoint → response, storage writes, error branches |
| 4. Validate | `npm run validate-report reports/x.json` | Schema check against `src/types.ts`, plus: steps point at real boxes, no overlapping boxes, no source code |
| 5. View | `npm run view x` | Starts the viewer, prints the URLs, opens the report |

A report holds analysis and code *references* (class, method, file and endpoint names), never decompiled source. The validator rejects anything that looks like code.

## Folders

| Folder | What goes there | In git? |
|---|---|---|
| `apks/` | The APKs you want analysed | Only `.gitkeep` and its README |
| `work/` | jadx output, for the agent to read | No |
| `reports/` | `<name>.json` reports, read by the viewer | No |
| `tools/` | Optional local jadx install (`tools/jadx/bin/jadx`) | No |

`work/` and `reports/` are whitelisted in `.ignore`, so ripgrep-based search tools (like Claude Code's Grep) can still search them.

## The viewer

| URL | What it is |
|---|---|
| `/` (`index.html`) | The public **landing page** |
| `/app.html` | The **viewer** home: your reports from `reports/`, the in-browser APK scan, and the sample |
| `/app.html#/report/<name>[/<tab>[/<flowId>]]` | A report from `reports/<name>.json`. Tabs: `overview`, `map`, `flows` |
| `/app.html#/sample/flows` | The FoodDash sample (the landing page's live demo) |
| `/app.html#/scan/overview` | The last in-browser scan (inventory only, no flows) |

Links like `localhost:5173/#/report/<name>` on the landing page forward to the viewer. Reports are served by a small dev-server plugin ([scripts/reports-plugin.ts](scripts/reports-plugin.ts)) at `/__reports/`, so they're never bundled into a build. The page reloads by itself when a report changes, and a report that fails validation shows the list of problems instead of a broken page.

### Export

Every report header has two buttons. Both run in the browser and need no server.

- **Export PPT** (pptxgenjs): a title slide, the system map drawn as shapes, then one slide per flow step with the highlighted route, the caption and the code reference. All text and shapes are editable; speaker notes carry the step details.
- **Export PDF** (jsPDF): the full report: stack, SDKs, permissions, entry points, network surface, size, the system map, and every flow as a numbered step list with its code references. The built-in PDF fonts cover Latin-1, so non-Latin app text prints as `?`.

## Scripts

| Command | What it does |
|---|---|
| `npm run view [name]` | Start the viewer (Vite dev server), print the report URLs, open `name` in the browser. Reuses a running viewer. Flags go after `--`: `npm run view -- name --no-open` |
| `npm run decompile apks/x.apk` | Check Java and jadx (with install help), decompile into `work/x/` |
| `npm run scan apks/x.apk` | Write the inventory part of `reports/x.json` (won't overwrite a report that has flows without `--force`) |
| `npm run validate-report reports/x.json` | Validate a report. Exit code 0 = valid |
| `npm run sample-report` | Write the FoodDash sample to `reports/fooddash.json` |
| `npm run dev` | Start the dev server (the workspace preview uses port 5179) |
| `npm run build` | Type check and build to `dist/` |
| `npm run serve` | Serve the production build (named `serve`, because npm would run a `preview` script before every `npm run view`) |
| `npm test` | Scanner checks on a synthetic APK, validator checks on good and broken reports, and PPT/PDF export checks. Writes `test/fixture.apk` and `test/out/fooddash.{json,pptx,pdf}` |

## How it's put together

```
AGENTS.md / CLAUDE.md    The analysis workflow your agent follows
scripts/
  decompile.ts           Java + jadx check, decompile to work/<name>/
  scan-apk.ts            Inventory → reports/<name>.json (reuses the browser scanner)
  validate-report.ts     CLI for src/lib/validate.ts
  view.ts                Starts or reuses the viewer and opens a report
  reports-plugin.ts      Serves reports/ at /__reports/ and live-reloads the viewer
  run.mjs                Runs a TypeScript script with esbuild + Node
src/
  types.ts               The Report / Flow / FlowStep types (the report contract)
  lib/validate.ts        Report validator, typed against types.ts so they can't drift
  lib/reports.ts         Loads the report list and one report in the viewer
  lib/export/            PPTX (pptxgenjs) and PDF (jsPDF) builders, shared by the buttons and the tests
  lib/apk/               In-browser APK scanner: binary manifest, DEX strings, SDK signatures
  lib/layout.ts          Diagram layout + orthogonal routing (also used by the exports)
  components/FlowPlayer  The animated explainer (the USP)
  components/SystemMap   Clickable architecture map with ambient traffic
  components/Overview    Stack, SDKs, permissions, entry points, size, network
  landing/               Landing page
  data/sample.ts         Fictional FoodDash report with full flow traces
```

A flow is plain data (`Flow → FlowStep[]` in `src/types.ts`). One player renders any flow, so any tool that writes that JSON can feed the viewer.

## Next steps

1. Runtime confirmation: run flows on an emulator and mark observed steps `verified`
2. MP4 export of a flow (reuse the HTML→MP4 + Kokoro voiceover pipeline)
3. "Ask about this step" chat grounded in the decompiled code
4. Version diff between two APKs

---

Built for studying how apps are designed. GlassBox shows analysis, never decompiled source.
