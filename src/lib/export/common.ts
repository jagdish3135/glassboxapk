import type { FlowGroup, Report, StepKind } from '../../types';

// Hex versions of the viewer's CSS tokens (PPT and PDF can't read CSS variables).
export const HEX = {
  paper: 'ECE8DF', paper2: 'F6F3ED', ink: '141414', ink2: '47443E', ink3: '8A867C', line: 'D2CEC6',
  stage: '0C1012', stage2: '141A1D', stageNode: '1A2124', stageLine: '2E3538', stageText: 'E9EDE9', stageMute: '8B9896',
  signal: 'FF5A1F', mint: '2FD3A7', violet: 'A493FF', alarm: 'FF4458',
};

export const KIND_HEX: Record<StepKind, string> = { request: HEX.signal, response: HEX.mint, storage: HEX.violet, error: HEX.alarm };
export const KIND_NAME: Record<StepKind, string> = { request: 'Request', response: 'Response', storage: 'Local storage', error: 'Error' };
export const GROUP_NAME: Record<FlowGroup, string> = { happy: 'Happy path', edge: 'Error and edge path', background: 'Background', 'third-party': 'Third-party' };
export const GROUP_HEX: Record<FlowGroup, string> = { happy: HEX.signal, edge: HEX.alarm, background: HEX.violet, 'third-party': HEX.mint };

/** "FoodDash 4.12.0" → "fooddash-4.12.0-glassbox" (no extension). */
export function exportBaseName(r: Report) {
  const slug = `${r.app.name}-${r.app.versionName}`.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'report'}-glassbox`;
}

/** Same links the system map draws: the static ones, or every pair of boxes a flow step connects. */
export function mapLinks(r: Report) {
  if (r.architecture.links?.length) return r.architecture.links;
  const seen = new Set<string>();
  const out: { from: string; to: string }[] = [];
  for (const f of r.flows) for (const s of f.steps) {
    const key = [s.from, s.to].sort().join('|');
    if (!seen.has(key)) { seen.add(key); out.push({ from: s.from, to: s.to }); }
  }
  return out;
}

export const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const pad2 = (n: number) => String(n).padStart(2, '0');
