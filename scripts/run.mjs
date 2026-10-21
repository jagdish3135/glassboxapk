// Runs a TypeScript script from scripts/ with Node: bundles it with esbuild (dependencies stay
// external), then executes it with the remaining arguments. Usage: node scripts/run.mjs <file.ts> [args…]
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const [entry, ...args] = process.argv.slice(2);
if (!entry) { console.error('Usage: node scripts/run.mjs <script.ts> [args…]'); process.exit(2); }

const outfile = resolve('node_modules/.cache/glassbox', basename(entry).replace(/\.ts$/, '.mjs'));
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, logLevel: 'warning' });
const { status } = spawnSync(process.execPath, [outfile, ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
