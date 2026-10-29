// Shared between the landing page's GSAP master timeline (writes) and the lazily loaded
// 3D scene (reads every frame). Plain objects, no three.js, so the main bundle stays light.

/** Scroll story state. `p` runs 0 → 5: hero, crack, flow nodes, lines, deck, call to action. */
export const story = {
  p: 0,
  camX: 0,
  camY: 0,
  camZ: 9,
  /** Postprocessing chromatic aberration (a shader uniform), spikes when the box cracks. */
  aberration: 0.00015,
};

export const STORY_CHAPTERS = 5;

type ProgressFn = (pct: number) => void;
const progressFns = new Set<ProgressFn>();
let lastPct = 0;

/** Loading progress from the 3D scene's asset manager, 0 → 100. */
export const loadBus = {
  emit(pct: number) {
    lastPct = Math.max(lastPct, Math.min(100, pct));
    progressFns.forEach((f) => f(lastPct));
  },
  on(fn: ProgressFn) {
    progressFns.add(fn);
    fn(lastPct);
    return () => { progressFns.delete(fn); };
  },
};

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
