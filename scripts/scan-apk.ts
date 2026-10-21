// npm run scan apks/<file>.apk [--force]
// Reads the APK's manifest, DEX strings and file layout (the same scanner the browser uses) and
// writes the inventory part of reports/<name>.json: app facts, stack, SDKs, permissions, entry
// points, size, hosts and API paths, plus a starter system map. The agent then adds the flows.
import { File } from 'node:buffer'; // global File needs Node 20; this works from Node 18.13
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { scanApk } from '../src/lib/apk/scan';
import type { Report } from '../src/types';
import { REPORTS_DIR, reportName } from './paths';

const args = process.argv.slice(2);
const apk = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
if (!apk || !/\.apk$/i.test(apk)) { console.error('Usage: npm run scan apks/<file>.apk [--force]'); process.exit(2); }
if (!existsSync(apk)) { console.error(`✗ ${apk} not found. Put the APK in the apks/ folder first.`); process.exit(1); }

const name = reportName(apk);
const out = join(REPORTS_DIR, `${name}.json`);
if (existsSync(out) && !force) {
  try {
    const prev = JSON.parse(readFileSync(out, 'utf8')) as Report;
    if (prev.flows?.length) {
      console.error(`✗ ${out} already has ${prev.flows.length} flows. Edit it, or pass --force to start over from a fresh scan.`);
      process.exit(1);
    }
  } catch { /* unreadable: overwrite */ }
}

const bytes = readFileSync(apk);
const report = await scanApk(new File([bytes], basename(apk)) as unknown as globalThis.File, () => {});
report.source = 'agent';
delete report.scanMs;

mkdirSync(REPORTS_DIR, { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`✓ Wrote ${out}`);
console.log(`  ${report.app.name} ${report.app.versionName} (${report.app.packageName}) · ${report.stack.primary}, ${report.stack.language}`);
console.log(`  ${report.sdks.length} SDKs · ${report.permissions.length} permissions · ${report.entryPoints.length} entry points · ${report.hosts.length} hosts · ${report.apiPaths.length} API paths`);
console.log(`  Starter map: ${report.architecture.nodes.length} nodes in ${report.architecture.columns.length} columns. Flows: none yet (trace them next).`);
