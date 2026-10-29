// End-to-end check of the 3D landing page with Playwright (headless Chromium on the GPU).
// Builds the site, serves it with `vite preview`, loads "/", waits for the loader, walks the scroll
// story, checks the cursor, then follows the call to action into the viewer. Also checks the
// reduced-motion poster path.
// Run: npm run test:e2e            (add -- --shots to save screenshots to test/out/landing/)
// Set GL=swiftshader to render on the CPU where there is no GPU (slow; screenshots may time out).
import { build, preview } from 'vite';
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = process.argv.includes('--shots');
const OUT = 'test/out/landing';
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;

let failed = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`);
  if (!ok) failed++;
};

/** Scroll so the story's progress is `p` (0..5), let the scrubbed timeline catch up. */
async function scrollStory(page: Page, p: number) {
  await page.evaluate((pp) => {
    const s = document.querySelector<HTMLElement>('.story')!;
    const top = s.getBoundingClientRect().top + window.scrollY;
    const range = s.offsetHeight - window.innerHeight;
    const y = top + (range * pp) / 5;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, p);
  await page.waitForTimeout(2200);
}

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${OUT}/${name}.png` });
}

await build({ logLevel: 'error' });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const GL = process.env.GL === 'swiftshader'
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: GL });
if (SHOTS) mkdirSync(OUT, { recursive: true });

try {
  for (const vp of [
    { name: 'desktop', width: 1440, height: 900, mobile: false },
    { name: 'mobile', width: 390, height: 844, mobile: true },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const t0 = Date.now();
    await page.goto(`${BASE}/`);
    check(`${vp.name}: headline is in the DOM before the 3D`, await page.locator('h1').count() === 1);
    await page.waitForSelector('.loader', { state: 'detached', timeout: 15000 });
    check(`${vp.name}: loader finishes`, true);
    // The loader caps itself at 3 s, plus its 0.3 s settle and 0.8 s fade-out.
    check(`${vp.name}: loader gone within ~4 s`, Date.now() - t0 < 4500, Date.now() - t0);
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    if (vp.name === 'desktop') console.log(`      (WebGL renderer: ${renderer})`);
    await page.waitForSelector('.l-canvas canvas', { timeout: 15000 });
    await page.waitForTimeout(2500);
    await shot(page, `${vp.name}-1-hero`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${vp.name}: no sideways scroll`, overflow <= 0, overflow);

    if (!vp.mobile) {
      // The cursor: ring + dot, native cursor hidden, "inspect" lens over the glass box.
      check('desktop: custom cursor is on', await page.evaluate(() => document.documentElement.classList.contains('cur-hide')));
      await page.mouse.move(vp.width * 0.68, vp.height * 0.5, { steps: 8 });
      await page.waitForTimeout(700);
      const state = await page.getAttribute('.cur-ring', 'data-state');
      check('desktop: cursor shows "inspect" over the box', state === 'inspect', state);
      await shot(page, 'desktop-1b-inspect');
      // The box and the head inside it turn toward the cursor wherever it is.
      await page.mouse.move(vp.width * 0.08, vp.height * 0.12, { steps: 10 });
      await page.waitForTimeout(1600);
      await shot(page, 'desktop-1c-look-top-left');
      await page.mouse.move(vp.width * 0.97, vp.height * 0.95, { steps: 10 });
      await page.waitForTimeout(1600);
      await shot(page, 'desktop-1d-look-bottom-right');
      await page.mouse.move(vp.width * 0.2, vp.height * 0.85, { steps: 4 });
    } else {
      check('mobile: custom cursor is off on touch', !(await page.evaluate(() => document.documentElement.classList.contains('cur-on'))));
    }

    await scrollStory(page, 1);
    await shot(page, `${vp.name}-2-crack`);
    await scrollStory(page, 2.6);
    await shot(page, `${vp.name}-3-flows`);
    await scrollStory(page, 4.1);
    await shot(page, `${vp.name}-4-deck`);
    await scrollStory(page, 5);
    await shot(page, `${vp.name}-5-cta`);

    // The final panel: a live glass case on desktop (poster on phones), centred, following the cursor.
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.l-final')!;
      const y = el.getBoundingClientRect().top + window.scrollY - (window.innerHeight - el.offsetHeight) / 2;
      const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    });
    await page.waitForTimeout(2500);
    if (!vp.mobile) {
      check('desktop: final panel has the live glass case', await page.locator('.l-final-art .showcase canvas').count() === 1);
      await page.mouse.move(vp.width * 0.1, vp.height * 0.3, { steps: 8 });
      await page.waitForTimeout(1500);
      await shot(page, 'desktop-6-final-left');
      await page.mouse.move(vp.width * 0.98, vp.height * 0.8, { steps: 8 });
      await page.waitForTimeout(1500);
      await shot(page, 'desktop-6-final-right');
    } else {
      check('mobile: final panel shows the poster', await page.locator('.l-final-art img').count() === 1);
      await shot(page, 'mobile-6-final');
    }
    await scrollStory(page, 5);

    // The call to action leads into the viewer.
    await page.click('[data-cta="open-demo"]');
    await page.waitForURL(/app\.html/, { timeout: 8000 });
    await page.waitForSelector('.rhead-name', { timeout: 15000 });
    check(`${vp.name}: call to action opens the viewer`, /app\.html/.test(page.url()), page.url());
    check(`${vp.name}: viewer keeps the native cursor`, !(await page.evaluate(() => document.documentElement.classList.contains('cur-hide'))));

    const real = errors.filter((e) => !/Download the React DevTools/.test(e));
    check(`${vp.name}: no console errors`, real.length === 0, real.slice(0, 3));
    await ctx.close();
  }

  // Reduced motion: poster image, no canvas, no custom cursor.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.waitForSelector('.loader', { state: 'detached', timeout: 8000 });
  check('reduced motion: poster instead of WebGL', await page.locator('.l-poster').count() === 1 && await page.locator('.l-canvas canvas').count() === 0);
  check('reduced motion: custom cursor off', !(await page.evaluate(() => document.documentElement.classList.contains('cur-on'))));
  await shot(page, 'reduced-motion-hero');
  await ctx.close();
} finally {
  await browser.close();
  await new Promise<void>((res) => server.httpServer.close(() => res()));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll landing checks passed');
process.exit(failed ? 1 : 0);
