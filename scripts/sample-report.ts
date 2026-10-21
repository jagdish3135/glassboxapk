// npm run sample-report
// Writes the built-in FoodDash sample to reports/fooddash.json and validates it, so the
// report pipeline (validator → viewer → PPT/PDF export) can be tried without an APK.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLE_REPORT } from '../src/data/sample';
import { validateReport } from '../src/lib/validate';
import { REPORTS_DIR } from './paths';

const out = join(REPORTS_DIR, 'fooddash.json');
mkdirSync(REPORTS_DIR, { recursive: true });
writeFileSync(out, JSON.stringify(SAMPLE_REPORT, null, 2) + '\n');

const v = validateReport(JSON.parse(readFileSync(out, 'utf8')));
v.errors.forEach((e) => console.log(`  error    ${e}`));
v.warnings.forEach((w) => console.log(`  warning  ${w}`));
console.log(v.ok ? `✓ Wrote ${out} (valid). Open it with: npm run view fooddash` : `✗ ${out} failed validation`);
process.exit(v.ok ? 0 : 1);
