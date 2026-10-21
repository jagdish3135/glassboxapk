// npm run validate-report reports/<name>.json
// Checks a report against the shapes in src/types.ts. Exit code 0 = valid, 1 = errors.
import { readFileSync } from 'node:fs';
import { validateReport } from '../src/lib/validate';

const file = process.argv[2];
if (!file) { console.error('Usage: npm run validate-report reports/<name>.json'); process.exit(2); }

let data: unknown;
try { data = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error(`✗ ${file}: ${(e as Error).message}`); process.exit(1); }

const { ok, errors, warnings } = validateReport(data);
for (const e of errors) console.log(`  error    ${e}`);
for (const w of warnings) console.log(`  warning  ${w}`);
if (ok) {
  const r = data as { flows: { steps: unknown[] }[]; architecture: { nodes: unknown[] } };
  const steps = r.flows.reduce((n, f) => n + f.steps.length, 0);
  console.log(`✓ ${file} is a valid report: ${r.architecture.nodes.length} nodes, ${r.flows.length} flows, ${steps} steps${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
} else {
  console.log(`✗ ${file}: ${errors.length} error(s). Fix them and run the validator again.`);
}
process.exit(ok ? 0 : 1);
