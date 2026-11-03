import { useEffect, useRef, useState } from 'react';
import type { JobAction, JobSnapshot } from '../../shared/jobs';
import type { OutlookPreview, OutlookSettings } from '../../shared/outlook';
import { Modal } from '../cadences/Modal';

export function OutlookConsole({ job, cadence, onDismiss }: { job: JobSnapshot | null; cadence: string | null; onDismiss: () => void }) {
  const [messageFiles, setMessageFiles] = useState<string[]>([]);
  const [messageFile, setMessageFile] = useState('');
  const [importedFile, setImportedFile] = useState('');
  const [preview, setPreview] = useState<OutlookPreview | null>(null);
  const [settings, setSettings] = useState<OutlookSettings | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const pending = useRef(false);
  const current = job?.tool === 'outlook' ? job : null;
  useEffect(() => { if (current?.state === 'failed') setOpen(true); }, [current?.id, current?.state]);
  useEffect(() => {
    if (!cadence) return;
    let active = true;
    setPreview(null); setSettings(null); setError(''); setApproved(false); setBusy(true);
    void window.villageDesktop?.jobs.previewOutlook(cadence).then(result => {
      if (!active) return;
      if (!result.ok) setError(result.error);
      else { setPreview(result.data); setSettings(result.data.settings); }
    }).catch(() => { if (active) setError('Could not prepare the Outlook preview.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [cadence]);
  async function listMessages() {
    try {
      const result = await window.villageDesktop?.messaging.list();
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      setMessageFiles(result.data);
      setMessageFile(old => result.data.includes(old) ? old : result.data[0] ?? '');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not list message files.'); }
  }
  useEffect(() => { if (cadence) { setImportedFile(''); void listMessages(); } }, [cadence]);
  async function importMessage() {
    if (!messageFile || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.messaging.read(messageFile);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      change({ body: result.data.body, ...(result.data.subject === undefined ? {} : { subject: result.data.subject }) });
      setImportedFile(result.data.filename);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import the message.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const change = (value: Partial<OutlookSettings>) => { setSettings(old => old ? { ...old, ...value } : old); setPreview(null); setApproved(false); };
  async function refresh() {
    if (!cadence || !settings || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setApproved(false);
    try {
      const result = await window.villageDesktop?.jobs.previewOutlook(cadence, settings);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      setPreview(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not preview drafts.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function start() {
    if (!cadence || !preview || !approved || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.jobs.startOutlook(cadence, preview.token);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
      onDismiss(); setOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not launch Outlook.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function act(action: JobAction) {
    if (!current || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const result = await window.villageDesktop?.jobs.act(current.id, action);
      if (!result?.ok) throw new Error(result && !result.ok ? result.error : 'Desktop bridge unavailable.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete action.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <>
    {current && <button className="job-tray" onClick={() => setOpen(true)}>Outlook draft task<small>{current.state}</small></button>}
    {cadence && <Modal title="Prepare Outlook Drafts" busy={busy} onClose={onDismiss}>
      <p>Review recipients and message for <strong>{cadence}</strong>. This creates Outlook drafts only. Nothing is sent.</p>
      {settings && <fieldset disabled={busy} className="outlook-settings">
        <label htmlFor="message-template-file">Text files in messaging/</label>
        <select id="message-template-file" value={messageFile} onChange={event => setMessageFile(event.target.value)} disabled={!messageFiles.length}>
          {!messageFiles.length && <option value="">No .txt files found</option>}
          {messageFiles.map(file => <option key={file} value={file}>{file}</option>)}
        </select>
        <div className="modal-actions"><button className="small-button" onClick={() => void listMessages()}>Refresh files</button><button className="small-button" disabled={!messageFile} onClick={() => void importMessage()}>Import .txt</button></div>
        <p>Import replaces the message body. An optional first line “Subject:” also replaces the subject. The source file stays unchanged.</p>
        {importedFile && <p role="status">Imported {importedFile}. Edit if needed, then update and approve the preview.</p>}
        <label>Subject<input value={settings.subject} maxLength={250} onChange={event => change({ subject: event.target.value })} /></label>
        <label htmlFor="outlook-body">Message body</label><textarea id="outlook-body" rows={8} value={settings.body} maxLength={20000} onChange={event => change({ body: event.target.value })} />
        <p>Placeholders: {'{first_name}, {name}, {company}, {university}, {email}'}. Review any factual claims before creating drafts.</p>
        <label>Cadence step (1–100)<input type="number" min={1} max={100} value={settings.step ?? 1} onChange={event => change({ step: Number(event.target.value) })} /></label>
        <p>The step labels this batch for filtering. Existing draft attempts still block automatic retries or follow-ups.</p>
        <label>Maximum drafts (1–100)<input type="number" min={1} max={100} value={settings.limit} onChange={event => change({ limit: Number(event.target.value) })} /></label>
        <label><input type="checkbox" checked={settings.verifiedOnly} onChange={event => change({ verifiedOnly: event.target.checked })} /> Only explicitly verified emails</label>
        <label><input type="checkbox" checked={settings.signature} onChange={event => change({ signature: event.target.checked })} /> Insert Outlook’s “Default” signature</label>
        <p>If Outlook automatically inserts a signature, turn this off to avoid adding it twice.</p>
        <button className="small-button" onClick={() => void refresh()}>Update preview</button>
      </fieldset>}
      {preview && <>
        <p>{preview.selected.length} selected of {preview.eligible} eligible contacts. {preview.skipped.length} excluded.</p>
        {preview.selected.map(draft => <details key={draft.id}><summary>{draft.name} · {draft.email}</summary><strong>{draft.subject}</strong><pre className="outlook-message">{draft.body}</pre></details>)}
        {!!preview.skipped.length && <details><summary>Excluded contacts</summary><ul>{preview.skipped.map((row, i) => <li key={i}>{row.name}: {row.reason}</li>)}</ul></details>}
        {!!preview.history.length && <details><summary>Durable attempt history · inspect before retrying</summary><ul>{preview.history.map(row => <li key={row.id}>{row.name} · {row.email} · {row.subject}<br />{row.status.replaceAll('_', ' ')} · {new Date(row.attemptedAt).toLocaleString()}</li>)}</ul><p>Any prior attempt blocks automatic retries, including after changing a template or cadence. This version does not provide retry/reset controls.</p></details>}
        <label><input type="checkbox" checked={approved} disabled={busy || !preview.selected.length} onChange={event => setApproved(event.target.checked)} /> I reviewed the recipients and message above and want these drafts created.</label>
      </>}
      <p>Previous standalone CLI logs are not included in desktop history. Check existing Outlook Drafts before your first desktop batch.</p>
      <p>Sign in and open Inbox in the external Chrome window. Then choose Start Drafting here. Inspect the drafts before closing the browser.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="small-button" disabled={busy} onClick={onDismiss}>Back</button><button className="retro-button primary" disabled={busy || !preview?.selected.length || !approved || job?.state === 'running'} onClick={() => void start()}>{busy ? 'Preparing…' : 'Launch Outlook'}</button></div>
    </Modal>}
    {open && !cadence && current && <Modal title="Outlook Draft Task" onClose={() => setOpen(false)}>
      <div className="job-console">
        <p>{current.cadence}</p><p role="status" className="job-status"><strong>{current.phase === 'browser_ready' ? 'Sign in and open Inbox' : current.phase === 'close_browser' ? 'Inspect Outlook Drafts' : current.state === 'completed' ? 'Batch finished — review drafts' : current.phase.replaceAll('_', ' ')}</strong><span>{current.state}</span></p>
        {current.state === 'running' && <progress aria-label="Outlook draft progress" max={current.outlook?.total || 1} value={current.phase === 'extracting' ? current.outlook?.processed : undefined} />}
        {current.outlook && <dl className="job-counts"><div><dt>Processed</dt><dd>{current.outlook.processed} / {current.outlook.total}</dd></div><div><dt>Subject visible in Drafts</dt><dd>{current.outlook.subjectVisible}</dd></div><div><dt>Uncertain</dt><dd>{current.outlook.uncertain}</dd></div><div><dt>Skipped</dt><dd>{current.outlook.skipped}</dd></div></dl>}
        <p>The existing script checks the subject in Drafts. Check the recipient, saved body and signature yourself; a subject match alone is not full verification.</p>
        <p>No messages are sent and no follow-up tasks are scheduled. Cancelling cannot undo drafts already autosaved by Outlook.</p>
        {(current.error || !!current.outlook?.uncertain || current.state === 'cancelled') && <section className="job-error" aria-label="Error reviewer"><h3>Review required</h3><p>{current.error || 'Inspect Outlook for partial drafts. Attempted contacts remain blocked from automatic retry.'}</p></section>}
        <details open><summary>Live task logs</summary><div className="job-logs" role="log" tabIndex={0}>{current.logs.map(log => <p key={log.sequence}>{log.text}</p>)}</div></details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="job-actions">
          {current.phase === 'browser_ready' && <button className="retro-button primary" disabled={busy} onClick={() => void act('ready')}>Start Drafting</button>}
          {current.phase === 'close_browser' && <button className="retro-button primary" disabled={busy} onClick={() => void act('close_browser')}>Close Browser</button>}
          {current.state === 'running' && <button className="small-button" disabled={busy || !current.canCancel} onClick={() => void act('cancel')}>Cancel task</button>}
          <button className="small-button" onClick={() => setOpen(false)}>{current.state === 'running' ? 'Hide task' : 'Done'}</button>
        </div>
        <p>Reopen + Draft Emails after the task ends to review durable attempt history.</p>
      </div>
    </Modal>}
  </>;
}
