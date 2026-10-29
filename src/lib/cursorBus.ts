// A tiny shared store between the 3D scene and the DOM cursor. No three.js here, so the
// viewer (app.html) can use the cursor without downloading the 3D bundle.

export interface CursorState {
  /** True while the pointer is over the glass box: the ring becomes a magnifier lens. */
  inspect: boolean;
  /** Lens radius in CSS pixels (the scene's magnifier shader uses the same value). */
  lensRadius: number;
}

const state: CursorState = { inspect: false, lensRadius: 64 };

/** Where the ring is drawn right now (client px), updated every frame without notifying
 *  listeners. The magnifier shader reads it so the zoom sits exactly inside the ring. */
export const ringPos = { x: -1000, y: -1000 };
const listeners = new Set<(s: CursorState) => void>();

export const cursorBus = {
  get: () => state,
  set(patch: Partial<CursorState>) {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof CursorState)[]) {
      if (state[k] !== patch[k]) { (state as unknown as Record<string, unknown>)[k] = patch[k]; changed = true; }
    }
    if (changed) listeners.forEach((l) => l(state));
  },
  subscribe(fn: (s: CursorState) => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/** The custom cursor only runs on fine pointers that can hover, and never with reduced motion. */
export function cursorAllowed() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
