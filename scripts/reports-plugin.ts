// Vite plugin: serves reports/*.json to the viewer on the local dev/preview server only.
//   GET /__reports/            → list of reports (name, app, counts, validity)
//   GET /__reports/<name>.json → one report
// Reports are never bundled into dist/, so a deployed build can't leak them.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';
import { validateReport } from '../src/lib/validate';
import type { ReportListItem } from '../src/lib/reports';
import { REPORT_NAME, REPORTS_DIR } from './paths';

function list(dir: string): ReportListItem[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && REPORT_NAME.test(f.slice(0, -5)))
    .map((f) => {
      const name = f.slice(0, -5);
      const updated = statSync(join(dir, f)).mtimeMs;
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        const v = validateReport(data);
        const flows = Array.isArray(data?.flows) ? data.flows : [];
        return {
          name, updated, ok: v.ok, errors: v.errors.length,
          appName: String(data?.app?.name ?? name), packageName: String(data?.app?.packageName ?? ''), versionName: String(data?.app?.versionName ?? ''),
          flows: flows.length, steps: flows.reduce((n: number, fl: { steps?: unknown[] }) => n + (Array.isArray(fl?.steps) ? fl.steps.length : 0), 0),
        };
      } catch {
        return { name, updated, ok: false, errors: 1, appName: name, packageName: '', versionName: '', flows: 0, steps: 0 };
      }
    })
    .sort((a, b) => b.updated - a.updated);
}

function middleware(dir: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (!path.startsWith('/__reports')) return next();
    const send = (status: number, body: string) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    };
    if (path === '/__reports' || path === '/__reports/') return send(200, JSON.stringify(list(dir)));
    const m = /^\/__reports\/([^/]+)\.json$/.exec(path);
    if (!m || !REPORT_NAME.test(m[1])) return send(404, '{"error":"not found"}');
    const file = join(dir, `${m[1]}.json`);
    if (!existsSync(file)) return send(404, '{"error":"not found"}');
    send(200, readFileSync(file, 'utf8'));
  };
}

/** The viewer URLs, printed when the server starts so agents and people can open them. */
export function printReportUrls(server: { resolvedUrls: { local: string[] } | null }, dir = resolve(REPORTS_DIR)) {
  const base = server.resolvedUrls?.local[0];
  if (!base) return;
  const items = list(dir);
  console.log(`\n  GlassBox viewer  ${base}app.html`);
  if (!items.length) console.log('  No reports yet. Ask your agent: "Analyze apks/<file>.apk"');
  for (const r of items) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(22)} ${base}app.html#/report/${r.name}`);
  console.log('');
}

export function reportsPlugin(): Plugin {
  return {
    name: 'glassbox-reports',
    configureServer(server: ViteDevServer) {
      const dir = resolve(server.config.root, REPORTS_DIR);
      server.middlewares.use(middleware(dir));
      // Tell open viewers to reload the list (and the open report) when an agent writes a report.
      const notify = (file: string) => {
        if (resolve(file).startsWith(dir) && file.endsWith('.json')) server.ws.send({ type: 'custom', event: 'glassbox:reports' });
      };
      server.watcher.add(dir);
      server.watcher.on('add', notify).on('change', notify).on('unlink', notify);
      if (!process.env.GLASSBOX_QUIET) server.httpServer?.once('listening', () => setTimeout(() => printReportUrls(server, dir), 50));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(resolve(server.config.root, REPORTS_DIR)));
    },
  };
}
