// npm run decompile apks/<file>.apk [--force]
// Checks for Java and jadx, then decompiles the APK into work/<name>/ (gitignored).
// The decompiled code is only for the agent to read. It never goes into a report.
import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WORK_DIR, reportName } from './paths';

const args = process.argv.slice(2);
const apk = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
if (!apk || !/\.apk$/i.test(apk)) { console.error('Usage: npm run decompile apks/<file>.apk [--force]'); process.exit(2); }
if (!existsSync(apk)) { console.error(`✗ ${apk} not found. Put the APK in the apks/ folder first.`); process.exit(1); }

const win = process.platform === 'win32';
// On Windows jadx is a .bat file, which only runs through the shell, so quote paths with spaces.
const q = (s: string) => (win && /[\s&()^]/.test(s) ? `"${s}"` : s);
// With a shell, pass one command string (Node 24 warns when args go to a shell separately).
const spawn = (cmd: string, argv: string[], opts: SpawnSyncOptions) =>
  win ? spawnSync([cmd, ...argv].map(q).join(' '), { ...opts, shell: true }) : spawnSync(cmd, argv, opts);
const run = (cmd: string, argv: string[]) => spawn(cmd, argv, { encoding: 'utf8' }) as SpawnSyncReturns<string>;

// ---- Java
const java = run('java', ['-version']);
if (java.error || java.status !== 0) {
  console.error([
    '✗ Java was not found. jadx needs Java 11 or newer.',
    '  macOS:    brew install openjdk@17',
    '  Windows:  winget install EclipseAdoptium.Temurin.17.JDK',
    "  Linux:    sudo apt install openjdk-17-jre   (or your distro's OpenJDK package)",
    '  Then open a new terminal and run this command again.',
  ].join('\n'));
  process.exit(1);
}
const javaVersion = /version "([^"]+)"/.exec(`${java.stderr}${java.stdout}`)?.[1] ?? 'unknown';

// ---- jadx: $JADX, then tools/jadx/bin, then PATH
const local = resolve('tools/jadx/bin', win ? 'jadx.bat' : 'jadx');
const candidates = [process.env.JADX, existsSync(local) ? local : undefined, 'jadx'].filter(Boolean) as string[];
const jadx = candidates.find((c) => { const r = run(c, ['--version']); return !r.error && r.status === 0; });
if (!jadx) {
  console.error([
    `✗ jadx was not found (Java ${javaVersion} is fine).`,
    '  macOS:    brew install jadx',
    '  Any OS:   download jadx-<version>.zip from https://github.com/skylot/jadx/releases and unzip it',
    '            into tools/jadx/ (so tools/jadx/bin/jadx exists), or add its bin/ folder to PATH,',
    '            or set JADX to the full path of the jadx executable.',
    '  Then run this command again.',
  ].join('\n'));
  process.exit(1);
}
const jadxVersion = run(jadx, ['--version']).stdout.trim();

// ---- Decompile
const name = reportName(apk);
const out = join(WORK_DIR, name);
const hasOutput = () => existsSync(join(out, 'sources')) && readdirSync(join(out, 'sources')).length > 0;
if (hasOutput() && !force) {
  console.log(`✓ Already decompiled: ${out} (pass --force to redo it)`);
} else {
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  console.log(`Decompiling ${apk} with jadx ${jadxVersion} (Java ${javaVersion})…`);
  const r = spawn(jadx, ['-d', out, '--show-bad-code', apk], { stdio: 'inherit' });
  // jadx exits non-zero when a few methods fail to decompile; the rest of the output is still usable.
  if (!hasOutput()) { console.error(`✗ jadx produced no sources (exit code ${r.status}).`); process.exit(1); }
  if (r.status !== 0) console.log('  jadx reported errors for some methods. That is normal; the rest is usable.');
}

// ---- Summary for the agent
let files = 0;
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(java|kt)$/.test(f)) files++;
  }
};
walk(join(out, 'sources'));
const manifest = join(out, 'resources', 'AndroidManifest.xml');
console.log(`✓ ${files.toLocaleString()} source files in ${join(out, 'sources')}`);
console.log(existsSync(manifest) ? `✓ Manifest: ${manifest}` : '  No decoded AndroidManifest.xml (resources may have failed to decode).');
console.log('  Search tools that respect .gitignore may skip work/. If a search finds nothing, pass the folder as an explicit path or use grep -r.');
