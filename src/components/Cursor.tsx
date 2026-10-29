import { useEffect, useRef } from 'react';
import { cursorAllowed, cursorBus, ringPos } from '../lib/cursorBus';
import './cursor.css';

/**
 * GlassBox cursor: a thin glass ring that trails the pointer, plus (on the landing page) a dot
 * that follows exactly. `full` hides the native cursor and adds labels, magnetic buttons and the
 * "inspect" lens; `ring` keeps the native cursor and only adds the follower ring (the viewer).
 * Off on touch devices and with reduced motion. Transform-only, pointer-events: none.
 */
export function Cursor({ mode = 'full' }: { mode?: 'full' | 'ring' }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!cursorAllowed()) return;
    const ring = ringRef.current!, dot = dotRef.current, label = labelRef.current!;
    const root = document.documentElement;
    if (mode === 'full') root.classList.add('cur-hide');
    root.classList.add('cur-on');

    let x = -100, y = -100, rx = -100, ry = -100, seen = false, raf = 0;
    let magnet: HTMLElement | null = null;

    const setState = (s: string, text = '') => {
      if (ring.dataset.state !== s) ring.dataset.state = s;
      if (label.textContent !== text) label.textContent = text;
    };

    const update = (target: Element | null) => {
      if (mode === 'full' && cursorBus.get().inspect) { setState('inspect', 'inspect'); return; }
      const labelled = target?.closest<HTMLElement>('[data-cursor]');
      if (mode === 'full' && labelled) { setState('label', labelled.dataset.cursor ?? ''); return; }
      const hit = target?.closest('a, button, summary, [role="button"], [role="tab"], input, select, textarea, label');
      setState(hit ? 'hover' : 'default');
    };

    const releaseMagnet = () => {
      if (magnet) { magnet.style.transform = ''; magnet = null; }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      x = e.clientX; y = e.clientY;
      if (!seen) { rx = x; ry = y; seen = true; ring.style.opacity = '1'; if (dot) dot.style.opacity = '1'; }
      const target = e.target as Element | null;
      update(target);
      if (mode !== 'full') return;
      const m = target?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (m !== magnet) releaseMagnet();
      if (m) {
        magnet = m;
        const r = m.getBoundingClientRect();
        const dx = (x - (r.left + r.width / 2)) * 0.28, dy = (y - (r.top + r.height / 2)) * 0.32;
        m.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      }
    };

    const onDown = () => ring.classList.add('cur-pressed');
    const onUp = () => ring.classList.remove('cur-pressed');
    const onLeave = () => { ring.style.opacity = '0'; if (dot) dot.style.opacity = '0'; seen = false; releaseMagnet(); };
    const unsub = cursorBus.subscribe(() => update(document.elementFromPoint(x, y)));

    // The loop only runs while the ring is catching up; it sleeps when the pointer is still.
    let last = 0;
    const tick = (now: number) => {
      // ~0.16 per frame at 60 fps, the same feel at any frame rate.
      const k = 1 - Math.pow(0.84, Math.min(now - (last || now - 16.67), 100) / 16.67);
      last = now;
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
      ringPos.x = rx; ringPos.y = ry;
      if (dot) dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.15) raf = requestAnimationFrame(tick);
      else { raf = 0; last = 0; }
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('pointermove', wake, { passive: true });

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', wake);
      unsub();
      releaseMagnet();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      root.classList.remove('cur-hide', 'cur-on');
    };
  }, [mode]);

  return (
    <div className={`cur cur-mode-${mode}`} aria-hidden="true">
      <div ref={ringRef} className="cur-ring" data-state="default"
        style={{ ['--lens' as string]: `${cursorBus.get().lensRadius * 2}px` }}>
        <span ref={labelRef} className="cur-label" />
      </div>
      {mode === 'full' && <div ref={dotRef} className="cur-dot" />}
    </div>
  );
}
