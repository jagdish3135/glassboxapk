import { jsPDF } from 'jspdf';
import type { Report } from '../../types';
import { computeLayout, route } from '../layout';
import { GROUP_NAME, HEX, KIND_HEX, KIND_NAME, exportBaseName, fmtBytes, mapLinks, pad2 } from './common';

// PDF report: the full inventory (stack, SDKs, permissions, entry points, network, size),
// the system map, and every flow as a numbered step list with its code references.

const PW = 210, PH = 297, M = 16, CW = PW - M * 2; // A4 portrait, millimetres
const PT = 0.3528; // mm per point

// The built-in PDF fonts only cover Latin-1, so swap the few typographic characters the viewer uses.
const SWAP: Record<string, string> = { '→': '->', '←': '<-', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': ' - ', '…': '...', '•': '·', '✓': 'v', '≥': '>=', '≤': '<=', ' ': ' ' };
const clean = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, (c) => SWAP[c] ?? '?');

type Font = 'helvetica' | 'times' | 'courier';
interface TextOpts { font?: Font; style?: 'normal' | 'bold' | 'italic'; size?: number; color?: string }
interface Col extends TextOpts { w: number }

export function buildPdf(r: Report): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${r.app.name} system design`, subject: 'GlassBoxAPK report', creator: 'GlassBoxAPK' });
  let y = M;

  const set = ({ font = 'helvetica', style = 'normal', size = 10, color = HEX.ink }: TextOpts) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(`#${color}`);
  };
  const lh = (size: number) => size * PT * 1.35;
  const ensure = (h: number) => { if (y + h > PH - M - 8) { doc.addPage(); y = M; } };
  const wrap = (text: string, w: number, o: TextOpts) => { set(o); return doc.splitTextToSize(clean(text), w) as string[]; };

  /** Wrapped paragraph that can break across pages. */
  const para = (text: string, o: TextOpts & { x?: number; w?: number; after?: number } = {}) => {
    const size = o.size ?? 10, x = o.x ?? M;
    for (const line of wrap(text, o.w ?? CW - (x - M), o)) {
      ensure(lh(size));
      set(o);
      doc.text(line, x, y, { baseline: 'top' });
      y += lh(size);
    }
    y += o.after ?? 0;
  };
  const eyebrow = (text: string, x = M) => { set({ font: 'courier', size: 8, color: HEX.ink3 }); doc.text(clean(text.toUpperCase()), x, y, { baseline: 'top', charSpace: 0.3 }); };
  const heading = (text: string, count?: string) => {
    ensure(22);
    y += 5;
    doc.setDrawColor(`#${HEX.ink}`); doc.setLineWidth(0.35); doc.line(M, y, PW - M, y);
    y += 3;
    set({ font: 'times', size: 16 }); doc.text(clean(text), M, y, { baseline: 'top' });
    if (count) { set({ font: 'courier', size: 9, color: HEX.ink3 }); doc.text(count, PW - M, y + 1.5, { baseline: 'top', align: 'right' }); }
    y += lh(16) + 3;
  };
  /** Rows with wrapped cells and a thin rule above each row. */
  const table = (cols: Col[], rows: string[][]) => {
    for (const row of rows) {
      const cells = row.map((c, i) => wrap(c, cols[i].w - 3, cols[i]));
      const h = Math.max(...cells.map((c, i) => c.length * lh(cols[i].size ?? 9.5))) + 3;
      ensure(h);
      doc.setDrawColor(`#${HEX.line}`); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y);
      let x = M;
      cells.forEach((lines, i) => {
        set(cols[i]);
        doc.text(lines, x, y + 1.5, { baseline: 'top', lineHeightFactor: 1.35 });
        x += cols[i].w;
      });
      y += h;
    }
    y += 2;
  };

  // ---- Cover
  eyebrow('GlassBox report');
  y += 6;
  doc.setFillColor(`#${HEX.signal}`); doc.circle(M + 1.6, y + 1, 1.6, 'F');
  y += 5;
  para(r.app.name, { font: 'times', size: 30 });
  para(r.app.packageName, { font: 'courier', size: 10, color: HEX.ink2, after: 2 });
  const source = r.source === 'agent' ? 'Analysed by an AI agent with static analysis. Steps are inferred from the code.' : r.source === 'sample' ? 'Sample report for a fictional app.' : 'Scanned in the browser.';
  para(`${source} File: ${r.fileName}`, { size: 9, color: HEX.ink3, after: 5 });

  const facts: [string, string][] = [
    ['Version', `${r.app.versionName} (${r.app.versionCode})`], ['Android', `API ${r.app.minSdk}-${r.app.targetSdk}`],
    ['Size', fmtBytes(r.app.sizeBytes)], ['Stack', r.stack.primary],
  ];
  ensure(16);
  facts.forEach(([k, v], i) => {
    const x = M + i * (CW / 4);
    eyebrow(k, x);
    set({ size: 11, style: 'bold' }); doc.text(clean(v), x, y + 4.5, { baseline: 'top', maxWidth: CW / 4 - 4 });
  });
  y += 14;
  const steps = r.flows.reduce((n, f) => n + f.steps.length, 0);
  const sensitive = r.permissions.filter((p) => p.risk !== 'normal').length;
  para(`${r.sdks.length} SDKs and libraries · ${sensitive} sensitive permissions · ${r.entryPoints.length} entry points · ${r.hosts.length} hosts · ${r.flows.length} flows (${steps} steps)`, { size: 10, color: HEX.ink2 });

  // ---- Stack
  heading('Built with');
  para(`${r.stack.primary} · ${r.stack.language}`, { size: 12, style: 'bold', after: 1 });
  for (const s of r.stack.signals) para(`·  ${s}`, { size: 10, color: HEX.ink2 });
  if (r.stack.abis.length) para(`CPU architectures: ${r.stack.abis.join(', ')}`, { size: 9, color: HEX.ink3 });
  const c = r.components;
  para(`Components: ${c.activities} activities, ${c.services} services, ${c.receivers} receivers, ${c.providers} providers`, { size: 9, color: HEX.ink3 });

  // ---- System map
  heading('System map', `${r.architecture.nodes.length} boxes`);
  drawMap(doc, r, (h) => { ensure(h); return y; }, (h) => { y += h + 4; });

  // ---- SDKs
  heading('SDKs and libraries', String(r.sdks.length));
  if (!r.sdks.length) para('No known SDKs matched. The code may be heavily obfuscated.', { color: HEX.ink3 });
  const sdks = [...r.sdks].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  table([{ w: 48, style: 'bold' }, { w: 42, color: HEX.ink2 }, { w: CW - 90, font: 'courier', size: 8, color: HEX.ink2 }], sdks.map((s) => [s.name, s.category, s.evidence]));

  // ---- Permissions
  heading('Permissions', String(r.permissions.length));
  table(
    [{ w: 70, font: 'courier', size: 8.5, style: 'bold' }, { w: 24, size: 8.5, style: 'bold' }, { w: CW - 94, color: HEX.ink2 }],
    r.permissions.map((p) => [p.short, p.risk === 'normal' ? 'normal' : p.risk.toUpperCase(), p.why ?? (p.name.startsWith('android.permission.') ? 'Granted at install' : p.name)]),
  );

  // ---- Entry points
  heading('Entry points', String(r.entryPoints.length));
  para('Every way the app can be started. Each one is the start of at least one flow.', { size: 9, color: HEX.ink3, after: 1 });
  table([{ w: 24, size: 8.5, style: 'bold' }, { w: 80, font: 'courier', size: 8 }, { w: CW - 104, color: HEX.ink2 }], r.entryPoints.map((e) => [e.kind, e.target, e.detail]));

  // ---- Network
  heading('Network surface');
  eyebrow('Hosts found in the code'); y += 5;
  para(r.hosts.length ? r.hosts.join('   ') : 'None found. URLs may be built at runtime or loaded from config.', { font: 'courier', size: 8.5, after: 3 });
  ensure(10); eyebrow('API paths'); y += 5;
  para(r.apiPaths.length ? r.apiPaths.join('   ') : 'No versioned API paths found in string constants.', { font: 'courier', size: 8.5 });

  // ---- Size
  heading('What takes up space', fmtBytes(r.app.sizeBytes));
  const total = r.size.reduce((a, p) => a + p.bytes, 0) || 1;
  table([{ w: 60 }, { w: 40, font: 'courier', size: 9 }, { w: CW - 100, font: 'courier', size: 9, color: HEX.ink3 }], r.size.map((p) => [p.label, fmtBytes(p.bytes), `${Math.round((p.bytes / total) * 100)}%`]));

  // ---- Flows
  heading('Flows', `${r.flows.length} flows · ${steps} steps`);
  if (!r.flows.length) para('No flows were traced for this report yet.', { color: HEX.ink3 });
  const label = (id: string) => r.architecture.nodes.find((n) => n.id === id)?.label ?? id;
  r.flows.forEach((f, fi) => {
    ensure(40);
    y += 3;
    eyebrow(`Flow ${fi + 1} of ${r.flows.length} · ${GROUP_NAME[f.group]} · ${f.steps.length} steps`);
    y += 5;
    para(f.name, { font: 'times', size: 15, after: 0.5 });
    para(f.summary, { size: 10, color: HEX.ink2, after: 1 });
    para(`Starts at: ${f.entry}    Ends with: ${f.goal}`, { size: 9, color: HEX.ink3, after: 2 });
    f.steps.forEach((s, si) => {
      const textLines = wrap(s.text, CW - 16, { size: 10 });
      const refLines = wrap(s.ref, CW - 16, { font: 'courier', size: 8 });
      const h = textLines.length * lh(10) + lh(8.5) + refLines.length * lh(8) + 3;
      ensure(h);
      doc.setDrawColor(`#${HEX.line}`); doc.setLineWidth(0.2); doc.line(M, y, PW - M, y);
      const top = y + 1.6;
      set({ font: 'courier', size: 9, style: 'bold' }); doc.text(pad2(si + 1), M, top, { baseline: 'top' });
      doc.setFillColor(`#${KIND_HEX[s.kind]}`); doc.circle(M + 10.5, top + 1.6, 1.3, 'F');
      set({ size: 10 }); doc.text(textLines, M + 16, top, { baseline: 'top', lineHeightFactor: 1.35 });
      let yy = top + textLines.length * lh(10);
      set({ size: 8.5, color: HEX.ink3 }); doc.text(clean(`${label(s.from)} -> ${label(s.to)}  ·  ${KIND_NAME[s.kind]}  ·  ${s.confidence}`), M + 16, yy, { baseline: 'top' });
      yy += lh(8.5);
      set({ font: 'courier', size: 8, color: HEX.ink2 }); doc.text(refLines, M + 16, yy, { baseline: 'top', lineHeightFactor: 1.35 });
      y += h;
    });
    y += 4;
  });

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    set({ font: 'courier', size: 7.5, color: HEX.ink3 });
    doc.text(clean(`GlassBoxAPK · ${r.app.name} ${r.app.versionName} · analysis only, no decompiled source`), M, PH - 9);
    doc.text(`${i} / ${pages}`, PW - M, PH - 9, { align: 'right' });
  }
  return doc;
}

