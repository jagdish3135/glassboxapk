import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../types';
import { validateReport } from './validate';

// Reports written by an agent live in reports/*.json. The local dev server serves them at
// /__reports/ (scripts/reports-plugin.ts); a static deploy has no such endpoint, so the list is empty.

export interface ReportListItem {
  name: string;
  appName: string;
  packageName: string;
  versionName: string;
  flows: number;
  steps: number;
  updated: number;
  ok: boolean;
  errors: number;
}

/** A counter that goes up whenever the dev server says a file in reports/ changed. */
function useReportsTick() {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    hot.on('glassbox:reports', bump);
    return () => hot.off?.('glassbox:reports', bump);
  }, [bump]);
  return tick;
}

/** null = no reports endpoint (static build), [] = endpoint but no reports yet. */
export function useReportList(): ReportListItem[] | null | undefined {
  const [list, setList] = useState<ReportListItem[] | null | undefined>(undefined);
  const tick = useReportsTick();
  useEffect(() => {
    let live = true;
    fetch('/__reports/', { cache: 'no-store' })
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((d) => { if (live) setList(Array.isArray(d) ? d : null); })
      .catch(() => { if (live) setList(null); });
    return () => { live = false; };
  }, [tick]);
  return list;
}

export type LoadedReport =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'invalid'; errors: string[] }
  | { state: 'ok'; report: Report; warnings: string[] };

export function useAgentReport(name: string | null): LoadedReport {
  const [res, setRes] = useState<LoadedReport>({ state: 'loading' });
  const tick = useReportsTick();
  useEffect(() => { setRes({ state: 'loading' }); }, [name]);
  useEffect(() => {
    if (!name) return;
    let live = true;
    fetch(`/__reports/${encodeURIComponent(name)}.json`, { cache: 'no-store' })
      .then(async (r): Promise<LoadedReport> => {
        if (!r.ok || !r.headers.get('content-type')?.includes('json')) return { state: 'missing' };
        let data: unknown;
        try { data = JSON.parse(await r.text()); } catch (e) { return { state: 'invalid', errors: [`Not valid JSON: ${(e as Error).message}`] }; }
        const v = validateReport(data);
        return v.ok ? { state: 'ok', report: data as Report, warnings: v.warnings } : { state: 'invalid', errors: v.errors };
      })
      .catch((): LoadedReport => ({ state: 'missing' }))
      .then((x) => { if (live) setRes(x); });
    return () => { live = false; };
  }, [name, tick]);
  return name ? res : { state: 'missing' };
}
