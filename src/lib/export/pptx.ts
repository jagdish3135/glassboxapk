import PptxGenJS from 'pptxgenjs';
import type { Flow, Report } from '../../types';
import { computeLayout, route } from '../layout';
import { GROUP_HEX, GROUP_NAME, HEX, KIND_HEX, KIND_NAME, exportBaseName, fmtBytes, mapLinks, pad2 } from './common';

// PowerPoint deck: a title slide, the system map, then one slide per flow step.
// Everything is real text and shapes (no screenshots), so the deck stays editable.

const DISPLAY = 'Georgia';
const BODY = 'Arial';
const MONO = 'Consolas';
const SW = 13.333; // LAYOUT_WIDE, inches

type Slide = PptxGenJS.Slide;
interface Box { x: number; y: number; w: number; h: number }
interface Highlight { flow: Flow; step: number }

export function buildDeck(r: Report): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `${r.app.name} system design`;
  pptx.subject = 'GlassBoxAPK report';
  pptx.company = 'GlassBoxAPK';
  pptx.theme = { headFontFace: DISPLAY, bodyFontFace: BODY };

  titleSlide(pptx, r);
  mapSlide(pptx, r);
  r.flows.forEach((flow, fi) => flow.steps.forEach((_, si) => stepSlide(pptx, r, flow, fi, si)));
  return pptx;
}

/** Browser: builds the deck and downloads it. */
export async function downloadPptx(r: Report) {
  await buildDeck(r).writeFile({ fileName: `${exportBaseName(r)}.pptx`, compression: true });
}

// ---------- Slides ----------

function base(pptx: PptxGenJS, r: Report): Slide {
  const s = pptx.addSlide();
  s.background = { color: HEX.paper };
  s.addText(`GlassBoxAPK · ${r.app.name} ${r.app.versionName}`, { x: 0.5, y: 7.05, w: 7, h: 0.3, fontFace: MONO, fontSize: 8, color: HEX.ink3, margin: 0 });
  s.addText('Analysis only. No decompiled source.', { x: SW - 4.5, y: 7.05, w: 4, h: 0.3, fontFace: MONO, fontSize: 8, color: HEX.ink3, align: 'right', margin: 0 });
  return s;
}

function eyebrow(s: Slide, text: string, x: number, y: number, w: number, color = HEX.ink3, align: 'left' | 'right' = 'left') {
  s.addText(text.toUpperCase(), { x, y, w, h: 0.3, fontFace: MONO, fontSize: 9, color, charSpacing: 1, margin: 0, align });
}

function titleSlide(pptx: PptxGenJS, r: Report) {
  const s = base(pptx, r);
  const steps = r.flows.reduce((n, f) => n + f.steps.length, 0);
  const source = r.source === 'agent' ? 'Analysed by an AI agent · static analysis' : r.source === 'sample' ? 'Sample report · fictional app' : 'Browser scan';
  eyebrow(s, 'GlassBox report', 0.6, 0.7, 6);
  s.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: 1.32, w: 0.16, h: 0.16, fill: { color: HEX.signal }, line: { color: HEX.signal, width: 0 } });
  s.addText(r.app.name, { x: 0.55, y: 1.55, w: 6.6, h: 1.3, fontFace: DISPLAY, fontSize: 54, color: HEX.ink, margin: 0, fit: 'shrink' });
  s.addText(`System design · ${r.flows.length} flow${r.flows.length === 1 ? '' : 's'} · ${steps} steps`, { x: 0.6, y: 2.9, w: 6.6, h: 0.45, fontFace: BODY, fontSize: 18, color: HEX.ink2, margin: 0 });
  s.addText(r.app.packageName, { x: 0.6, y: 3.4, w: 6.6, h: 0.35, fontFace: MONO, fontSize: 12, color: HEX.ink2, margin: 0 });

  const facts: [string, string][] = [
    ['Version', `${r.app.versionName} (${r.app.versionCode})`],
    ['Android', `API ${r.app.minSdk}–${r.app.targetSdk}`],
    ['Size', fmtBytes(r.app.sizeBytes)],
    ['Stack', `${r.stack.primary} · ${r.stack.language}`],
  ];
  facts.forEach(([k, v], i) => {
    const x = 0.6 + (i % 2) * 3.3, y = 4.3 + Math.floor(i / 2) * 0.85;
    eyebrow(s, k, x, y, 3.1);
    s.addText(v, { x, y: y + 0.28, w: 3.1, h: 0.4, fontFace: BODY, fontSize: 14, bold: true, color: HEX.ink, margin: 0, fit: 'shrink' });
  });
  s.addText(source, { x: 0.6, y: 6.2, w: 6.6, h: 0.3, fontFace: MONO, fontSize: 9, color: HEX.ink3, margin: 0 });

  // Right: the flow list on the dark stage.
  const panel = { x: 7.6, y: 0.6, w: 5.2, h: 6.2 };
  s.addShape(pptx.ShapeType.roundRect, { ...panel, fill: { color: HEX.stage }, line: { color: HEX.stage, width: 0 }, rectRadius: 0.06 });
  eyebrow(s, 'Flows in this deck', panel.x + 0.35, panel.y + 0.3, 4.5, HEX.stageMute);
  const list = r.flows.slice(0, 14);
  const rowH = Math.min(0.4, 5.2 / Math.max(1, list.length));
  list.forEach((f, i) => {
    const y = panel.y + 0.75 + i * rowH;
    const color = GROUP_HEX[f.group];
    s.addShape(pptx.ShapeType.ellipse, { x: panel.x + 0.38, y: y + rowH / 2 - 0.05, w: 0.1, h: 0.1, fill: { color }, line: { color, width: 0 } });
    s.addText([
      { text: `${pad2(i + 1)}  `, options: { fontFace: MONO, fontSize: 10, color: HEX.stageMute } },
      { text: f.name, options: { fontFace: BODY, fontSize: 13, color: HEX.stageText } },
      { text: `  ${f.steps.length} steps`, options: { fontFace: MONO, fontSize: 9, color: HEX.stageMute } },
    ], { x: panel.x + 0.6, y, w: 4.4, h: rowH, margin: 0, valign: 'middle' });
  });
  if (r.flows.length > list.length) s.addText(`+ ${r.flows.length - list.length} more`, { x: panel.x + 0.6, y: panel.y + 0.75 + list.length * rowH, w: 4, h: 0.3, fontFace: MONO, fontSize: 9, color: HEX.stageMute, margin: 0 });
  if (!r.flows.length) s.addText('No flows traced yet.', { x: panel.x + 0.6, y: panel.y + 0.8, w: 4, h: 0.4, fontFace: BODY, fontSize: 13, color: HEX.stageMute, margin: 0 });
  s.addNotes(`${r.app.name} ${r.app.versionName} (${r.app.packageName}). ${source}.`);
}

