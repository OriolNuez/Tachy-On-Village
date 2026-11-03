import { validOutlookProgress, type OutlookAttempt, type OutlookPreview, type OutlookProgress } from './outlook';
import type { Result } from './cadences';

export type JobState = 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPhase = 'starting' | 'browser_ready' | 'extracting' | 'close_browser' | 'closing_browser' | 'merging' | 'cancelling' | 'finished';
export type JobAction = 'ready' | 'close_browser' | 'cancel';
export interface AccountCounts { found: number; exported: number; duplicates: number; errors: number; verifiedEmails?: number; diamond?: number; missingEmails?: number }
export interface MergeCounts { added: number; duplicates: number; total: number; missingEmails?: number; review?: { row: number; name: string; company: string; email: string; reason: string; skipped: boolean }[] }
export interface JobLog { sequence: number; stream: 'stdout' | 'stderr' | 'system'; text: string }
export interface JobSnapshot {
  id: string; tool: 'salesforce' | 'cognism' | 'outlook'; cadence: string; state: JobState; phase: JobPhase;
  processed: number; counts: AccountCounts | null; result: MergeCounts | null;
  outlook?: OutlookProgress;
  logs: JobLog[]; error: string | null; canCancel: boolean;
}
export interface JobsAPI {
  outlookHistory(cadence: string): Promise<Result<OutlookAttempt[]>>;
  previewOutlook(cadence: string, settings?: unknown): Promise<Result<OutlookPreview>>;
  startOutlook(cadence: string, previewToken: string): Promise<Result<JobSnapshot>>;
  startCognism(cadence: string): Promise<Result<JobSnapshot>>;
  startSalesforce(cadence: string): Promise<Result<JobSnapshot>>;
  current(): Promise<Result<JobSnapshot | null>>;
  act(id: string, action: JobAction): Promise<Result<JobSnapshot>>;
  onUpdate(listener: (job: JobSnapshot) => void): () => void;
}
export const jobChannels = {
  outlookHistory: 'jobs:outlook-history', previewOutlook: 'jobs:preview-outlook', startOutlook: 'jobs:start-outlook',
  start: 'jobs:start-salesforce', startCognism: 'jobs:start-cognism', current: 'jobs:current', action: 'jobs:action', update: 'jobs:update',
} as const;

export type WorkerEvent =
  | { v: 1; type: 'outlook_progress' | 'outlook_result'; counts: OutlookProgress }
  | { v: 1; type: 'prompt'; action: 'ready' | 'close_browser' }
  | { v: 1; type: 'progress'; processed: number; counts: AccountCounts }
  | { v: 1; type: 'result'; counts: AccountCounts }
  | { v: 1; type: 'cancelled' }
  | { v: 1; type: 'error'; code: 'dependency' | 'browser' | 'protocol' };

export function isCounts(value: unknown): value is AccountCounts {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (['verifiedEmails', 'diamond', 'missingEmails'].some(key => row[key] !== undefined && (!Number.isSafeInteger(row[key]) || (row[key] as number) < 0 || (row[key] as number) > 1000000))) return false;
  return ['found', 'exported', 'duplicates', 'errors'].every(key => Number.isSafeInteger(row[key]) && (row[key] as number) >= 0 && (row[key] as number) <= 1000000) &&
    (row.exported as number) + (row.duplicates as number) + (row.errors as number) <= (row.found as number);
}
export function parseWorkerEvent(line: string): WorkerEvent {
  const event: unknown = JSON.parse(line);
  if (!event || typeof event !== 'object') throw new Error('Invalid worker message.');
  const row = event as Record<string, unknown>;
  if (row.v !== 1) throw new Error('Unsupported worker protocol.');
  if ((row.type === 'outlook_progress' || row.type === 'outlook_result') && validOutlookProgress(row.counts)) return { v: 1, type: row.type, counts: row.counts };
  if (row.type === 'prompt' && (row.action === 'ready' || row.action === 'close_browser')) return row as WorkerEvent;
  if (row.type === 'cancelled') return row as WorkerEvent;
  if (row.type === 'error' && ['dependency', 'browser', 'protocol'].includes(String(row.code))) return row as WorkerEvent;
  if ((row.type === 'result' || row.type === 'progress') && isCounts(row.counts)) {
    if (row.type === 'result' || (Number.isSafeInteger(row.processed) && (row.processed as number) >= 0 && (row.processed as number) <= row.counts.found)) return row as WorkerEvent;
  }
  throw new Error('Invalid worker message.');
}
