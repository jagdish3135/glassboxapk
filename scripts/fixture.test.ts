// Builds a synthetic APK (real binary AndroidManifest.xml + real DEX layout), scans it
// with the same code the browser worker uses, and checks what comes out.
// Run: npm test   (writes test/fixture.apk for the in-browser drop test too)
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'node:fs';
import { scanApk } from '../src/lib/apk/scan';

// ---------- Binary XML writer ----------
type Attr = [string, string | number | boolean];
interface El { tag: string; attrs?: Attr[]; children?: El[] }

function axml(root: El): Uint8Array {
  const strings: string[] = [];
  const idx = (s: string) => { let i = strings.indexOf(s); if (i < 0) { i = strings.length; strings.push(s); } return i; };
  const walk = (e: El) => { idx(e.tag); e.attrs?.forEach(([k, v]) => { idx(k); if (typeof v === 'string') idx(v); }); e.children?.forEach(walk); };
  walk(root);

  const chunks: number[][] = [];
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);

  // String pool (UTF-16)
  const data: number[] = [];
  const offsets: number[] = [];
  for (const s of strings) {
    offsets.push(data.length);
    u16(data, s.length);
    for (const ch of s) u16(data, ch.charCodeAt(0));
    u16(data, 0);
  }
  while (data.length % 4) data.push(0);
  const pool: number[] = [];
  const poolHeader = 28;
  u16(pool, 0x0001); u16(pool, poolHeader); u32(pool, poolHeader + offsets.length * 4 + data.length);
  u32(pool, strings.length); u32(pool, 0); u32(pool, 0); u32(pool, poolHeader + offsets.length * 4); u32(pool, 0);
  offsets.forEach((o) => u32(pool, o));
  pool.push(...data);
  chunks.push(pool);

  const emit = (e: El) => {
    const attrs = e.attrs ?? [];
    const c: number[] = [];
    u16(c, 0x0102); u16(c, 16); u32(c, 36 + attrs.length * 20); u32(c, 0); u32(c, 0xffffffff);
    u32(c, 0xffffffff); u32(c, idx(e.tag)); u16(c, 20); u16(c, 20); u16(c, attrs.length); u16(c, 0); u16(c, 0); u16(c, 0);
    for (const [k, v] of attrs) {
      u32(c, 0xffffffff); u32(c, idx(k));
      if (typeof v === 'string') { u32(c, idx(v)); u16(c, 8); c.push(0, 0x03); u32(c, idx(v)); }
      else if (typeof v === 'boolean') { u32(c, 0xffffffff); u16(c, 8); c.push(0, 0x12); u32(c, v ? 0xffffffff : 0); }
      else { u32(c, 0xffffffff); u16(c, 8); c.push(0, 0x10); u32(c, v); }
    }
    chunks.push(c);
    e.children?.forEach(emit);
    const end: number[] = [];
    u16(end, 0x0103); u16(end, 16); u32(end, 24); u32(end, 0); u32(end, 0xffffffff); u32(end, 0xffffffff); u32(end, idx(e.tag));
    chunks.push(end);
  };
  emit(root);

  const body = chunks.flat();
  const head: number[] = [];
  u16(head, 0x0003); u16(head, 8); u32(head, 8 + body.length);
  return new Uint8Array([...head, ...body]);
}

// ---------- DEX writer (header + string_ids + type_ids + string data) ----------
function dex(classes: string[], extraStrings: string[]): Uint8Array {
  const all = [...classes, ...extraStrings];
  const enc = new TextEncoder();
  const headerSize = 0x70;
  const stringIdsOff = headerSize;
  const typeIdsOff = stringIdsOff + all.length * 4;
  let dataOff = typeIdsOff + classes.length * 4;
  const data: number[] = [];
  const strOffsets: number[] = [];
  for (const s of all) {
    strOffsets.push(dataOff + data.length);
    let n = s.length;
    do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; data.push(b); } while (n);
    data.push(...enc.encode(s), 0);
  }
  const buf = new Uint8Array(dataOff + data.length);
  const v = new DataView(buf.buffer);
  buf.set(enc.encode('dex\n035\0'), 0);
  v.setUint32(0x38, all.length, true); v.setUint32(0x3c, stringIdsOff, true);
  v.setUint32(0x40, classes.length, true); v.setUint32(0x44, typeIdsOff, true);
  strOffsets.forEach((o, i) => v.setUint32(stringIdsOff + i * 4, o, true));
  classes.forEach((_, i) => v.setUint32(typeIdsOff + i * 4, i, true));
  buf.set(data, dataOff);
  return buf;
}

