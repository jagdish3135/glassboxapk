import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import type { Report, ScanStage, WorkerMessage } from '../types';
import { Icon } from './Icon';

const STAGES: { id: ScanStage; label: string }[] = [
  { id: 'unzip', label: 'Opening the package' },
  { id: 'manifest', label: 'Reading AndroidManifest.xml' },
  { id: 'dex', label: 'Reading compiled classes' },
  { id: 'sdks', label: 'Matching SDK signatures' },
  { id: 'endpoints', label: 'Finding hosts and API paths' },
  { id: 'map', label: 'Drawing the system map' },
];

const MAX_BYTES = 400 * 1048576;

interface Props {
  onReport: (r: Report) => void;
  onSample: () => void;
  onBusy?: (busy: boolean) => void;
}

export function Dropzone({ onReport, onSample, onBusy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ScanStage | null>(null);
  const [detail, setDetail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { onBusy?.(stage !== null); }, [stage, onBusy]);

  // Size the dashed-border rect to the box (attributes, so it works in every browser).
  const dropRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  useLayoutEffect(() => {
    const el = dropRef.current, rect = rectRef.current;
    if (!el || !rect) return;
    const fit = () => {
      rect.setAttribute('width', String(Math.max(0, el.offsetWidth - 2)));
      rect.setAttribute('height', String(Math.max(0, el.offsetHeight - 2)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  const start = (f: File) => {
    setError(null);
    if (!/\.apk$/i.test(f.name)) { setError('That isn’t an .apk file. Pick an Android APK (AAB bundles aren’t supported yet).'); return; }
    if (f.size > MAX_BYTES) { setError('That APK is over 400 MB, which is more than the browser scan can hold in memory.'); return; }
    setFile(f);
    setStage('unzip');
    const worker = new Worker(new URL('../lib/apk/scan.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.type === 'progress') { setStage(m.stage); setDetail(m.detail ?? ''); }
      else if (m.type === 'done') { worker.terminate(); setStage(null); onReport(m.report); }
      else { worker.terminate(); setStage(null); setFile(null); setError(`Couldn’t read this APK: ${m.message}`); }
    };
    worker.onerror = (ev) => { worker.terminate(); setStage(null); setFile(null); setError(`The scan crashed: ${ev.message || 'unknown error'}`); };
    worker.postMessage(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) start(f);
  };

  if (stage && file) {
    const at = STAGES.findIndex((s) => s.id === stage);
    return (
      <div className="drop drop-scanning" role="status" aria-live="polite">
        <div className="scanbeam" aria-hidden="true" />
        <p className="eyebrow">Scanning in your browser</p>
        <p className="scan-file mono">{file.name}</p>
        <ol className="scan-stages">
          {STAGES.map((s, i) => (
            <li key={s.id} className={i < at ? 'done' : i === at ? 'now' : ''}>
              <span className="scan-mark">{i < at ? <Icon name="check" size={13} /> : String(i + 1).padStart(2, '0')}</span>
              {s.label}
              {i === at && detail && <span className="scan-detail mono">{detail}</span>}
            </li>
          ))}
        </ol>
        <span className="scan-rail" aria-hidden="true"><i style={{ width: `${((at + 1) / STAGES.length) * 100}%` }} /></span>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={dropRef}
        className={`drop${over ? ' drop-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
        aria-label="Choose an APK file to scan"
      >
        <svg className="drop-ants" aria-hidden="true"><rect ref={rectRef} x="1" y="1" rx="17" ry="17" /></svg>
        <span className="drop-icon"><Icon name="upload" size={22} /></span>
        <span className="drop-title">Drop an <b>.apk</b> here</span>
        <span className="drop-sub">or <u>browse your files</u></span>
        <span className="drop-note"><Icon name="lock" size={13} /> Scanned on your device. The file is never uploaded.</span>
        <input ref={input} type="file" accept=".apk,application/vnd.android.package-archive" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) start(f); e.target.value = ''; }} />
      </div>
      {error && <p className="drop-error" role="alert">{error}</p>}
      <button className="sample-link" onClick={onSample}>No APK to hand? Open the sample report <Icon name="arrow" size={14} /></button>
    </div>
  );
}