/** Browser: builds the PDF and downloads it. */
export function downloadPdf(r: Report) {
  buildPdf(r).save(`${exportBaseName(r)}.pdf`);
}

/** The system map in print colours: light columns, white boxes, grey connections. */
function drawMap(doc: jsPDF, r: Report, reserve: (h: number) => number, advance: (h: number) => void) {
  const L = computeLayout(r.architecture);
  const k = CW / L.width;
  const h = L.height * k;
  const oy = reserve(h);
  const X = (v: number) => M + v * k, Y = (v: number) => oy + v * k;

  L.columns.forEach((c, i) => {
    doc.setFillColor(`#${HEX.paper2}`); doc.setDrawColor(`#${HEX.line}`); doc.setLineWidth(0.25);
    doc.roundedRect(X(c.x), Y(c.y), c.w * k, c.h * k, 2.5, 2.5, 'FD');
    doc.setFont('courier', 'normal'); doc.setFontSize(6); doc.setTextColor(`#${HEX.ink3}`);
    doc.text(clean(`${pad2(i + 1)} · ${c.label}`.toUpperCase()), X(c.x + 12), Y(c.y + 16), { maxWidth: (c.w - 24) * k });
  });
  doc.setDrawColor('#9A968D'); doc.setLineWidth(0.3);
  for (const l of mapLinks(r)) {
    const pts = route(L, l.from, l.to, 'storage');
    for (let i = 0; i < pts.length - 1; i++) doc.line(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]));
  }
  for (const n of Object.values(L.nodes)) {
    doc.setFillColor('#FFFFFF'); doc.setDrawColor(`#${HEX.ink}`); doc.setLineWidth(0.3);
    doc.roundedRect(X(n.x), Y(n.y), n.w * k, n.h * k, 1.8, 1.8, 'FD');
    doc.setFillColor(`#${HEX.signal}`); doc.rect(X(n.x), Y(n.y + 14), 0.6, (n.h - 28) * k, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(`#${HEX.ink}`);
    doc.text(clean(n.label), X(n.x + 14), Y(n.y + 25), { maxWidth: (n.w - 20) * k });
    if (n.sub) { doc.setFont('courier', 'normal'); doc.setFontSize(5.5); doc.setTextColor(`#${HEX.ink2}`); doc.text(clean(n.sub), X(n.x + 14), Y(n.y + 44), { maxWidth: (n.w - 20) * k }); }
  }
  advance(h);
}
