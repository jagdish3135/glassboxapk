// npm run view [name] [--no-open]
// Starts the viewer (Vite dev server), prints the URLs, and opens reports/<name>.json in the browser.
// If a GlassBox viewer is already running on the usual ports, it reuses it instead of starting another.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { printReportUrls } from './reports-plugin';
import { REPORTS_DIR, reportName } from './paths';

const args = process.argv.slice(2);
const raw = args.find((a) => !a.startsWith('--'));
const name = raw ? reportName(raw) : undefined;
const noOpen = args.includes('--no-open') || !!process.env.GLASSBOX_NO_OPEN || !!process.env.CI;
if (name && !existsSync(join(REPORTS_DIR, `${name}.json`))) console.warn(`! reports/${name}.json doesn't exist yet; the viewer will say so.`);

function openBrowser(url: string) {
  if (noOpen) return;
  const win = process.platform === 'win32';
  const [cmd, argv] = win ? ['cmd', ['/c', 'start', '""', `"${url}"`]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, argv, { stdio: 'ignore', detached: true, windowsVerbatimArguments: win }).on('error', () => {}).unref();
}

async function running(): Promise<string | null> {
  for (const port of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${port}/__reports/`, { signal: AbortSignal.timeout(800) });
      if (res.ok && Array.isArray(await res.json())) return `http://localhost:${port}/`;
    } catch { /* nothing GlassBox on this port */ }
  }
  return null;
}

const target = (base: string) => `${base}app.html${name ? `#/report/${name}` : ''}`;
const existing = await running();
if (existing) {
  printReportUrls({ resolvedUrls: { local: [existing] } });
  console.log(`  The viewer is already running. ${noOpen ? 'Open' : 'Opening'}: ${target(existing)}\n`);
  openBrowser(target(existing));
  process.exit(0);
}

process.env.GLASSBOX_QUIET = '1'; // the URLs are printed below instead
const server = await createServer();
await server.listen();
server.printUrls();
printReportUrls(server);
const base = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/';
console.log(`  ${noOpen ? 'Open' : 'Opening'}: ${target(base)}\n  Press Ctrl+C to stop.\n`);
openBrowser(target(base));
