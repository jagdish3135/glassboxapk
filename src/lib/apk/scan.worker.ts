/// <reference lib="webworker" />
import { scanApk } from './scan';
import type { WorkerMessage } from '../../types';

const post = (m: WorkerMessage) => (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<File>) => {
  try {
    const report = await scanApk(e.data, (stage, detail) => post({ type: 'progress', stage, detail }));
    post({ type: 'done', report });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
