import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { story } from './story';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface Refs {
  root: RefObject<HTMLElement>;
  storyEl: RefObject<HTMLElement>;
  header: RefObject<HTMLElement>;
}

/**
 * Smooth scroll, the master scroll timeline and the text reveals.
 * With reduced motion none of this runs: native scroll, no scroll-driven camera, text just shows.
 */
export function useLandingMotion({ root, storyEl, header }: Refs, enabled: boolean, loaded: boolean) {
  // Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({ autoRaf: false, anchors: { offset: -64 }, lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    // Exposed so the end-to-end test can scroll through Lenis instead of fighting it.
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); };
  }, [enabled]);

  // The master timeline: one scrubbed timeline over the story drives the camera, the objects and uniforms.
  useEffect(() => {
    const el = storyEl.current, hd = header.current;
    if (!el || !hd) return;
    const ctx = gsap.context(() => {
      // The top bar switches to its dark style while it sits over the 3D story.
      ScrollTrigger.create({
        trigger: el, start: 'top top', end: 'bottom top+=58',
        onToggle: (self) => hd.classList.toggle('on-dark', self.isActive),
      });
      hd.classList.add('on-dark');
      if (!enabled) return;

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
      })
        .to(story, { p: 5, duration: 5 }, 0)
        // 1 · the box cracks: push in, flash the glass and the lens colour split
        .to(story, { camZ: 8.3, camX: 0.7, duration: 1 }, 0)
        .to(story, { aberration: 0.0045, duration: 0.3, ease: 'power2.in' }, 0.4)
        .to(story, { aberration: 0.00015, duration: 0.5, ease: 'power2.out' }, 0.7)
        // 2–3 · pull back to see the row of flow nodes and the lines between them
        .to(story, { camZ: 10.6, camX: 0.95, camY: 0.25, duration: 1 }, 1)
        .to(story, { camZ: 10.1, camX: 0.95, duration: 1 }, 2)
        // 4 · close in on the slide deck
        .to(story, { camZ: 8.4, camX: 1.35, camY: 0, duration: 1 }, 3)
        // 5 · back to the hero framing for the call to action
        .to(story, { camZ: 9, camX: 0, duration: 1 }, 4);
    }, root);
    return () => ctx.revert();
  }, [enabled, root, storyEl, header]);

  // Text reveals: headings split into words, copy fades up. The hero waits for the loader.
  useEffect(() => {
    const r = root.current;
    if (!enabled || !loaded || !r) return;
    const ctx = gsap.context(() => {
      r.querySelectorAll<HTMLElement>('[data-split]').forEach((h) => {
        const hero = h.dataset.split === 'hero';
        SplitText.create(h, {
          type: 'words,lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => gsap.from(self.words, {
            yPercent: 110, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.035,
            delay: hero ? 0.1 : 0,
            scrollTrigger: hero ? undefined : { trigger: h, start: 'top 82%', once: true },
          }),
        });
      });
      r.querySelectorAll<HTMLElement>('[data-rise]').forEach((el) => {
        gsap.from(el, {
          y: 26, opacity: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        });
      });
    }, root);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [enabled, loaded, root]);
}

/** A short wipe into the app instead of a hard cut. */
export function wipeTo(href: string) {
  const wipe = document.querySelector<HTMLElement>('.wipe');
  if (!wipe) { window.location.assign(href); return; }
  wipe.classList.add('wipe-on');
  window.setTimeout(() => window.location.assign(href), 600);
}
