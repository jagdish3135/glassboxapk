// Writes the README graphics (banner + how-it-works) in light and dark versions.
// Usage: node docs/readme/make-svgs.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const THEMES = {
  light: { bg: '#ece8df', grid: 'rgba(20,20,20,0.07)', ink: '#141414', ink2: '#47443e', ink3: '#8a867c', card: '#f6f3ed', line: 'rgba(20,20,20,0.22)', stage: '#0c1012', node: '#1a2124', nodeLine: '#2e3538', nodeText: '#e9ede9', mute: '#8b9896' },
  dark: { bg: '#0c1012', grid: 'rgba(255,255,255,0.05)', ink: '#e9ede9', ink2: '#b9c2c0', ink3: '#8b9896', card: '#141a1d', line: 'rgba(255,255,255,0.16)', stage: '#141a1d', node: '#1f272a', nodeLine: '#333c3f', nodeText: '#e9ede9', mute: '#8b9896' },
};
const SIGNAL = '#ff5a1f', MINT = '#2fd3a7', VIOLET = '#a493ff', ALARM = '#ff4458';
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";

const grid = (t, w, h) => `<defs><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${t.grid}"/></pattern></defs>
  <rect width="${w}" height="${h}" fill="${t.bg}"/><rect width="${w}" height="${h}" fill="url(#g)"/>`;

const cube = (x, y, s, t) => `<g transform="translate(${x} ${y}) scale(${s / 32})">
    <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="${t.ink === '#141414' ? '#141414' : '#e9ede9'}"/>
    <path d="M16 3 28 9.5 16 16 4 9.5z" fill="${t.ink === '#141414' ? '#2a2f31' : '#b9c2c0'}"/>
    <path d="M16 16v13M16 16 28 9.5M16 16 4 9.5" stroke="#8fa3a6" stroke-width="1" fill="none"/>
    <circle cx="16" cy="16" r="3.2" fill="${SIGNAL}"/></g>`;

