import {
  CONFIDENCES, ENTRY_KINDS, FLOW_GROUPS, PERMISSION_RISKS, REPORT_SOURCES, SDK_CATEGORIES, STEP_KINDS,
  type ArchNode, type Architecture, type EntryPoint, type Flow, type FlowStep, type Permission, type Report,
  type Sdk, type SizePart, type StackInfo,
} from '../types';

// Checks a report JSON against the shapes in src/types.ts, then checks that the parts fit together
// (steps point at real nodes, no two boxes share a cell, no source code in the text).
// The specs are typed against the interfaces, so adding a field to a type without adding it here fails `tsc`.

export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[] }

interface Ctx { err: (path: string, msg: string) => void; warn: (path: string, msg: string) => void }
type Check = (v: unknown, path: string, c: Ctx) => void;
type Spec<T> = { [K in keyof T]-?: Check };

const show = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v) : JSON.stringify(v) ?? String(v));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (nonEmpty = true): Check => (v, p, c) => {
  if (typeof v !== 'string') c.err(p, `expected a string, got ${show(v)}`);
  else if (nonEmpty && !v.trim()) c.err(p, 'must not be empty');
};
const num = (integer = false): Check => (v, p, c) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) c.err(p, `expected a number, got ${show(v)}`);
  else if (v < 0) c.err(p, 'must be 0 or more');
  else if (integer && !Number.isInteger(v)) c.err(p, 'must be a whole number');
};
const oneOf = (list: readonly string[]): Check => (v, p, c) => {
  if (!list.includes(v as string)) c.err(p, `must be one of ${list.map((x) => `"${x}"`).join(', ')}, got ${show(v)}`);
};
const opt = (check: Check): Check => (v, p, c) => { if (v !== undefined) check(v, p, c); };
const arr = (item: Check): Check => (v, p, c) => {
  if (!Array.isArray(v)) { c.err(p, `expected an array, got ${show(v)}`); return; }
  v.forEach((x, i) => item(x, `${p}[${i}]`, c));
};
function obj<T>(spec: Spec<T>): Check {
  return (v, p, c) => {
    if (!isObj(v)) { c.err(p, `expected an object, got ${show(v)}`); return; }
    for (const k of Object.keys(spec)) (spec as Record<string, Check>)[k](v[k], p ? `${p}.${k}` : k, c);
    for (const k of Object.keys(v)) if (!(k in spec)) c.err(p ? `${p}.${k}` : k, 'is not a field of this type (remove it)');
  };
}

const step = obj<FlowStep>({ from: str(), to: str(), kind: oneOf(STEP_KINDS), text: str(), ref: str(), confidence: oneOf(CONFIDENCES) });
const flow = obj<Flow>({ id: str(), name: str(), group: oneOf(FLOW_GROUPS), entry: str(), goal: str(), summary: str(), steps: arr(step) });
const node = obj<ArchNode>({ id: str(), label: str(), sub: opt(str(false)), col: num(true), row: num(true) });
const architecture = obj<Architecture>({ columns: arr(str()), nodes: arr(node), links: opt(arr(obj<{ from: string; to: string }>({ from: str(), to: str() }))) });
const sdk = obj<Sdk>({ name: str(), category: oneOf(SDK_CATEGORIES), evidence: str() });
const permission = obj<Permission>({ name: str(), short: str(), risk: oneOf(PERMISSION_RISKS), why: opt(str()) });
const entryPoint = obj<EntryPoint>({ kind: oneOf(ENTRY_KINDS), target: str(), detail: str(false) });
const sizePart = obj<SizePart>({ label: str(), bytes: num(true) });
const stack = obj<StackInfo>({ primary: str(), language: str(), signals: arr(str()), abis: arr(str()) });

const report = obj<Report>({
  source: oneOf(REPORT_SOURCES),
  fileName: str(),
  app: obj<Report['app']>({
    name: str(), packageName: str(), versionName: str(), versionCode: str(), minSdk: str(), targetSdk: str(), sizeBytes: num(true),
  }),
  stack,
  sdks: arr(sdk),
  permissions: arr(permission),
  entryPoints: arr(entryPoint),
  components: obj<Report['components']>({ activities: num(true), services: num(true), receivers: num(true), providers: num(true) }),
  size: arr(sizePart),
  hosts: arr(str()),
  apiPaths: arr(str()),
  architecture,
  flows: arr(flow),
  scanMs: opt(num()),
});

