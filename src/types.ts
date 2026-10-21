// Enum values live in arrays so the report validator (src/lib/validate.ts) checks the same lists the types use.
export const STEP_KINDS = ['request', 'response', 'storage', 'error'] as const;
export const CONFIDENCES = ['verified', 'inferred'] as const;
export const FLOW_GROUPS = ['happy', 'edge', 'background', 'third-party'] as const;
export const SDK_CATEGORIES = [
  'Analytics', 'Attribution', 'Crash and monitoring', 'Push and messaging', 'Payments', 'Ads', 'Networking', 'Storage',
  'Images and media', 'Architecture', 'UI', 'Maps and location', 'Auth and identity', 'Support and engagement', 'Backend services',
] as const;
export const PERMISSION_RISKS = ['normal', 'dangerous', 'special'] as const;
export const ENTRY_KINDS = ['launcher', 'deep link', 'push', 'receiver', 'service', 'provider', 'exported'] as const;
/** sample = built-in demo data · scan = the in-browser APK scan · agent = written to reports/ by an AI agent */
export const REPORT_SOURCES = ['sample', 'scan', 'agent'] as const;

export type StepKind = (typeof STEP_KINDS)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type FlowGroup = (typeof FLOW_GROUPS)[number];

export interface FlowStep {
  from: string;
  to: string;
  kind: StepKind;
  text: string;
  ref: string;
  confidence: Confidence;
}

export interface Flow {
  id: string;
  name: string;
  group: FlowGroup;
  entry: string;
  goal: string;
  summary: string;
  steps: FlowStep[];
}

export interface ArchNode {
  id: string;
  label: string;
  sub?: string;
  col: number;
  row: number;
}

export interface Architecture {
  columns: string[];
  nodes: ArchNode[];
  /** Static connections drawn on the system map when there are no flows to derive them from. */
  links?: { from: string; to: string }[];
}

export type SdkCategory = (typeof SDK_CATEGORIES)[number];

export interface Sdk {
  name: string;
  category: SdkCategory;
  evidence: string;
}

export interface Permission {
  name: string;
  short: string;
  risk: (typeof PERMISSION_RISKS)[number];
  why?: string;
}

export interface EntryPoint {
  kind: (typeof ENTRY_KINDS)[number];
  target: string;
  detail: string;
}

export interface SizePart {
  label: string;
  bytes: number;
}

export interface StackInfo {
  primary: string;
  language: string;
  signals: string[];
  abis: string[];
}

export interface Report {
  source: (typeof REPORT_SOURCES)[number];
  fileName: string;
  app: {
    name: string;
    packageName: string;
    versionName: string;
    versionCode: string;
    minSdk: string;
    targetSdk: string;
    sizeBytes: number;
  };
  stack: StackInfo;
  sdks: Sdk[];
  permissions: Permission[];
  entryPoints: EntryPoint[];
  components: { activities: number; services: number; receivers: number; providers: number };
  size: SizePart[];
  hosts: string[];
  apiPaths: string[];
  architecture: Architecture;
  flows: Flow[];
  scanMs?: number;
}

export type ScanStage = 'unzip' | 'manifest' | 'dex' | 'sdks' | 'endpoints' | 'map';

export type WorkerMessage =
  | { type: 'progress'; stage: ScanStage; detail?: string }
  | { type: 'done'; report: Report }
  | { type: 'error'; message: string };
