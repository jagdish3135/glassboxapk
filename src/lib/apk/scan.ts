import JSZip from 'jszip';
import { parseAxml, findAll, child, type XmlNode } from './axml';
import { readDex } from './dex';
import { SDK_SIGNATURES, NOISE_HOSTS, PERMISSIONS } from './signatures';
import type {
  ArchNode, Architecture, EntryPoint, Permission, Report, ScanStage, Sdk, SizePart, StackInfo,
} from '../../types';

type Progress = (stage: ScanStage, detail?: string) => void;

const A = (n: XmlNode, k: string) => n.attrs[k] ?? '';

function fullName(pkg: string, name: string) {
  if (!name) return '';
  return name.startsWith('.') ? pkg + name : name.includes('.') ? name : `${pkg}.${name}`;
}

const shortClass = (name: string) => name.split('.').pop() ?? name;
/** android.intent.action.BOOT_COMPLETED → BOOT_COMPLETED, but keep custom actions like "pushy.me" whole. */
const actionLabel = (action: string) => (/^[A-Z0-9_]+$/.test(shortClass(action)) ? shortClass(action) : action);

function filterActions(f: XmlNode) {
  return f.children.filter((c) => c.tag === 'action').map((c) => A(c, 'name'));
}
function filterCategories(f: XmlNode) {
  return f.children.filter((c) => c.tag === 'category').map((c) => A(c, 'name'));
}

function prettyApp(pkg: string, label: string, fileName: string) {
  if (label && !label.startsWith('@')) return label;
  const parts = pkg.split('.').filter((p) => !['com', 'org', 'net', 'in', 'io', 'app', 'android', 'co', 'mobile'].includes(p));
  const pick = parts[0] ?? fileName.replace(/\.apk$/i, '');
  return pick.charAt(0).toUpperCase() + pick.slice(1);
}