// ---------- Build the fixture ----------
const manifest = axml({
  tag: 'manifest',
  attrs: [['package', 'com.test.fixture'], ['versionCode', 7], ['versionName', '1.2.3']],
  children: [
    { tag: 'uses-sdk', attrs: [['minSdkVersion', 24], ['targetSdkVersion', 34]] },
    { tag: 'uses-permission', attrs: [['name', 'android.permission.CAMERA']] },
    { tag: 'uses-permission', attrs: [['name', 'android.permission.INTERNET']] },
    { tag: 'uses-permission', attrs: [['name', 'android.permission.QUERY_ALL_PACKAGES']] },
    {
      tag: 'application', attrs: [['label', 'Fixture Shop']],
      children: [
        {
          tag: 'activity', attrs: [['name', '.MainActivity'], ['exported', true]],
          children: [
            { tag: 'intent-filter', children: [
              { tag: 'action', attrs: [['name', 'android.intent.action.MAIN']] },
              { tag: 'category', attrs: [['name', 'android.intent.category.LAUNCHER']] },
            ] },
            { tag: 'intent-filter', children: [
              { tag: 'action', attrs: [['name', 'android.intent.action.VIEW']] },
              { tag: 'category', attrs: [['name', 'android.intent.category.DEFAULT']] },
              { tag: 'category', attrs: [['name', 'android.intent.category.BROWSABLE']] },
              { tag: 'data', attrs: [['scheme', 'fixture'], ['host', 'orders']] },
            ] },
          ],
        },
        { tag: 'activity', attrs: [['name', 'com.test.fixture.ui.CartActivity']] },
        {
          tag: 'service', attrs: [['name', '.push.PushService'], ['exported', false]],
          children: [{ tag: 'intent-filter', children: [{ tag: 'action', attrs: [['name', 'com.google.firebase.MESSAGING_EVENT']] }] }],
        },
        {
          // Firebase's own base service is registered too; it is not an app entry point.
          tag: 'service', attrs: [['name', 'com.google.firebase.messaging.FirebaseMessagingService'], ['exported', false]],
          children: [{ tag: 'intent-filter', children: [{ tag: 'action', attrs: [['name', 'com.google.firebase.MESSAGING_EVENT']] }] }],
        },
        {
          tag: 'receiver', attrs: [['name', '.BootReceiver']],
          children: [{ tag: 'intent-filter', children: [
            { tag: 'action', attrs: [['name', 'android.intent.action.BOOT_COMPLETED']] },
            { tag: 'action', attrs: [['name', 'pushy.me']] },
          ] }],
        },
      ],
    },
  ],
});

const classes = dex(
  ['Lkotlin/Unit;', 'Lretrofit2/Retrofit;', 'Lokhttp3/OkHttpClient;', 'Lcom/stripe/android/PaymentConfiguration;',
   'Landroidx/room/RoomDatabase;', 'Lcom/google/firebase/messaging/FirebaseMessagingService;', 'Landroidx/lifecycle/ViewModel;',
   'Lcom/test/fixture/MainActivity;'],
  ['https://api.fixture.example/v1/', 'https://api.fixture.example/v1/orders', 'https://cdn.fixture.example/img/',
   'http://schemas.android.com/apk/res/android', 'https://www.w3.org/2000/svg',
   'http://javax.xml.XMLConstants/property/accessExternalDTD', 'https://(.*)/path', 'v1/orders/{id}', '/api/v2/cart/items', 'hello world'],
);

