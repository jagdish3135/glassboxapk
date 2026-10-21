import { useEffect, useRef } from 'react';

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'];

/** The brand object: a glass box with an APK core and data moving through it. CSS 3D only.
 *  It leans toward a fine pointer, and spins up while a scan is running (`busy`). */
export function GlassCube({ busy = false }: { busy?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scene.current;
    if (!el || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty('--tilt-y', `${(dx * 22).toFixed(2)}deg`);
        el.style.setProperty('--tilt-x', `${(-dy * 16).toFixed(2)}deg`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={scene} className={`cube-scene${busy ? ' cube-busy' : ''}`} aria-hidden="true">
      <div className="cube-anno a1"><span>AndroidManifest.xml</span></div>
      <div className="cube-anno a2"><span>classes.dex</span></div>
      <div className="cube-anno a3"><span>lib/arm64-v8a</span></div>
      <div className="cube-anno a4"><span>resources.arsc</span></div>
      <div className="cube-tilt">
        <div className="cube-boost">
          <div className="cube-spin">
            <div className="cube">
              {FACES.map((f) => <div key={f} className={`face face-${f}`} />)}
              <div className="core">
                {FACES.map((f) => <div key={f} className={`cface cface-${f}`} />)}
              </div>
              <div className="orbit o1"><i /></div>
              <div className="orbit o2"><i /></div>
              <div className="orbit o3"><i /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="cube-shadow" />
    </div>
  );
}