function hostOf(url: string): string | null {
  const m = /^https?:\/\/([^/:?#\s"'{}]+)/i.exec(url);
  if (!m) return null;
  const h = m[1].toLowerCase();
  // Real hostnames only: no regex fragments like "(.*)", and no Java names like "javax.xml.XMLConstants".
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(h)) return null;
  if (/^(java|javax|android|androidx|kotlin|dalvik)\./.test(h)) return null;
  return h;
}

const isNoise = (h: string) => NOISE_HOSTS.some((n) => h === n || h.endsWith('.' + n));

export async function scanApk(file: File, progress: Progress): Promise<Report> {
  const t0 = performance.now();
  progress('unzip', `${(file.size / 1048576).toFixed(1)} MB`);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files);

  // ---- Manifest
  progress('manifest');
  const mf = zip.file('AndroidManifest.xml');
  if (!mf) throw new Error('No AndroidManifest.xml found. Is this really an APK? (AAB bundles are not supported yet.)');
  const manifest = parseAxml(await mf.async('arraybuffer'));
  const pkg = A(manifest, 'package');
  const sdkNode = child(manifest, 'uses-sdk');
  const appNode = child(manifest, 'application') ?? { tag: 'application', attrs: {}, children: [] };

  const activities = [...findAll(appNode, 'activity'), ...findAll(appNode, 'activity-alias')];
  const services = findAll(appNode, 'service');
  const receivers = findAll(appNode, 'receiver');
  const providers = findAll(appNode, 'provider');

  const permissions: Permission[] = findAll(manifest, 'uses-permission')
    .map((n) => A(n, 'name'))
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((name): Permission => {
      const short = shortClass(name);
      const known = name.startsWith('android.permission.') ? PERMISSIONS[short] : undefined;
      return { name, short, risk: known?.risk ?? 'normal', why: known?.why };
    })
    .sort((a, b) => rank(a.risk) - rank(b.risk) || a.short.localeCompare(b.short));

  const entryPoints: EntryPoint[] = [];
  for (const act of activities) {
    const target = fullName(pkg, A(act, 'targetActivity') || A(act, 'name'));
    for (const f of act.children.filter((c) => c.tag === 'intent-filter')) {
      const actions = filterActions(f);
      const cats = filterCategories(f);
      if (actions.includes('android.intent.action.MAIN') && cats.includes('android.intent.category.LAUNCHER')) {
        entryPoints.push({ kind: 'launcher', target, detail: 'Opens when the user taps the app icon' });
      }
      if (actions.includes('android.intent.action.VIEW') && cats.includes('android.intent.category.BROWSABLE')) {
        const data = f.children.filter((c) => c.tag === 'data');
        const schemes = data.map((d) => A(d, 'scheme')).filter(Boolean);
        const hosts = data.map((d) => A(d, 'host')).filter(Boolean);
        const paths = data.map((d) => A(d, 'path') || A(d, 'pathPrefix') || A(d, 'pathPattern')).filter(Boolean);
        const uri = `${schemes[0] ?? '*'}://${hosts[0] ?? '*'}${paths[0] ?? ''}`;
        entryPoints.push({ kind: 'deep link', target, detail: uri + (hosts.length > 1 ? ` (+${hosts.length - 1} hosts)` : '') });
      }
    }
  }
  for (const s of services) {
    const actions = s.children.filter((c) => c.tag === 'intent-filter').flatMap(filterActions);
    const name = fullName(pkg, A(s, 'name'));
    // Firebase registers its own base service too; only the app's subclass is an entry point.
    if (actions.includes('com.google.firebase.MESSAGING_EVENT')) {
      if (name.startsWith('com.google.firebase.')) continue;
      entryPoints.push({ kind: 'push', target: name, detail: 'Handles incoming push messages (FCM)' });
    } else if (A(s, 'exported') === 'true' && name.startsWith(pkg)) {
      entryPoints.push({ kind: 'exported', target: name, detail: 'Service other apps can start' });
    }
  }
  for (const r of receivers) {
    const name = fullName(pkg, A(r, 'name'));
    if (!name.startsWith(pkg)) continue;
    const actions = r.children.filter((c) => c.tag === 'intent-filter').flatMap(filterActions);
    if (actions.length) entryPoints.push({ kind: 'receiver', target: name, detail: actions.map(actionLabel).slice(0, 3).join(', ') });
  }
  for (const p of providers) {
    const name = fullName(pkg, A(p, 'name'));
    if (A(p, 'exported') === 'true') entryPoints.push({ kind: 'provider', target: name, detail: `Exported content provider: ${A(p, 'authorities')}` });
  }

  // ---- DEX
  const dexFiles = names.filter((n) => /^classes\d*\.dex$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const classes: string[] = [];
  const urls: string[] = [];
  const apiPaths: string[] = [];
  for (const d of dexFiles) {
    progress('dex', d);
    try {
      const facts = readDex(await zip.file(d)!.async('arraybuffer'));
      classes.push(...facts.classes);
      urls.push(...facts.urls);
      apiPaths.push(...facts.apiPaths);
    } catch {
      /* skip unreadable dex */
    }
  }

  // ---- SDKs
  progress('sdks', `${classes.length.toLocaleString()} classes`);
  const sdks: Sdk[] = [];
  const seen = new Set<string>();
  for (const [name, category, prefix] of SDK_SIGNATURES) {
    if (seen.has(name)) continue;
    const hit = classes.find((c) => c.startsWith(prefix));
    if (hit) {
      seen.add(name);
      sdks.push({ name, category, evidence: hit.slice(1).replace(/;$/, '').replace(/\//g, '.') });
    }
  }

  // ---- Stack
  const stack = detectStack(names, classes, sdks);

  // ---- Endpoints
  progress('endpoints', `${urls.length.toLocaleString()} URL strings`);
  const hostCount = new Map<string, number>();
  for (const u of urls) {
    const h = hostOf(u);
    if (h && !isNoise(h)) hostCount.set(h, (hostCount.get(h) ?? 0) + 1);
  }
  const hosts = [...hostCount.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 16);
  const paths = [...new Set(apiPaths)].sort().slice(0, 40);

  // ---- Size
  const size = sizeBreakdown(zip);

  // ---- Map
  progress('map');
  const label = A(appNode, 'label');
  const report: Report = {
    source: 'scan',
    fileName: file.name,
    app: {
      name: prettyApp(pkg, label, file.name),
      packageName: pkg || 'unknown',
      versionName: A(manifest, 'versionName') || '—',
      versionCode: A(manifest, 'versionCode') || '—',
      minSdk: sdkNode ? A(sdkNode, 'minSdkVersion') || '—' : '—',
      targetSdk: sdkNode ? A(sdkNode, 'targetSdkVersion') || '—' : '—',
      sizeBytes: file.size,
    },
    stack,
    sdks,
    permissions,
    entryPoints,
    components: { activities: activities.length, services: services.length, receivers: receivers.length, providers: providers.length },
    size,
    hosts,
    apiPaths: paths,
    architecture: { columns: [], nodes: [] },
    flows: [],
  };
  report.architecture = buildArchitecture(report);
  report.scanMs = Math.round(performance.now() - t0);
  return report;
}

function rank(r: Permission['risk']) {
  return r === 'special' ? 0 : r === 'dangerous' ? 1 : 2;
}

function detectStack(names: string[], classes: string[], sdks: Sdk[]): StackInfo {
  const has = (re: RegExp) => names.some((n) => re.test(n));
  const abis = [...new Set(names.filter((n) => n.startsWith('lib/')).map((n) => n.split('/')[1]).filter(Boolean))];
  const signals: string[] = [];
  const kotlin = classes.some((c) => c.startsWith('Lkotlin/')) || has(/\.kotlin_module$/);
  const compose = sdks.some((s) => s.name === 'Jetpack Compose');

  if (has(/^lib\/[^/]+\/libflutter\.so$/) || has(/^assets\/flutter_assets\//)) {
    signals.push('libflutter.so (Flutter engine)');
    if (has(/libapp\.so$/)) signals.push('libapp.so (compiled Dart code)');
    return { primary: 'Flutter', language: 'Dart', signals, abis };
  }
  if (has(/^assets\/index\.android\.bundle$/) || has(/libreactnativejni\.so$/) || has(/libreactnative\.so$/)) {
    const hermes = has(/libhermes\.so$/);
    signals.push('index.android.bundle (JavaScript bundle)');
    if (hermes) signals.push('libhermes.so (Hermes engine, bytecode)');
    return { primary: hermes ? 'React Native (Hermes)' : 'React Native', language: 'JavaScript / TypeScript', signals, abis };
  }
  if (has(/libunity\.so$/) || has(/^assets\/bin\/Data\//)) {
    signals.push('libunity.so (Unity runtime)');
    if (has(/libil2cpp\.so$/)) signals.push('libil2cpp.so (IL2CPP compiled C#)');
    return { primary: 'Unity', language: 'C#', signals, abis };
  }
  if (has(/libmonodroid\.so$/) || has(/libmonosgen/) || has(/^assemblies\//)) {
    signals.push('Mono runtime and .NET assemblies');
    return { primary: 'Xamarin / .NET MAUI', language: 'C#', signals, abis };
  }
  if (has(/^assets\/public\/index\.html$/)) {
    signals.push('assets/public/index.html (Capacitor web app)');
    return { primary: 'Capacitor / Ionic', language: 'JavaScript / TypeScript', signals, abis };
  }
  if (has(/^assets\/www\/index\.html$/)) {
    signals.push('assets/www/index.html (Cordova web app)');
    return { primary: 'Cordova', language: 'JavaScript', signals, abis };
  }
  if (kotlin) signals.push('Kotlin standard library');
  if (compose) signals.push('Jetpack Compose UI');
  if (abis.length) signals.push(`Native libraries for ${abis.join(', ')}`);
  return {
    primary: compose ? 'Native Android (Compose)' : 'Native Android',
    language: kotlin ? 'Kotlin' : 'Java',
    signals: signals.length ? signals : ['DEX bytecode only'],
    abis,
  };
}

function sizeBreakdown(zip: JSZip): SizePart[] {
  const buckets: Record<string, number> = { Code: 0, 'Native libraries': 0, Resources: 0, Assets: 0, Other: 0 };
  zip.forEach((path, f) => {
    if (f.dir) return;
    // JSZip keeps the compressed size on a private field; it reflects the download size.
    const data = (f as unknown as { _data?: { compressedSize?: number } })._data;
    const bytes = data?.compressedSize ?? 0;
    if (/^classes\d*\.dex$/.test(path)) buckets.Code += bytes;
    else if (path.startsWith('lib/')) buckets['Native libraries'] += bytes;
    else if (path.startsWith('res/') || path === 'resources.arsc') buckets.Resources += bytes;
    else if (path.startsWith('assets/')) buckets.Assets += bytes;
    else buckets.Other += bytes;
  });
  return Object.entries(buckets).map(([label, bytes]) => ({ label, bytes })).filter((p) => p.bytes > 0);
}

/** Diagram boxes are narrow; these keep the common long SDK names readable. */
const SHORT_NAMES: Record<string, string> = {
  'Firebase Cloud Messaging': 'Firebase FCM',
  'Firebase Realtime Database': 'Firebase RTDB',
  'Firebase Remote Config': 'Remote Config',
  'Firebase Crashlytics': 'Crashlytics',
  'Firebase Performance': 'Firebase Perf',
  'Google Mobile Ads': 'Google Ads',
  'Microsoft Clarity': 'MS Clarity',
};

const THIRD_PARTY_ORDER = ['Payments', 'Backend services', 'Push and messaging', 'Analytics', 'Attribution', 'Crash and monitoring', 'Ads', 'Auth and identity', 'Maps and location', 'Support and engagement'];

function buildArchitecture(r: Report): Architecture {
  const nodes: ArchNode[] = [];
  const links: { from: string; to: string }[] = [];
  const has = (name: string) => r.sdks.some((s) => s.name === name);
  const cat = (c: string) => r.sdks.filter((s) => s.category === c);

  // Column 0: how the app gets started.
  const launcher = r.entryPoints.find((e) => e.kind === 'launcher');
  const deep = r.entryPoints.filter((e) => e.kind === 'deep link');
  const push = r.entryPoints.find((e) => e.kind === 'push');
  const recv = r.entryPoints.filter((e) => e.kind === 'receiver');
  const c0: ArchNode[] = [];
  c0.push({ id: 'e-launch', label: 'App icon', sub: launcher ? shortClass(launcher.target) : 'Launcher', col: 0, row: 0 });
  if (deep.length) c0.push({ id: 'e-deep', label: 'Deep links', sub: `${deep.length} intent filter${deep.length > 1 ? 's' : ''}`, col: 0, row: 0 });
  if (push) c0.push({ id: 'e-push', label: 'Push message', sub: shortClass(push.target), col: 0, row: 0 });
  if (recv.length) c0.push({ id: 'e-bg', label: 'System events', sub: `${recv.length} receiver${recv.length > 1 ? 's' : ''}`, col: 0, row: 0 });
  c0.forEach((n, i) => nodes.push({ ...n, row: i }));

  // Column 1: the app's own layers, shaped by the stack.
  const p = r.stack.primary;
  let layers: [string, string, string][];
  if (p.startsWith('Flutter')) layers = [['a-ui', 'Flutter UI', 'Widgets (Dart)'], ['a-logic', 'Dart app code', 'libapp.so'], ['a-chan', 'Platform channels', 'Native plugins']];
  else if (p.startsWith('React Native')) layers = [['a-ui', 'React UI', 'JS bundle'], ['a-logic', 'JS app logic', p.includes('Hermes') ? 'Hermes bytecode' : 'index.android.bundle'], ['a-chan', 'Native modules', 'RN bridge']];
  else if (p === 'Unity') layers = [['a-ui', 'Unity scenes', 'Game UI'], ['a-logic', 'Game logic', 'C# / IL2CPP']];
  else if (p.startsWith('Xamarin')) layers = [['a-ui', '.NET UI', 'Xamarin / MAUI'], ['a-logic', 'App logic', '.NET assemblies']];
  else if (p === 'Cordova' || p.startsWith('Capacitor')) layers = [['a-ui', 'WebView UI', 'HTML / JS'], ['a-chan', 'Native plugins', 'Bridge']];
  else {
    layers = [['a-ui', has('Jetpack Compose') ? 'Compose screens' : 'Screens', `${r.components.activities} activities`]];
    if (has('Jetpack Lifecycle / ViewModel')) layers.push(['a-logic', 'ViewModels', 'androidx.lifecycle']);
  }
  const net = cat('Networking').filter((s) => !['Gson', 'Moshi', 'Kotlinx Serialization'].includes(s.name));
  if (net.length || r.hosts.length) layers.push(['a-net', 'Network client', net.map((s) => s.name).slice(0, 2).join(' + ') || 'HTTP']);
  const store = cat('Storage');
  if (store.length) layers.push(['a-db', 'Local storage', store.map((s) => s.name).slice(0, 2).join(' + ')]);
  layers.slice(0, 5).forEach(([id, label, sub], i) => nodes.push({ id, label, sub, col: 1, row: i }));

  // Column 2: backend hosts found in the code.
  const hosts = r.hosts.slice(0, 4);
  if (hosts.length) hosts.forEach((h, i) => nodes.push({ id: `b-${i}`, label: h.length > 18 ? '…' + h.slice(-17) : h, sub: 'Host in code', col: 2, row: i }));
  else nodes.push({ id: 'b-none', label: 'No hosts found', sub: 'Maybe built at runtime', col: 2, row: 0 });

  // Column 3: most notable third parties.
  const third = r.sdks
    .filter((s) => THIRD_PARTY_ORDER.includes(s.category))
    .sort((a, b) => THIRD_PARTY_ORDER.indexOf(a.category) - THIRD_PARTY_ORDER.indexOf(b.category))
    .slice(0, 4);
  third.forEach((s, i) => {
    const name = SHORT_NAMES[s.name] ?? s.name;
    nodes.push({ id: `t-${i}`, label: name.length > 17 ? name.slice(0, 16) + '…' : name, sub: s.category, col: 3, row: i });
  });

  // Links: entries → UI, UI → logic → network → hosts, app → third parties.
  const ids = new Set(nodes.map((n) => n.id));
  c0.forEach((n) => links.push({ from: n.id, to: 'a-ui' }));
  const chain = ['a-ui', 'a-logic', 'a-chan'].filter((i) => ids.has(i));
  for (let i = 0; i < chain.length - 1; i++) links.push({ from: chain[i], to: chain[i + 1] });
  const last = chain[chain.length - 1];
  if (ids.has('a-net')) {
    links.push({ from: last, to: 'a-net' });
    hosts.forEach((_, i) => links.push({ from: 'a-net', to: `b-${i}` }));
  }
  if (ids.has('a-db')) links.push({ from: last, to: 'a-db' });
  third.forEach((_, i) => links.push({ from: last, to: `t-${i}` }));

  return {
    columns: ['Entry points', 'Inside the APK', 'Backend hosts (from code)', 'Third parties'],
    nodes,
    links: links.filter((l) => ids.has(l.from) && ids.has(l.to)),
  };
}
