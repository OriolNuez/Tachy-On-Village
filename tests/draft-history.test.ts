import { expect, it } from 'vitest';
import { filterDrafts } from '../frontend/cadences/DraftHistory';
import type { OutlookAttempt } from '../shared/outlook';

it('filters the same subject across explicit steps without inventing steps for legacy history', () => {
  const base: OutlookAttempt = { id: 'a', cadence: 'Example', name: 'Alex Example', email: 'alex@example.test', subject: 'Example subject', status: 'subject_visible_review_required', attemptedAt: '2026-11-01T12:00:00Z' };
  const rows = [base, { ...base, id: 'b', step: 1 }, { ...base, id: 'c', step: 2, status: 'uncertain' as const }, { ...base, id: 'd', subject: 'Other subject' }];
  expect(filterDrafts(rows, 'Example subject', '', '')).toHaveLength(3);
  expect(filterDrafts(rows, 'Example subject', '2', ' ALEX@EXAMPLE.TEST ')).toEqual([rows[2]]);
  expect(filterDrafts(rows, 'Example subject', 'unassigned', '')).toEqual([base]);
  expect(filterDrafts(rows, '', '', 'missing')).toEqual([]);
});
