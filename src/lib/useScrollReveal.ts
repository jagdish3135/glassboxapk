import { useEffect, type RefObject } from 'react';

/** Adds `.in` to every `.sr` element inside `root` the first time it scrolls into view. */
export function useScrollReveal(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('.sr'));
    if (!('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}