const zip = new JSZip();
zip.file('AndroidManifest.xml', manifest);
zip.file('classes.dex', classes);
zip.file('res/layout/activity_main.xml', new Uint8Array(2048));
zip.file('resources.arsc', new Uint8Array(4096));
zip.file('lib/arm64-v8a/libnative.so', new Uint8Array(8192).map((_, i) => i % 251));
zip.file('assets/config.json', '{"ok":true}');
const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

mkdirSync('test', { recursive: true });
writeFileSync('test/fixture.apk', bytes);

// ---------- Scan and check ----------
const stages: string[] = [];
const r = await scanApk(new File([bytes], 'fixture.apk'), (s) => stages.push(s));

let failed = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`);
  if (!ok) failed++;
};
const sdkNames = r.sdks.map((s) => s.name);

check('package name', r.app.packageName === 'com.test.fixture', r.app.packageName);
check('app label', r.app.name === 'Fixture Shop', r.app.name);
check('version name / code', r.app.versionName === '1.2.3' && r.app.versionCode === '7', [r.app.versionName, r.app.versionCode]);
check('min / target SDK', r.app.minSdk === '24' && r.app.targetSdk === '34', [r.app.minSdk, r.app.targetSdk]);
check('permissions risk-sorted', r.permissions.map((p) => `${p.short}:${p.risk}`).join(',') === 'QUERY_ALL_PACKAGES:special,CAMERA:dangerous,INTERNET:normal', r.permissions);
check('component counts', r.components.activities === 2 && r.components.services === 2 && r.components.receivers === 1, r.components);
check('launcher entry', r.entryPoints.some((e) => e.kind === 'launcher' && e.target === 'com.test.fixture.MainActivity'), r.entryPoints);
check('deep link entry', r.entryPoints.some((e) => e.kind === 'deep link' && e.detail === 'fixture://orders'), r.entryPoints);
check('push entry', r.entryPoints.some((e) => e.kind === 'push' && e.target === 'com.test.fixture.push.PushService'), r.entryPoints);
check('boot receiver entry', r.entryPoints.some((e) => e.kind === 'receiver' && e.detail === 'BOOT_COMPLETED, pushy.me'), r.entryPoints);
check('library push service skipped', r.entryPoints.filter((e) => e.kind === 'push').length === 1, r.entryPoints);
check('stack = native Kotlin', r.stack.primary === 'Native Android' && r.stack.language === 'Kotlin', r.stack);
check('ABIs', r.stack.abis.join() === 'arm64-v8a', r.stack.abis);
check('SDKs detected', ['Retrofit', 'OkHttp', 'Stripe', 'Room', 'Firebase Cloud Messaging', 'Jetpack Lifecycle / ViewModel'].every((n) => sdkNames.includes(n)), sdkNames);
check('no false SDKs', !sdkNames.includes('Glide') && !sdkNames.includes('Firebase Analytics'), sdkNames);
check('hosts exclude noise', r.hosts.join() === 'api.fixture.example,cdn.fixture.example', r.hosts);
check('API paths', r.apiPaths.includes('v1/orders/{id}') && r.apiPaths.includes('/api/v2/cart/items') && !r.apiPaths.includes('hello world'), r.apiPaths);
check('size buckets', ['Code', 'Native libraries', 'Resources', 'Assets'].every((l) => r.size.some((p) => p.label === l && p.bytes > 0)), r.size);
check('all stages reported', ['unzip', 'manifest', 'dex', 'sdks', 'endpoints', 'map'].every((s) => stages.includes(s)), stages);
const ids = new Set(r.architecture.nodes.map((n) => n.id));
check('architecture nodes', ['e-launch', 'e-deep', 'e-push', 'e-bg', 'a-ui', 'a-logic', 'a-net', 'a-db', 'b-0', 'b-1'].every((i) => ids.has(i)), [...ids]);
check('architecture links valid', (r.architecture.links ?? []).every((l) => ids.has(l.from) && ids.has(l.to)) && (r.architecture.links?.length ?? 0) > 5, r.architecture.links);
check('stripe in third parties', r.architecture.nodes.some((n) => n.col === 3 && n.label === 'Stripe'), r.architecture.nodes.filter((n) => n.col === 3));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