/** Looks like a line of Java/Kotlin/smali rather than a class or method name. */
const CODE_LIKE = /;\s*$|;\s+\S.*;|\breturn\s+\S|\b(public|private|protected)\s+(static\s+|final\s+)*\w+\s+\w|=\s*new\s+[A-Z]|\)\s*\{|\bthrow\s+new\b|\binvoke-(virtual|static|direct)\b|\bconst-string\b/;
const FLOW_ID = /^[a-z0-9][a-z0-9-]*$/;
const MAX_REF = 160;
const MAX_TEXT = 240;

export function validateReport(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const c: Ctx = { err: (p, m) => errors.push(`${p || '(root)'}: ${m}`), warn: (p, m) => warnings.push(`${p || '(root)'}: ${m}`) };

  report(data, '', c);
  if (errors.length) return { ok: false, errors, warnings };
  const r = data as Report;

  // ---- Architecture
  const cols = r.architecture.columns.length;
  if (!cols) c.err('architecture.columns', 'needs at least one column');
  const ids = new Set<string>();
  const cells = new Map<string, string>();
  r.architecture.nodes.forEach((n, i) => {
    const p = `architecture.nodes[${i}]`;
    if (ids.has(n.id)) c.err(`${p}.id`, `duplicate node id "${n.id}"`);
    ids.add(n.id);
    if (n.col >= cols) c.err(`${p}.col`, `column ${n.col} doesn't exist (there are ${cols} columns, numbered from 0)`);
    const cell = `${n.col},${n.row}`;
    if (cells.has(cell)) c.err(p, `"${n.id}" sits in the same column and row as "${cells.get(cell)}" (boxes would overlap)`);
    cells.set(cell, n.id);
    if (n.label.length > 22) c.warn(`${p}.label`, `"${n.label}" is ${n.label.length} characters; boxes fit about 20`);
    if ((n.sub?.length ?? 0) > 28) c.warn(`${p}.sub`, `"${n.sub}" is long; boxes fit about 26 characters`);
  });
  if (!r.architecture.nodes.length) c.err('architecture.nodes', 'needs at least one node');
  const known = [...ids].join(', ');
  (r.architecture.links ?? []).forEach((l, i) => {
    if (!ids.has(l.from)) c.err(`architecture.links[${i}].from`, `"${l.from}" is not a node id (known: ${known})`);
    if (!ids.has(l.to)) c.err(`architecture.links[${i}].to`, `"${l.to}" is not a node id (known: ${known})`);
  });

  // ---- Flows
  const flowIds = new Set<string>();
  const used = new Set<string>();
  r.flows.forEach((f, fi) => {
    const p = `flows[${fi}]`;
    if (!FLOW_ID.test(f.id)) c.err(`${p}.id`, `"${f.id}" must be lowercase letters, digits and dashes (it goes in the URL)`);
    if (flowIds.has(f.id)) c.err(`${p}.id`, `duplicate flow id "${f.id}"`);
    flowIds.add(f.id);
    if (!f.steps.length) c.err(`${p}.steps`, 'a flow needs at least one step');
    for (const k of ['name', 'entry', 'goal', 'summary'] as const) checkProse(f[k], `${p}.${k}`, c);
    f.steps.forEach((s, si) => {
      const sp = `${p}.steps[${si}]`;
      if (!ids.has(s.from)) c.err(`${sp}.from`, `"${s.from}" is not a node id (known: ${known})`);
      if (!ids.has(s.to)) c.err(`${sp}.to`, `"${s.to}" is not a node id (known: ${known})`);
      if (s.from === s.to) c.err(sp, `from and to are both "${s.from}"; a step must move between two boxes`);
      used.add(s.from); used.add(s.to);
      checkProse(s.text, `${sp}.text`, c);
      checkProse(s.ref, `${sp}.ref`, c, MAX_REF);
      if (r.source === 'agent' && s.confidence === 'verified') c.warn(`${sp}.confidence`, 'static analysis can only infer; use "inferred" unless the step was observed at runtime');
    });
  });
  if (!r.flows.length) c.warn('flows', 'no flows yet; the viewer will only show the entry points');
  else r.architecture.nodes.forEach((n, i) => { if (!used.has(n.id)) c.warn(`architecture.nodes[${i}]`, `"${n.id}" is not used by any flow step`); });

  return { ok: errors.length === 0, errors, warnings };

  function checkProse(v: string, p: string, ctx: Ctx, max = MAX_TEXT) {
    if (/[\r\n]/.test(v)) ctx.err(p, 'must be one line (no source code or multi-line snippets)');
    else if (v.length > max) ctx.err(p, `is ${v.length} characters; keep it under ${max} (a reference, not a code excerpt)`);
    else if (CODE_LIKE.test(v)) ctx.err(p, `looks like source code (${show(v)}); name the class, method or file instead`);
  }
}