function banner(t) {
  const W = 1280, H = 420;
  // Mini system map on the right: 4 columns of boxes, one route lit up with a moving packet.
  const mx = 700, my = 70, cw = 128, gap = 14, nh = 46, rg = 18;
  const cols = [['User', 'Screens', 'System'], ['ViewModels', 'Repositories', 'Storage'], ['API gateway', 'Auth', 'Orders'], ['FCM', 'Stripe', 'Analytics']];
  const lit = new Set(['0,1', '1,0', '1,1', '2,0', '2,1']);
  const box = (c, r) => ({ x: mx + 12 + c * (cw + gap), y: my + 40 + r * (nh + rg), w: cw - 24, h: nh });
  let map = `<rect x="${mx - 16}" y="${my - 16}" width="${4 * cw + 3 * gap + 32}" height="${3 * (nh + rg) + 82}" rx="20" fill="${t.stage}"/>`;
  cols.forEach((names, c) => {
    map += `<rect x="${mx + c * (cw + gap)}" y="${my}" width="${cw}" height="${3 * (nh + rg) + 50}" rx="12" fill="none" stroke="${t.nodeLine}"/>`;
    map += `<text x="${mx + c * (cw + gap) + 12}" y="${my + 24}" font-family="${MONO}" font-size="10" fill="${t.mute}" letter-spacing="1">0${c + 1}</text>`;
    names.forEach((n, r) => {
      const b = box(c, r), on = lit.has(`${c},${r}`);
      map += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9" fill="${t.node}" stroke="${on ? SIGNAL : t.nodeLine}" stroke-width="${on ? 1.6 : 1}" opacity="${on ? 1 : 0.55}"/>`;
      map += `<text x="${b.x + 12}" y="${b.y + 28}" font-family="${SANS}" font-size="13" font-weight="600" fill="${t.nodeText}" opacity="${on ? 1 : 0.5}">${n}</text>`;
    });
  });
  const a = box(0, 1), v = box(1, 0), rp = box(1, 1), gw = box(2, 0), au = box(2, 1);
  const lane1 = a.x + a.w + (gap + 24) / 2, lane2 = rp.x + rp.w + (gap + 24) / 2;
  const route = `M${a.x + a.w} ${a.y + 23} H${lane1} V${v.y + 23} H${v.x} M${v.x + v.w / 2} ${v.y + v.h} V${rp.y} M${rp.x + rp.w} ${rp.y + 23} H${lane2} V${gw.y + 23} H${gw.x} M${gw.x + gw.w / 2} ${gw.y + gw.h} V${au.y}`;
  const travel = `M${a.x + a.w} ${a.y + 23} H${lane1} V${v.y + 23} H${v.x + v.w / 2} V${rp.y + 23} H${lane2} V${gw.y + 23} H${gw.x + gw.w / 2} V${au.y + 23}`;
  map += `<path d="${route}" fill="none" stroke="${SIGNAL}" stroke-width="2" opacity="0.85"/>`;
  map += `<g><circle r="9" fill="${SIGNAL}" opacity="0.3"/><circle r="5" fill="${SIGNAL}"/><circle r="1.8" fill="#fff"/>
    <animateMotion dur="4.5s" repeatCount="indefinite" path="${travel}"/></g>`;
  const chips = [['request', SIGNAL], ['response', MINT], ['storage', VIOLET], ['error', ALARM]];
  const legend = chips.map(([k, c], i) => `<circle cx="${mx + 4 + i * 110}" cy="${my + 270}" r="5" fill="${c}"/><text x="${mx + 16 + i * 110}" y="${my + 274}" font-family="${MONO}" font-size="12" fill="${t.ink3}">${k}</text>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GlassBoxAPK: hand your AI an APK, watch how it works">
  ${grid(t, W, H)}
  ${cube(64, 62, 44, t)}
  <text x="120" y="98" font-family="${SERIF}" font-size="34" fill="${t.ink}">GlassBox</text>
  <rect x="273" y="74" width="50" height="26" rx="5" fill="none" stroke="${t.ink}"/>
  <text x="298" y="92" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${t.ink}" letter-spacing="1.5">APK</text>
  <text x="64" y="190" font-family="${SERIF}" font-size="50" fill="${t.ink}">Hand your AI an APK.</text>
  <text x="64" y="252" font-family="${SERIF}" font-size="50" fill="${t.ink}">Watch how it <tspan fill="${SIGNAL}">works</tspan>.</text>
  <text x="64" y="304" font-family="${SANS}" font-size="18" fill="${t.ink2}">An animated, code-linked system design explainer for Android apps.</text>
  <text x="64" y="332" font-family="${SANS}" font-size="18" fill="${t.ink2}">Works with Claude Code, Codex and Cursor · exports to PPT and PDF.</text>
  ${map}
  ${legend}
</svg>
`;
}

function howItWorks(t) {
  const W = 1280, H = 300, cw = 272, gap = 36, x0 = 40, y0 = 60, ch = 196;
  const steps = [
    ['01', 'Add the repo', ['git clone …/glassboxapk', 'npm install'], 'Runs on your machine'],
    ['02', 'Open your agent', ['claude · codex · cursor'], 'It reads AGENTS.md'],
    ['03', 'Hand it the APK', ['› Analyze apks/app.apk'], 'Decompile · trace · validate'],
    ['04', 'Watch and export', ['localhost:5173/app.html', '#/report/app'], 'Animated flows · PPT · PDF'],
  ];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="How it works: add the repo, open your agent, hand it the APK, watch and export">
  ${grid(t, W, H)}`;
  steps.forEach(([n, title, code, foot], i) => {
    const x = x0 + i * (cw + gap);
    const hot = i === 2;
    s += `<rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="18" fill="${hot ? t.stage : t.card}" stroke="${hot ? t.stage : t.line}"/>
    <text x="${x + 22}" y="${y0 + 38}" font-family="${MONO}" font-size="13" fill="${SIGNAL}" letter-spacing="1">${n}</text>
    <text x="${x + 22}" y="${y0 + 74}" font-family="${SERIF}" font-size="25" fill="${hot ? '#e9ede9' : t.ink}">${title}</text>`;
    code.forEach((c, j) => {
      s += `<text x="${x + 22}" y="${y0 + 112 + j * 22}" font-family="${MONO}" font-size="13.5" fill="${hot ? '#e9ede9' : t.ink2}">${c}</text>`;
    });
    s += `<text x="${x + 22}" y="${y0 + ch - 22}" font-family="${SANS}" font-size="13.5" fill="${hot ? '#8b9896' : t.ink3}">${foot}</text>`;
    if (i < 3) {
      const ax = x + cw + 6, ay = y0 + ch / 2;
      s += `<path d="M${ax} ${ay} h${gap - 14} m-6 -6 l6 6 l-6 6" fill="none" stroke="${t.ink3}" stroke-width="1.6"/>`;
    }
  });
  const travel = `M${x0 + 20} ${y0 - 22} H${x0 + 4 * cw + 3 * gap - 20}`;
  s += `<path d="${travel}" stroke="${t.line}" stroke-dasharray="3 6"/>
  <g><circle r="8" fill="${SIGNAL}" opacity="0.3"/><circle r="4.5" fill="${SIGNAL}"/><animateMotion dur="5s" repeatCount="indefinite" path="${travel}"/></g>
</svg>
`;
  return s;
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(join(here, `banner-${name}.svg`), banner(t));
  writeFileSync(join(here, `how-it-works-${name}.svg`), howItWorks(t));
}
console.log('✓ banner and how-it-works (light + dark)');
