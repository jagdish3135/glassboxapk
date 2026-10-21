// Captures the README media from a running viewer (npm run view): screenshots, two demo videos
// (MP4 + animated WebP + GIF fallback) and page previews of the PDF export. Uses only the
// fictional FoodDash sample, so nothing from your own reports/ ends up in the README.
// Usage: node docs/readme/capture.mjs [shots,video,pdf] [baseUrl]   (needs ffmpeg on PATH)
// The sample exports (fooddash-deck.pptx, fooddash-report.pdf) come from npm test (test/out/);
// the slide previews (slide-*.jpg) are exported from that deck with PowerPoint.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ONLY = (process.argv[2] ?? 'shots,video,pdf').split(',');
const BASE = (process.argv[3] ?? 'http://localhost:5173').replace(/\/$/, '');
const browser = await chromium.launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

// Only the sample shows up in the "Your reports" list, whatever is in your reports/ folder.
const SAMPLE_LIST = [{ name: 'fooddash', appName: 'FoodDash', packageName: 'com.fooddash.app', versionName: '4.12.0', flows: 8, steps: 83, updated: Date.now() - 120_000, ok: true, errors: 0 }];
async function newPage(ctx) {
  const page = await ctx.newPage();
  await page.route('**/__reports/', (r) => r.fulfill({ json: SAMPLE_LIST }));
  return page;
}

// ---------- Screenshots
if (ONLY.includes('shots')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  const page = await newPage(ctx);
  // Scroll so an element starts just under the sticky top bar.
  const scrollBelowBar = (sel) => page.evaluate((sel) => {
    const bar = document.querySelector('.topbar').getBoundingClientRect().height;
    window.scrollTo(0, window.scrollY + document.querySelector(sel).getBoundingClientRect().top - bar - 24);
  }, sel);
  const shot = async (name, opts = {}) => { await page.screenshot({ path: join(here, `${name}.jpg`), type: 'jpeg', quality: 86, ...opts }); console.log('✓', name); };

  await page.goto(`${BASE}/`);
  await wait(12_000); // let the hero session type out and the browser window open
  await shot('landing');

  await page.goto(`${BASE}/app.html#/report/fooddash/flows/order`);
  await wait(1200);
  await shot('report-header', { clip: { x: 0, y: 0, width: 1280, height: 420 } });
  await scrollBelowBar('.flow-head');
  await wait(9000); // a few steps into the flow
  await shot('flow-player');

  await page.goto(`${BASE}/app.html#/report/fooddash/map`);
  await wait(1500);
  await page.locator('.stage').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -110));
  await page.locator('.node-click', { hasText: 'Repositories' }).click();
  await wait(1200);
  await shot('system-map');

  await page.goto(`${BASE}/app.html#/report/fooddash/overview`);
  await wait(2500);
  await scrollBelowBar('.overview');
  await wait(800);
  await shot('overview');
  await ctx.close();
}

// ---------- Videos: record the page, crop to one element, encode MP4 + WebP + GIF
async function record(name, url, selector, seconds, prepare, size = { width: 1280, height: 800 }) {
  const tmp = join(here, '.tmp-video');
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size }, reducedMotion: 'no-preference' });
  const page = await newPage(ctx);
  const t0 = Date.now();
  await page.goto(url);
  // The film grain is static noise that bloats animated WebP/GIF; the videos look the same without it.
  await page.addStyleTag({ content: '.grain { display: none !important; }' });
  await prepare?.(page);
  const startAt = (Date.now() - t0) / 1000;
  const box = await page.locator(selector).boundingBox();
  await wait(seconds * 1000);
  await ctx.close();
  const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')));
  const even = (n) => Math.floor(n / 2) * 2;
  const crop = `crop=${even(box.width)}:${even(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  const out = (ext) => join(here, `${name}.${ext}`);
  ffmpeg('-ss', String(startAt), '-i', webm, '-t', String(seconds), '-vf', `${crop},fps=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out('mp4'));
  ffmpeg('-i', out('mp4'), '-vf', 'fps=20,scale=900:-2:flags=lanczos', '-c:v', 'libwebp_anim', '-loop', '0', '-q:v', '75', '-an', out('webp'));
  ffmpeg('-i', out('mp4'), '-vf', 'fps=10,scale=640:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', out('gif'));
  rmSync(tmp, { recursive: true, force: true });
  console.log('✓', name, `(${seconds}s)`);
}

if (ONLY.includes('video')) {
  // 1. The hero: an agent session in the terminal, then the report opening in the browser.
  await record('demo', `${BASE}/`, '.hdemo', 24, async (page) => { await page.locator('.hdemo').waitFor(); });
  // 2. The explainer itself: one flow played step by step in the viewer.
  await record('flow', `${BASE}/app.html#/report/fooddash/flows/refresh`, '.player', 22, async (page) => {
    await page.locator('.player').waitFor();
    await page.evaluate(() => {
      const bar = document.querySelector('.topbar').getBoundingClientRect().height;
      window.scrollTo(0, window.scrollY + document.querySelector('.player').getBoundingClientRect().top - bar - 16);
    });
    await page.locator('button[aria-label="Restart flow"]').click();
  }, { width: 1280, height: 1000 });
}

// ---------- PDF export previews (rendered with pdf.js)
if (ONLY.includes('pdf')) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app.html`);
  for (const n of [1, 6]) {
    const data = await page.evaluate(async ({ n, src }) => {
      const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument(src).promise;
      const pg = await doc.getPage(n);
      const vp = pg.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      return c.toDataURL('image/png');
    }, { n, src: `${BASE}/docs/readme/fooddash-report.pdf` });
    const png = join(here, `.pdf-${n}.png`);
    writeFileSync(png, Buffer.from(data.split(',')[1], 'base64'));
    ffmpeg('-i', png, '-vf', 'scale=900:-2', '-q:v', '3', join(here, `pdf-page-${n}.jpg`));
    rmSync(png);
    console.log('✓ pdf page', n);
  }
  await ctx.close();
}

await browser.close();
