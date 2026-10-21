// Folder layout shared by the scripts and the dev-server plugin.
import { basename } from 'node:path';

export const APKS_DIR = 'apks';       // put APKs here (the files themselves are gitignored)
export const REPORTS_DIR = 'reports'; // reports/<name>.json, read by the viewer (gitignored)
export const WORK_DIR = 'work';       // work/<name>/ holds jadx output (gitignored, never shown or exported)

/** apks/FoodDash-4.12.apk → "fooddash-4-12". The name is the report file name and the URL segment. */
export function reportName(apkPath: string): string {
  return basename(apkPath).replace(/\.(apk|json)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
}

export const REPORT_NAME = /^[a-z0-9][a-z0-9-]*$/;
