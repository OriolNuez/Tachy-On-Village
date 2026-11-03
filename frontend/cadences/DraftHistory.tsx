import { useEffect, useRef, useState } from 'react';
import type { OutlookAttempt } from '../../shared/outlook';
import { DataTable } from './DataTable';

export function filterDrafts(rows: OutlookAttempt[], subject: string, step: string, query: string) {
  const search = query.trim().toLowerCase();
  return rows.filter(row => (!subject || row.subject === subject) &&
    (!step || (row.step === undefined ? 'unassigned' : String(row.step)) === step) &&
    (!search || [row.name, row.email, row.subject].some(value => value.toLowerCase().includes(search))))
    .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
}
export function DraftHistory({ cadence, revision, replies, onChanged }: { cadence: string; revision: unknown; replies: Record<string, boolean>; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [replyError, setReplyError] = useState('');
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => { setSaved(replies); }, [replies]);
  async function markReplied(id: string, replied: boolean) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setReplyError('');
    try {
      const result = await window.villageDesktop?.cadences.edit(cadence, { kind: 'reply', id, replied });
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      setSaved(previous => ({ ...previous, [id]: replied })); onChanged();
    } catch (reason) { setReplyError(reason instanceof Error ? reason.message : 'Could not save reply.'); }
    finally { pending.current = false; setSaving(false); }
  }
  const [rows, setRows] = useState<OutlookAttempt[]>([]);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [step, setStep] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const api = window.villageDesktop?.jobs;
    let active = true, sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const result = await api?.outlookHistory(cadence);
        if (!active || request !== sequence) return;
        if (!result?.ok) { setError(result && !result.ok ? result.error : 'Desktop bridge unavailable.'); return; }
        setRows(result.data); setError('');
      } catch { if (active && request === sequence) setError('Could not load draft history. Refresh to retry.'); }
    }
    void refresh();
    let previous = '';
    const unsubscribe = api?.onUpdate(job => {
      if (job.tool !== 'outlook' || job.cadence !== cadence) return;
      const key = [job.id, job.state, job.phase, job.outlook?.processed].join(':');
      if (key !== previous) { previous = key; void refresh(); }
    });
    return () => { active = false; unsubscribe?.(); };
  }, [cadence, revision]);
  const subjects = [...new Set(rows.map(row => row.subject))].sort();
  const steps = [...new Set(rows.flatMap(row => row.step === undefined ? [] : [row.step]))].sort((a, b) => a - b);
  const filtered = filterDrafts(rows, subject, step, query);
  const replied = filtered.filter(row => saved[row.id]);
  return <section className="draft-history" aria-label="Draft history">
    <div className="section-edit-heading"><h3>Drafted emails / attempts ({rows.length})</h3><button className="small-button section-edit-toggle" aria-label="Edit replies" aria-pressed={editing} onClick={() => setEditing(value => !value)}>{editing ? 'Done' : '✎'}</button></div>
    <p role="status">{rows.filter(row => saved[row.id]).length} replied</p>
    {replyError && <p role="alert">{replyError}</p>}
    <div className="draft-filters">
      <label>Find contact or subject<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Email subject<select aria-label="Email subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="">All subjects</option>{subjects.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Cadence step<select aria-label="Cadence step" value={step} onChange={event => setStep(event.target.value)}><option value="">All steps</option>{steps.map(value => <option key={value} value={value}>Step {value}</option>)}<option value="unassigned">Unassigned (older drafts)</option></select></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <DataTable key={[subject, step, query].join('|')} label="Draft history" headers={['Contact', 'Subject', 'Step', 'Draft status', 'Attempted', 'Replied']}
      rows={filtered.map(row => [<span>{row.name}<br />{row.email}</span>, row.subject, row.step === undefined ? 'Unassigned' : `Step ${row.step}`,
        row.status === 'subject_visible_review_required' ? 'Subject found in Drafts — review required' : row.status === 'uncertain' ? 'Uncertain — review before retry' : 'Attempt recorded — not confirmed',
        <time dateTime={row.attemptedAt}>{row.attemptedAt.replace('T', ' ').slice(0, 19)} UTC</time>, <label><input type="checkbox" aria-label={'Replied: ' + row.email + ' — ' + row.subject} checked={!!saved[row.id]} disabled={!editing || saving} onChange={event => void markReplied(row.id, event.target.checked)} /> {saved[row.id] ? 'Replied' : 'Not marked'}</label>])}
      empty={rows.length ? 'No drafts match these filters' : 'No draft attempts recorded'} />
    <section className="replied-emails" aria-label="Replied emails">
      <h3>Replied ({replied.length})</h3>
      <DataTable key={['replied', subject, step, query].join('|')} label="Replied emails" headers={['Contact', 'Subject', 'Step']}
        rows={replied.map(row => [<span>{row.name}<br />{row.email}</span>, row.subject, row.step === undefined ? 'Unassigned' : `Step ${row.step}`])}
        empty={rows.some(row => saved[row.id]) ? 'No replied emails match these filters' : 'No emails marked as replied yet'} />
    </section>
  </section>;
}