function mapSlide(pptx: PptxGenJS, r: Report) {
  const s = base(pptx, r);
  const links = mapLinks(r);
  eyebrow(s, `${r.architecture.nodes.length} boxes · ${links.length} connections`, 0.5, 0.4, 8);
  s.addText('System map', { x: 0.5, y: 0.65, w: 12.3, h: 0.7, fontFace: DISPLAY, fontSize: 30, color: HEX.ink, margin: 0 });
  drawStage(pptx, s, r, { x: 0.5, y: 1.5, w: SW - 1, h: 5.35 });
  s.addNotes(`Columns: ${r.architecture.columns.join(', ')}.`);
}

function stepSlide(pptx: PptxGenJS, r: Report, flow: Flow, fi: number, si: number) {
  const s = base(pptx, r);
  const step = flow.steps[si];
  const color = KIND_HEX[step.kind];
  const label = (id: string) => r.architecture.nodes.find((n) => n.id === id)?.label ?? id;

  eyebrow(s, `Flow ${fi + 1}/${r.flows.length} · ${flow.name} · ${GROUP_NAME[flow.group]}`, 0.5, 0.35, 9);
  eyebrow(s, `Step ${pad2(si + 1)} / ${pad2(flow.steps.length)}`, SW - 3.5, 0.35, 3, HEX.ink, 'right');
  s.addText(step.text, { x: 0.5, y: 0.62, w: SW - 1, h: 0.75, fontFace: DISPLAY, fontSize: 24, color: HEX.ink, margin: 0, valign: 'middle', fit: 'shrink' });

  drawStage(pptx, s, r, { x: 0.5, y: 1.5, w: SW - 1, h: 4.55 }, { flow, step: si });

  // Caption row: kind badge, route, code ref, confidence.
  const y = 6.25;
  s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y, w: 1.55, h: 0.42, fill: { color, transparency: 82 }, line: { color, width: 1 }, rectRadius: 0.5 });
  s.addShape(pptx.ShapeType.ellipse, { x: 0.64, y: y + 0.16, w: 0.1, h: 0.1, fill: { color }, line: { color, width: 0 } });
  s.addText(KIND_NAME[step.kind], { x: 0.8, y, w: 1.2, h: 0.42, fontFace: BODY, fontSize: 11, bold: true, color: HEX.ink, margin: 0, valign: 'middle' });
  s.addText(`${label(step.from)}  →  ${label(step.to)}`, { x: 2.2, y, w: 3.9, h: 0.42, fontFace: BODY, fontSize: 14, color: HEX.ink, margin: 0, valign: 'middle', fit: 'shrink' });
  s.addShape(pptx.ShapeType.roundRect, { x: 6.2, y, w: 5.25, h: 0.42, fill: { color: HEX.ink }, line: { color: HEX.ink, width: 0 }, rectRadius: 0.2 });
  s.addText([
    { text: '</>  ', options: { color: HEX.signal } },
    { text: step.ref, options: { color: HEX.paper2 } },
  ], { x: 6.35, y, w: 5.0, h: 0.42, fontFace: MONO, fontSize: 11, margin: 0, valign: 'middle', fit: 'shrink' });
  s.addText(step.confidence, { x: 11.55, y, w: 1.28, h: 0.42, fontFace: MONO, fontSize: 10, color: step.confidence === 'verified' ? '1E9C78' : HEX.ink3, align: 'right', margin: 0, valign: 'middle' });

  s.addNotes(`${flow.name}, step ${si + 1} of ${flow.steps.length}: ${step.text}. ${label(step.from)} to ${label(step.to)}. Code: ${step.ref} (${step.confidence}).${si === 0 ? ` Flow: ${flow.summary} Starts at ${flow.entry}; ends with ${flow.goal}.` : ''}`);
}

