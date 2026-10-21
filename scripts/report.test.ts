// Report pipeline checks: the validator accepts good reports and names the problem in bad ones,
// and both exports produce real files (written to test/out/ so you can open them).
// Run: npm test   (runs after fixture.test.ts, which writes test/fixture.apk)
import JSZip from 'jszip';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { SAMPLE_REPORT } from '../src/data/sample';
import { scanApk } from '../src/lib/apk/scan';
import { validateReport } from '../src/lib/validate';
import { buildDeck } from '../src/lib/export/pptx';
import { buildPdf } from '../src/lib/export/pdf';
import type { Report } from '../src/types';

let failed = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`);
  if (!ok) failed++;
};
const clone = (): Report => JSON.parse(JSON.stringify(SAMPLE_REPORT));
mkdirSync('test/out', { recursive: true });

// ---------- Validator: good reports
const sampleJson = JSON.stringify(SAMPLE_REPORT, null, 2);
writeFileSync('test/out/fooddash.json', sampleJson);
const good = validateReport(JSON.parse(sampleJson));
check('sample report is valid', good.ok && good.errors.length === 0, good.errors);
check('sample report has no warnings', good.warnings.length === 0, good.warnings);

const agent = { ...clone(), source: 'agent' as const };
agent.flows.forEach((f) => f.steps.forEach((s) => (s.confidence = 'inferred')));
check('agent report with inferred steps is valid', validateReport(agent).ok, validateReport(agent).errors);

if (existsSync('test/fixture.apk')) {
  const scanned = await scanApk(new File([readFileSync('test/fixture.apk')], 'fixture.apk'), () => {});
  const v = validateReport({ ...scanned, source: 'agent', scanMs: undefined });
  check('scan output (starter report) is valid', v.ok, v.errors);
}

// ---------- Validator: bad reports name the field
const expectError = (name: string, mutate: (r: Report & Record<string, unknown>) => void, needle: string) => {
  const r = clone() as Report & Record<string, unknown>;
  mutate(r);
  const v = validateReport(r);
  check(`rejects ${name}`, !v.ok && v.errors.some((e) => e.includes(needle)), v.errors);
};
expectError('a step to an unknown node', (r) => { r.flows[0].steps[2].to = 'vm2'; }, 'flows[0].steps[2].to: "vm2" is not a node id');
expectError('a step from a box to itself', (r) => { r.flows[1].steps[0].to = r.flows[1].steps[0].from; }, 'flows[1].steps[0]: from and to are both');
expectError('a wrong step kind', (r) => { (r.flows[0].steps[0] as { kind: string }).kind = 'call'; }, 'flows[0].steps[0].kind: must be one of');
expectError('a missing field', (r) => { delete (r.app as Partial<Report['app']>).packageName; }, 'app.packageName: expected a string');
expectError('an unknown field', (r) => { r.notes = 'x'; }, 'notes: is not a field of this type');
expectError('overlapping boxes', (r) => { r.architecture.nodes[1].row = 0; }, 'sits in the same column and row');
expectError('a column that does not exist', (r) => { r.architecture.nodes[0].col = 9; }, "column 9 doesn't exist");
expectError('duplicate flow ids', (r) => { r.flows[1].id = r.flows[0].id; }, 'duplicate flow id');
expectError('a flow id that cannot go in a URL', (r) => { r.flows[0].id = 'Login Flow'; }, 'must be lowercase letters');
expectError('source code in a ref', (r) => { r.flows[0].steps[1].ref = 'public final void login(String phone) {'; }, 'looks like source code');
expectError('a statement in a step text', (r) => { r.flows[0].steps[1].text = 'this.repo.verify(otp); return result;'; }, 'looks like source code');
expectError('a multi-line snippet', (r) => { r.flows[0].steps[1].ref = 'AuthRepository.kt\nfun verify()'; }, 'must be one line');
check('rejects a non-object', validateReport([]).errors[0]?.startsWith('(root): expected an object'), validateReport([]).errors);

// ---------- PPT export
const totalSteps = SAMPLE_REPORT.flows.reduce((n, f) => n + f.steps.length, 0);
const pptBuf = (await buildDeck(SAMPLE_REPORT).stream({ compression: true })) as Buffer; // write() ignores compression in pptxgenjs 4
writeFileSync('test/out/fooddash.pptx', pptBuf);
check('PPTX is a zip', pptBuf.subarray(0, 2).toString() === 'PK', pptBuf.subarray(0, 4));
const pz = await JSZip.loadAsync(pptBuf);
const slides = Object.keys(pz.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
check(`PPTX has title + map + one slide per step (${2 + totalSteps})`, slides.length === 2 + totalSteps, slides.length);
const s1 = await pz.file('ppt/slides/slide1.xml')!.async('string');
check('title slide has the app name as text', s1.includes('>FoodDash<'), s1.slice(0, 200));
const s2 = await pz.file('ppt/slides/slide2.xml')!.async('string');
check('map slide draws boxes as shapes with editable labels', (s2.match(/prstGeom prst="roundRect"/g)?.length ?? 0) >= SAMPLE_REPORT.architecture.nodes.length && s2.includes('>API gateway<'), s2.length);
const s6 = await pz.file('ppt/slides/slide6.xml')!.async('string');
const st4 = SAMPLE_REPORT.flows[0].steps[3];
check('step slide has caption, route arrow and code ref', s6.includes('POST /v1/auth/verify') && s6.includes(st4.ref) && s6.includes('tailEnd type="triangle"'), s6.length);

// ---------- PDF export
const pdfBuf = Buffer.from(buildPdf(SAMPLE_REPORT).output('arraybuffer'));
writeFileSync('test/out/fooddash.pdf', pdfBuf);
check('PDF has a PDF header', pdfBuf.subarray(0, 5).toString() === '%PDF-', pdfBuf.subarray(0, 8).toString());
const raw = pdfBuf.toString('latin1');
const pages = Number(/\/Type \/Pages[\s\S]*?\/Count (\d+)/.exec(raw)?.[1] ?? 0);
check('PDF has several pages', pages >= 4, pages);
const text = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
  .map((m) => { try { return inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { return m[1]; } })
  .join('\n');
const has = (s: string) => text.includes(`(${s})`) || text.includes(s);
check('PDF lists stack, SDKs, permissions and entry points', has('Built with') && has('Retrofit') && has('ACCESS_FINE_LOCATION') && has('Entry points'), text.length);
check('PDF lists every flow by name', SAMPLE_REPORT.flows.every((f) => has(f.name)), SAMPLE_REPORT.flows.map((f) => [f.name, has(f.name)]));
check('PDF has numbered steps with code refs', has('PaymentSheet.present') && has('MenuDao.upsertAll') && has('18'), null);

console.log(failed ? `\n${failed} check(s) failed` : `\nAll checks passed · exports in test/out/ (${slides.length} slides, ${pages} PDF pages)`);
process.exit(failed ? 1 : 0);
