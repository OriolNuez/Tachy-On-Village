import { useEffect, useState } from 'react';
import type { JobAction, JobSnapshot } from '../../shared/jobs';
import { Modal } from '../cadences/Modal';

export function CognismConsole({ job, cadence, onDismiss }: { job: JobSnapshot | null; cadence: string | null; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = job?.tool === 'cognism' ? job : null;
  useEffect(() => { if (current?.state === 'failed') setOpen(true); }, [current?.id, current?.state]);
  async function start() {
    if (!cadence || busy) return;
    setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.jobs.startCognism(cadence);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      onDismiss(); setOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not launch Cognism.'); }
    finally { setBusy(false); }
  }
  async function act(action: JobAction) {
    if (!current || busy) return;
    setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.jobs.act(current.id, action);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete action.'); }
    finally { setBusy(false); }
  }
  const statuses = { starting: 'Opening Cognism', browser_ready: 'Prepare your contact list', extracting: 'Reading visible contacts', close_browser: 'Closing browser', closing_browser: 'Closing browser', merging: 'Saving contacts', cancelling: 'Cancelling safely', finished: current?.state === 'completed' ? 'Import complete' : current?.state === 'cancelled' ? 'Cancelled' : 'Needs review' };
  return <>
    {current && <button className="job-tray" onClick={() => setOpen(true)}>Cognism task<small>{statuses[current.phase]}</small></button>}
    {cadence && <Modal title="Import Cognism Contacts" busy={busy} onClose={onDismiss}>
      <p>Import into <strong>{cadence}</strong>. Prepare the desired contact list in Cognism.</p>
      <ol className="job-instructions"><li>Launch Chrome and sign in manually using the app’s separate Cognism profile.</li><li>Navigate to your list and make the contact rows visible.</li><li>Choose <strong>Start Import</strong> here. Chrome closes automatically when reading finishes.</li></ol>
      <p>Only visible, available contact information is read. Existing records are kept; uncertain matches are flagged for review. The exporter stops at the last detected page or its 100-page safety limit. No email outreach starts.</p>
      {job?.state === 'running' && <p className="form-error">Finish or cancel the current task before starting another.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions"><button className="small-button" disabled={busy} onClick={onDismiss}>Back</button><button className="retro-button primary" disabled={busy || job?.state === 'running'} onClick={() => void start()}>{busy ? 'Starting…' : 'Launch Cognism'}</button></div>
    </Modal>}
    {open && !cadence && current && <Modal title="Cognism Import" onClose={() => setOpen(false)}>
      <div className="job-console">
        <p className="job-cadence">{current.cadence}</p>
        <p className="job-status" role="status"><strong>{statuses[current.phase]}</strong><span>{current.state}</span></p>
        {current.state === 'running' && <progress aria-label="Cognism import progress" />}
        {current.phase === 'browser_ready' && <p>Sign in and open your chosen list in Chrome. When the contact rows are visible, choose Start Import.</p>}
        <p>List total: unknown. Counts reflect rows actually processed, not an estimated percentage.</p>
        {current.counts && <dl className="job-counts">
          <div><dt>Processed</dt><dd>{current.processed}</dd></div><div><dt>Imported</dt><dd>{current.result?.added ?? (current.state === 'running' ? 'Pending' : 0)}</dd></div>
          <div><dt>Duplicates skipped</dt><dd>{current.result?.duplicates ?? 0}</dd></div><div><dt>Missing emails</dt><dd>{current.counts.missingEmails ?? 0}</dd></div>
          <div><dt>Verified emails</dt><dd>{current.counts.verifiedEmails ?? 0}</dd></div><div><dt>Diamond contacts</dt><dd>{current.counts.diamond ?? 0}</dd></div>
          <div><dt>Row failures</dt><dd>{current.counts.errors}</dd></div>
        </dl>}
        <p>Verified counts include only explicit “Yes” badges. “Unknown” and mixed verification remain unchanged in the CSV.</p>
        {current.result && <p>{current.result.total} contacts now stored. {current.result.review?.length ?? 0} rows need review. Added uncertain rows have an Import Review column in the CSV.</p>}
        {!!current.result?.review?.length && <details><summary>Review uncertain matches</summary><ul>{current.result.review.map(item => <li key={item.row}>{item.name} · {item.company || 'No company'} · {item.email || 'No email'} (export row {item.row}): {item.reason} — {item.skipped ? 'skipped; existing record kept' : 'imported with review flag'}</li>)}</ul></details>}
        {(current.error || !!current.counts?.errors) && <section className="job-error" aria-label="Error reviewer"><h3>Error reviewer</h3><p>{current.error || `${current.counts?.errors} rows could not be read. Review the selected Cognism list before retrying.`}</p>{current.state !== 'completed' && <p>Existing cadence data was not changed.</p>}</section>}
        <details open className="job-log-details"><summary>Live task logs · latest 250 lines</summary><div className="job-logs" role="log" aria-label="Task logs" tabIndex={0}>{current.logs.map(log => <p key={log.sequence}><span>{log.stream}</span>{log.text}</p>)}</div></details>
        <div className="job-actions">
          {current.phase === 'browser_ready' && <button className="retro-button primary" disabled={busy} onClick={() => void act('ready')}>Start Import</button>}
          {current.state === 'running' && <button className="small-button" disabled={busy || !current.canCancel} onClick={() => void act('cancel')}>{current.phase === 'cancelling' ? 'Cancelling…' : 'Cancel task'}</button>}
          <button className="small-button" onClick={() => setOpen(false)}>{current.state === 'running' ? 'Hide task' : 'Done'}</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>}
  </>;
}