// ---------- The map, drawn with shapes ----------

function drawStage(pptx: PptxGenJS, s: Slide, r: Report, box: Box, hl?: Highlight) {
  s.addShape(pptx.ShapeType.roundRect, { ...box, fill: { color: HEX.stage }, line: { color: HEX.stage, width: 0 }, rectRadius: 0.04 });
  const L = computeLayout(r.architecture);
  const pad = 0.12;
  const k = Math.min((box.w - pad * 2) / L.width, (box.h - pad * 2) / L.height);
  const ox = box.x + (box.w - L.width * k) / 2, oy = box.y + (box.h - L.height * k) / 2;
  const X = (v: number) => ox + v * k, Y = (v: number) => oy + v * k;

  L.columns.forEach((c, i) => {
    s.addShape(pptx.ShapeType.roundRect, { x: X(c.x), y: Y(c.y), w: c.w * k, h: c.h * k, fill: { color: HEX.stage2 }, line: { color: HEX.stageLine, width: 0.75 }, rectRadius: 0.08 });
    s.addText(`${pad2(i + 1)} · ${c.label}`.toUpperCase(), { x: X(c.x + 12), y: Y(c.y + 8), w: (c.w - 24) * k, h: 22 * k, fontFace: MONO, fontSize: 8, color: HEX.stageMute, margin: 0, valign: 'middle', fit: 'shrink' });
  });

  const step = hl ? hl.flow.steps[hl.step] : null;
  if (!hl) {
    for (const l of mapLinks(r)) polyline(pptx, s, route(L, l.from, l.to, 'storage'), X, Y, { color: '55605F', width: 1 });
  } else {
    hl.flow.steps.slice(0, hl.step).forEach((st) =>
      polyline(pptx, s, route(L, st.from, st.to, st.kind), X, Y, { color: KIND_HEX[st.kind], width: 1.25, transparency: 55, dash: st.kind === 'error' }));
  }

  const involved = new Set(hl?.flow.steps.flatMap((st) => [st.from, st.to]) ?? []);
  for (const n of Object.values(L.nodes)) {
    const active = !!step && (n.id === step.from || n.id === step.to);
    const dim = !!hl && !involved.has(n.id);
    s.addShape(pptx.ShapeType.roundRect, {
      x: X(n.x), y: Y(n.y), w: n.w * k, h: n.h * k, rectRadius: 0.15,
      fill: { color: active ? '22292C' : HEX.stageNode, transparency: dim ? 55 : 0 },
      line: { color: active ? KIND_HEX[step!.kind] : HEX.stageLine, width: active ? 1.75 : 0.75 },
    });
    s.addShape(pptx.ShapeType.rect, { x: X(n.x), y: Y(n.y + 12), w: 3 * k, h: (n.h - 24) * k, fill: { color: active ? KIND_HEX[step!.kind] : '5B6669', transparency: dim ? 60 : 0 }, line: { color: HEX.stageNode, width: 0 } });
    s.addText([
      { text: n.label, options: { fontFace: BODY, fontSize: 11, bold: true, color: dim ? '5E6866' : HEX.stageText, breakLine: !!n.sub } },
      ...(n.sub ? [{ text: n.sub, options: { fontFace: MONO, fontSize: 7.5, color: dim ? '4A5352' : HEX.stageMute } }] : []),
    ], { x: X(n.x + 14), y: Y(n.y), w: (n.w - 20) * k, h: n.h * k, margin: 0, valign: 'middle', fit: 'shrink' });
  }

  if (step) polyline(pptx, s, route(L, step.from, step.to, step.kind), X, Y, { color: KIND_HEX[step.kind], width: 3, dash: step.kind === 'error', arrow: true });
}

function polyline(
  pptx: PptxGenJS, s: Slide, pts: [number, number][], X: (v: number) => number, Y: (v: number) => number,
  o: { color: string; width: number; transparency?: number; dash?: boolean; arrow?: boolean },
) {
  const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
  for (let i = 0; i < p.length - 1; i++) {
    const [x1, y1] = [X(p[i][0]), Y(p[i][1])], [x2, y2] = [X(p[i + 1][0]), Y(p[i + 1][1])];
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipH: x2 < x1, flipV: y2 < y1,
      line: {
        color: o.color, width: o.width, transparency: o.transparency, dashType: o.dash ? 'dash' : 'solid',
        endArrowType: o.arrow && i === p.length - 2 ? 'triangle' : undefined,
      },
    });
  }
}
