import { useEffect, useRef, useState } from 'react';
import type { JobAction, JobSnapshot } from '../../shared/jobs';
import { Modal } from '../cadences/Modal';

const phases = {
  starting: 'Opening Salesforce', browser_ready: 'Waiting for your account list',
  extracting: 'Reading account links', close_browser: 'Export ready — browser still open',
  closing_browser: 'Closing the browser', merging: 'Saving accounts', cancelling: 'Cancelling safely', finished: 'Finished',
};
export function JobConsole({ job, cadence, onDismiss, connectionError }: { job: JobSnapshot | null; cadence: string | null; onDismiss: () => void; connectionError: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { if (job?.state === 'failed') setOpen(true); }, [job?.id, job?.state]);
  useEffect(() => { if (open) logEnd.current?.scrollIntoView({ block: 'nearest' }); }, [job?.logs.length, job?.logs.at(-1)?.sequence, open]);
  async function start() {
    if (!cadence || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const api = window.villageDesktop?.jobs;
      if (!api) throw new Error('Open the Electron desktop app to run Salesforce.');
      const result = await api.startSalesforce(cadence);
      if (!result.ok) throw new Error(result.error);
      onDismiss(); setOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start Salesforce.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function act(action: JobAction) {
    if (!job || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.jobs.act(job.id, action);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'The desktop bridge is unavailable.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not be completed.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const status = job?.state === 'running' ? phases[job.phase] : job?.state === 'completed' ? 'Accounts added' : job?.state === 'cancelled' ? 'Cancelled' : 'Needs review';
  return <>
    {(job || connectionError) && <button className="job-tray" onClick={() => { setError(''); setOpen(true); }}><span aria-hidden="true">▥</span><span>Salesforce task<small>{connectionError || status}</small></span></button>}
    {cadence && <Modal title="Add Salesforce Accounts" busy={busy} onClose={() => { setError(''); onDismiss(); }}>
      <p>Open Salesforce in Chrome and import accounts into <strong>{cadence}</strong>.</p>
      <ol className="job-instructions"><li>Sign in and choose your territory in the external browser.</li><li>When your account list is visible, choose <strong>Ready to Export</strong> here.</li><li>Choose <strong>Close Browser</strong> after extraction to finish and merge new account IDs.</li></ol>
      <p>Your existing accounts will be kept. Salesforce is read only; this task does not send messages. The app uses its own Salesforce browser profile, so you may need to sign in again.</p>
      {job?.state === 'running' && <p className="form-error">A Salesforce task is already running. Finish or cancel it before starting another.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="small-button" disabled={busy} onClick={() => { setError(''); onDismiss(); }}>Back</button><button className="retro-button primary" disabled={busy || job?.state === 'running'} onClick={() => void start()}>{busy ? 'Starting…' : 'Launch Salesforce'}</button></div>
    </Modal>}
    {open && !cadence && <Modal title="Salesforce Task" onClose={() => setOpen(false)}>
      {job ? <div className="job-console">
        <p className="job-cadence">{job.cadence}</p>
        <p role="status" className="job-status"><strong>{status}</strong><span>{job.state}</span></p>
        {job.state === 'running' && <progress aria-label="Salesforce task progress" max={job.counts?.found || 1} value={job.phase === 'extracting' && job.counts?.found ? job.processed : undefined} />}
        {job.phase === 'browser_ready' && <p>Sign in to Salesforce and select the desired territory. Keep the account list visible in Chrome, then continue here.</p>}
        {job.phase === 'close_browser' && <p>The intermediate CSV is ready. Close the browser to finish the task and merge your accounts.</p>}
        {job.phase === 'cancelling' && <p>Waiting for the current browser operation to return. Your cadence CSV will not be changed.</p>}
        {job.counts && <dl className="job-counts"><div><dt>Account links found</dt><dd>{job.counts.found}</dd></div><div><dt>New accounts added</dt><dd>{job.result?.added ?? 'Pending'}</dd></div><div><dt>Duplicates skipped</dt><dd>{job.result?.duplicates ?? job.counts.duplicates}</dd></div><div><dt>Extraction errors</dt><dd>{job.counts.errors}</dd></div></dl>}
        {job.result && <p>{job.result.total} total accounts in this cadence. Existing records were kept.</p>}
        {(job.error || job.counts?.errors) ? <section className="job-error" aria-label="Error reviewer"><h3>Error reviewer</h3><p>{job.error || `${job.counts?.errors} account ${job.counts?.errors === 1 ? 'link was' : 'links were'} skipped because a name or URL was missing. Review the Salesforce list before running another export.`}</p>{job.state !== 'completed' && <p>Existing cadence data was not changed. Review the logs and start a new task from Add Accounts when ready.</p>}</section> : null}
        <details open className="job-log-details"><summary>Live task logs · latest 250 lines</summary><div className="job-logs" role="log" aria-label="Task logs" aria-live="polite" tabIndex={0}>{job.logs.map(log => <p key={log.sequence} data-stream={log.stream}><span>{log.stream}</span>{log.text}</p>)}<div ref={logEnd} /></div></details>
        <div className="job-actions">
          {job.phase === 'browser_ready' && <button className="retro-button primary" disabled={busy} onClick={() => void act('ready')}>Ready to Export</button>}
          {job.phase === 'close_browser' && <button className="retro-button primary" disabled={busy} onClick={() => void act('close_browser')}>Close Browser</button>}
          {job.state === 'running' && <button className="small-button" disabled={busy || !job.canCancel} onClick={() => void act('cancel')}>{job.phase === 'cancelling' ? 'Cancelling…' : 'Cancel task'}</button>}
          <button className="small-button" onClick={() => setOpen(false)}>{job.state === 'running' ? 'Hide task' : 'Done'}</button>
        </div>
      </div> : <p>{connectionError || 'No task is running.'}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>}
  </>;
}
