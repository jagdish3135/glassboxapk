import type { Architecture, StepKind } from '../types';

export interface Box { x: number; y: number; w: number; h: number }
export interface NodeBox extends Box { id: string; label: string; sub?: string; col: number; row: number; cx: number; cy: number }
export interface Layout {
  width: number;
  height: number;
  columns: (Box & { label: string })[];
  nodes: Record<string, NodeBox>;
  laneX: number[];      // vertical lanes between columns
  rowGapY: number[];    // horizontal lanes between rows
}

const W = 1000, PAD = 20, COL_GAP = 64, TOP = 58, NODE_H = 60, ROW_GAP = 40, INSET = 14, BOTTOM = 22;

export function computeLayout(arch: Architecture): Layout {
  const k = Math.max(1, arch.columns.length);
  const colW = (W - PAD * 2 - COL_GAP * (k - 1)) / k;
  const rows = Math.max(1, ...arch.nodes.map((n) => n.row + 1));
  const height = TOP + rows * NODE_H + (rows - 1) * ROW_GAP + BOTTOM;

  const columns = arch.columns.map((label, i) => ({ label, x: PAD + i * (colW + COL_GAP), y: 14, w: colW, h: height - 22 }));
  const nodes: Record<string, NodeBox> = {};
  for (const n of arch.nodes) {
    const x = PAD + n.col * (colW + COL_GAP) + INSET;
    const y = TOP + n.row * (NODE_H + ROW_GAP);
    const w = colW - INSET * 2;
    nodes[n.id] = { ...n, x, y, w, h: NODE_H, cx: x + w / 2, cy: y + NODE_H / 2 };
  }
  const laneX = Array.from({ length: k - 1 }, (_, i) => PAD + (i + 1) * colW + i * COL_GAP + COL_GAP / 2);
  const rowGapY = Array.from({ length: rows }, (_, i) => TOP + (i + 1) * NODE_H + i * ROW_GAP + ROW_GAP / 2);
  return { width: W, height, columns, nodes, laneX, rowGapY };
}

type Pt = [number, number];

/** Offsets keep a request and its response on parallel tracks instead of on top of each other. */
const OFFSET: Record<StepKind, number> = { request: -6, response: 6, storage: 0, error: 0 };

export function route(L: Layout, fromId: string, toId: string, kind: StepKind = 'request'): Pt[] {
  const A = L.nodes[fromId], B = L.nodes[toId];
  if (!A || !B) return [];
  const o = OFFSET[kind];
  const k = L.columns.length;

  if (A.col === B.col) {
    if (Math.abs(A.row - B.row) === 1) {
      const down = B.row > A.row;
      const x = A.cx + o * 2;
      return [[x, down ? A.y + A.h : A.y], [x, down ? B.y : B.y + B.h]];
    }
    const right = A.col < k - 1;
    const lane = (right ? L.laneX[A.col] : L.laneX[A.col - 1]) + o;
    const ex = right ? A.x + A.w : A.x;
    return [[ex, A.cy + o], [lane, A.cy + o], [lane, B.cy + o], [ex, B.cy + o]];
  }

  const dir = B.col > A.col ? 1 : -1;
  const sx = dir > 0 ? A.x + A.w : A.x;
  const tx = dir > 0 ? B.x : B.x + B.w;
  const gA = (dir > 0 ? L.laneX[A.col] : L.laneX[A.col - 1]) + o;
  const gB = (dir > 0 ? L.laneX[B.col - 1] : L.laneX[B.col]) + o;
  const ya = A.cy + o, yb = B.cy + o;

  if (Math.abs(B.col - A.col) === 1) return [[sx, ya], [gA, ya], [gA, yb], [tx, yb]];

  // Crossing a column: travel along the row gap closest to both ends.
  const mid = (A.row + B.row) / 2;
  let gi = 0;
  L.rowGapY.forEach((_, i) => { if (Math.abs(i + 0.5 - mid) < Math.abs(gi + 0.5 - mid)) gi = i; });
  const gy = L.rowGapY[gi] + o;
  return [[sx, ya], [gA, ya], [gA, gy], [gB, gy], [gB, yb], [tx, yb]];
}

/** Polyline with softly rounded corners. */
export function roundedPath(pts: Pt[], r = 10): string {
  const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (clean.length < 2) return '';
  let d = `M${clean[0][0]} ${clean[0][1]}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const [px, py] = clean[i - 1], [x, y] = clean[i], [nx, ny] = clean[i + 1];
    const d1 = Math.hypot(x - px, y - py), d2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const ax = x - ((x - px) / d1) * rr, ay = y - ((y - py) / d1) * rr;
    const bx = x + ((nx - x) / d2) * rr, by = y + ((ny - y) / d2) * rr;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const last = clean[clean.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

export const KIND_COLOR: Record<StepKind, string> = {
  request: 'var(--signal)',
  response: 'var(--mint)',
  storage: 'var(--violet)',
  error: 'var(--alarm)',
};

export const KIND_LABEL: Record<StepKind, string> = {
  request: 'Request',
  response: 'Response',
  storage: 'Local storage',
  error: 'Error',
};
