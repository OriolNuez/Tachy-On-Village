export interface OutlookSettings { step?: number; subject: string; body: string; limit: number; verifiedOnly: boolean; signature: boolean }
export interface OutlookDraft { id: string; name: string; email: string; university: string; subject: string; body: string }
export type OutlookAttemptStatus = 'attempt_started' | 'save_attempted' | 'subject_visible_review_required' | 'uncertain';
export interface OutlookAttempt { step?: number; batchId?: string; id: string; cadence: string; name: string; email: string; subject: string; status: OutlookAttemptStatus; attemptedAt: string }
export interface OutlookPreview {
  token: string; settings: OutlookSettings; selected: OutlookDraft[];
  eligible: number; skipped: { name: string; reason: string }[]; history: OutlookAttempt[];
}
export interface OutlookProgress { total: number; processed: number; subjectVisible: number; uncertain: number; skipped: number }
export function validOutlookProgress(value: unknown): value is OutlookProgress {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, number>;
  return ['total', 'processed', 'subjectVisible', 'uncertain', 'skipped'].every(k => Number.isSafeInteger(row[k]) && row[k] >= 0 && row[k] <= 100) && row.subjectVisible + row.uncertain + row.skipped === row.processed && row.processed <= row.total;
}
