import { OutlookPlans } from './outlook-plan';
import type { OutlookPreview } from '../shared/outlook';
import { commitContacts } from './contact-merge';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { cadenceNameError } from '../shared/cadences';
import { parseWorkerEvent, type JobAction, type JobLog, type JobSnapshot, type WorkerEvent } from '../shared/jobs';
import { CadenceError, CadenceStore } from './cadence-files';
import { commitAccounts, readAccountFile } from './account-merge';

type Launch = (executable: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; shell: false; windowsHide: true; stdio: ['pipe', 'pipe', 'pipe'] }) => ChildProcessWithoutNullStreams;
interface RunnerOptions {
  store: CadenceStore; backendRoot: string; userData: string; python?: string;
  launch?: Launch; cancelTimeoutMs?: number;
}
const errorMessages = {
  dependency: 'Python Playwright is unavailable. Install it in the Python interpreter configured for Tachy-on, then start a new export.',
  browser: 'Salesforce export failed. Check Chrome installation, sign-in, list visibility and that no other browser is using the Salesforce profile.',
  protocol: 'The Python worker sent an invalid or unexpected message. No cadence data was merged.',
};

export function redactLog(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '[URL hidden]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email hidden]')
    .replace(/\b(cookie|authorization|password|token|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/(?:[A-Za-z]:\\|\/)(?:[^\s]+[\\/])*[^\s]+/g, '[local path]')
    .replace(/\p{Cc}/gu, '').slice(0, 1000);
}

export class PythonJobs {
  private outlookPlans: OutlookPlans;
  private job: JobSnapshot | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private listeners = new Set<(job: JobSnapshot) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private forced = false;
  private blockedProfile = false;
  private receivedResult = false;
  private lastProgressAt = 0;
  private stopped: Promise<void> = Promise.resolve();
  private finishStop: (() => void) | null = null;
  private shuttingDown = false;
  constructor(private readonly options: RunnerOptions) {
    this.outlookPlans = new OutlookPlans(options.store, options.userData, options.backendRoot);
    if (options.python && !isAbsolute(options.python)) throw new Error('TACHYON_PYTHON must be an absolute executable path.');
  }
  current(): JobSnapshot | null { return this.job ? structuredClone(this.job) : null; }
  subscribe(listener: (job: JobSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private publish() {
    const job = this.current();
    if (job) for (const listener of this.listeners) {
      // A detached renderer must never turn a committed save into a failed job.
      try { listener(job); } catch { /* Snapshot remains available on reconnect. */ }
    }
  }
  private log(stream: JobLog['stream'], text: string, publish = true) {
    if (!this.job) return;
    this.job.logs.push({ sequence: ++this.sequence, stream, text: redactLog(text) });
    this.job.logs = this.job.logs.slice(-250);
    if (publish) this.publish();
  }
  isRunning(): boolean { return this.job?.state === 'running'; }

  async outlookHistory(value: unknown) {
    const error = cadenceNameError(value);
    if (error) throw new CadenceError(error);
    return (await this.outlookPlans.history()).filter(row => row.cadence === value);
  }

  async previewOutlook(value: unknown, settings?: unknown): Promise<OutlookPreview> {
    const error = cadenceNameError(value);
    if (error) throw new CadenceError(error);
    if (this.isRunning()) throw new CadenceError('Finish or cancel the running task before preparing Outlook drafts.');
    return this.outlookPlans.preview(value as string, settings);
  }
  startOutlook(value: unknown, token: unknown): Promise<JobSnapshot> { return this.start(value, 'outlook', token); }
  startSalesforce(value: unknown): Promise<JobSnapshot> { return this.start(value, 'salesforce'); }
  startCognism(value: unknown): Promise<JobSnapshot> { return this.start(value, 'cognism'); }
  private async start(value: unknown, tool: JobSnapshot['tool'], token?: unknown): Promise<JobSnapshot> {
    const error = cadenceNameError(value);
    if (error) throw new CadenceError(error);
    if (this.options.store.editing) throw new CadenceError('Wait for the cadence edit to finish.');
    if (this.shuttingDown) throw new CadenceError('The app is shutting down.');
    if (this.isRunning()) throw new CadenceError('The job runner is already in use. Finish or cancel the running job first.');
    if (this.blockedProfile) throw new CadenceError('A worker had to be stopped forcibly. Close its external Chrome window and restart Tachy-on before exporting again.');
    const cadence = value as string;
    this.job = { id: randomUUID(), tool, cadence, state: 'running', phase: 'starting', processed: 0, counts: null, result: null, logs: [], error: null, canCancel: true };
    this.receivedResult = false; this.forced = false; this.sequence = 0;
    this.stopped = new Promise(resolve => { this.finishStop = resolve; });
    this.log('system', tool === 'outlook' ? 'Opening Outlook for the reviewed draft batch. No Send action is available.' : `Starting ${tool}. No cadence data is changed until export and validation succeed.`);
    let workspace: string | undefined;
    try {
      await (tool !== 'salesforce' ? this.options.store.contactsPath(cadence) : this.options.store.accountsPath(cadence));
      const jobsRoot = join(this.options.userData, 'jobs');
      await mkdir(jobsRoot, { recursive: true, mode: 0o700 });
      workspace = await mkdtemp(join(jobsRoot, `${tool}-`));
      if (this.current()?.phase === 'cancelling') { await this.finish('cancelled', workspace); return this.current()!; }
      const output = join(workspace, tool === 'cognism' ? 'contacts.csv' : 'accounts.csv');
      const profile = join(this.options.userData, 'browser_profiles', tool);
      // Only these three fixed adapters are allowlisted. Renderer input never selects a program, script,
      // profile, output path, environment variable, or command-line option.
      const script = join(this.options.backendRoot, 'workers', tool === 'outlook' ? 'outlook_worker.py' : tool === 'cognism' ? 'cognism_importer.py' : 'salesforce_exporter.py');
      const executable = this.options.python ?? (process.platform === 'win32' ? 'python' : 'python3');
      let args = ['-u', script, '--output', output, '--profile', profile];
      if (tool === 'outlook') {
        const plan = await this.outlookPlans.consume(cadence, token, workspace);
        this.job.outlook = { total: plan.total, processed: 0, subjectVisible: 0, uncertain: 0, skipped: 0 };
        args = ['-u', script, '--request', plan.request, '--ledger', plan.ledger, '--profile', profile];
      }
      if (this.current()?.phase === 'cancelling') { await this.finish('cancelled', workspace); return this.current()!; }
      const env: NodeJS.ProcessEnv = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8' };
      delete env.PYTHONPATH; delete env.PYTHONSTARTUP;
      const launch = this.options.launch ?? ((executable, args, options) => spawn(executable, args, options));
      this.child = launch(executable, args, { cwd: workspace, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const child = this.child;
      child.stdin.on('error', () => { if (this.isRunning()) this.fail('The Python input pipe closed unexpectedly.'); });
      this.readStream(child, 'stdout'); this.readStream(child, 'stderr');
      child.on('error', () => this.fail('Python could not start. Check that the configured Python executable exists and has Playwright installed.'));
      child.once('close', (code, signal) => { void this.exited(code, signal, workspace!, output); });
    } catch (reason) {
      this.job.error = reason instanceof CadenceError ? reason.message : 'Could not prepare the worker. Check the cadence folder and app-data permissions.';
      await this.finish(this.job.phase === 'cancelling' ? 'cancelled' : 'failed', workspace);
    }
    return this.current()!;
  }

  private readStream(child: ChildProcessWithoutNullStreams, stream: 'stdout' | 'stderr') {
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    const accept = (chunk: string) => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
        if (line.length > 65536) { this.fail('Worker output exceeded the protocol limit. No cadence data was merged.'); continue; }
        if (!line) continue;
        if (stream === 'stderr') this.log('stderr', line);
        else {
          try { this.event(parseWorkerEvent(line)); }
          catch { this.fail(errorMessages.protocol); }
        }
      }
      if (buffer.length > 65536) { buffer = ''; this.fail('Worker output exceeded the protocol limit. No cadence data was merged.'); }
    };
    child[stream].on('data', (chunk: Buffer) => accept(decoder.write(chunk)));
    child[stream].on('end', () => {
      accept(decoder.end());
      if (buffer.trim()) {
        if (stream === 'stderr') this.log('stderr', buffer);
        else this.fail('The Python worker ended with an incomplete protocol message.');
      }
    });
  }

  private event(event: WorkerEvent) {
    const job = this.job;
    if (!job || job.state !== 'running' || job.phase === 'cancelling' || job.error) return;
    if (event.type === 'error') { this.fail(job.tool === 'outlook' && event.code !== 'dependency' ? 'Outlook task stopped. Check Chrome, login and attempt history. Drafts may already exist; do not retry uncertain attempts.' : job.tool === 'cognism' && event.code === 'browser' ? 'Cognism import failed. Check Chrome, login, list visibility and profile availability.' : errorMessages[event.code]); return; }
    if (event.type === 'cancelled') { job.phase = 'cancelling'; job.canCancel = false; this.publish(); return; }
    if (event.type === 'prompt') {
      if (event.action === 'ready' && job.phase === 'starting') {
        job.phase = 'browser_ready'; this.log('stdout', job.tool === 'outlook' ? 'Sign in to Outlook, open Inbox, then choose Start Drafting.' : job.tool === 'cognism' ? 'Browser ready. Prepare your Cognism contact list, then choose Start Import.' : 'Browser ready. Sign in and select your territory, then choose Ready to Export.'); return;
      }
      if (event.action === 'close_browser' && job.phase === 'extracting' && ((job.tool === 'outlook' && job.outlook) || (job.counts && job.processed === job.counts.found))) {
        job.phase = 'close_browser'; this.log('stdout', job.tool === 'outlook' ? 'Batch paused for review. Inspect Outlook Drafts, then choose Close Browser.' : 'Intermediate export saved. Close Browser to finish and merge accounts.'); return;
      }
      throw new Error('Unexpected prompt.');
    }
    if (event.type === 'outlook_progress' || event.type === 'outlook_result') {
      if (job.tool !== 'outlook' || !job.outlook || event.counts.total !== job.outlook.total || event.counts.processed < job.outlook.processed) throw new Error('Invalid draft progress.');
      if (event.type === 'outlook_progress') {
        if (job.phase !== 'extracting') throw new Error('Unexpected draft progress.');
        job.outlook = event.counts; job.processed = event.counts.processed;
        this.log('stdout', `${event.counts.processed}/${event.counts.total} processed; ${event.counts.subjectVisible} subjects visible in Drafts; ${event.counts.uncertain} uncertain; ${event.counts.skipped} skipped.`);
      } else {
        if (job.phase !== 'closing_browser' || this.receivedResult || (['total', 'processed', 'subjectVisible', 'uncertain', 'skipped'] as const).some(key => event.counts[key] !== job.outlook![key])) throw new Error('Unexpected draft result.');
        this.receivedResult = true;
        this.log('stdout', 'Browser closed. Draft history remains available for review.');
      }
      return;
    }
    if (job.tool === 'outlook') throw new Error('Unexpected exporter message for Outlook.');
    if (event.type === 'progress') {
      if (job.phase !== 'extracting' || event.processed < job.processed || (job.counts && (job.tool === 'salesforce' ? job.counts.found !== event.counts.found : event.counts.found < job.counts.found)) || event.counts.exported + event.counts.duplicates + event.counts.errors !== event.processed) throw new Error('Unexpected progress.');
      if (job.tool === 'cognism' && (event.counts.verifiedEmails === undefined || event.counts.diamond === undefined || event.counts.missingEmails === undefined || event.counts.found !== event.processed)) throw new Error('Missing contact metrics.');
      job.counts = event.counts; job.processed = event.processed;
      if (Date.now() - this.lastProgressAt > 100 || event.processed === event.counts.found) {
        this.lastProgressAt = Date.now(); this.log('stdout', job.tool === 'cognism' ? `Processed ${event.processed} contacts; ${event.counts.verifiedEmails} verified emails; ${event.counts.diamond} Diamond; ${event.counts.errors} errors. Total unknown.` : `Read ${event.processed} of ${event.counts.found} account links.`);
      }
      return;
    }
    if (event.type === 'result') {
      if (job.phase !== (job.tool === 'cognism' ? 'extracting' : 'closing_browser') || !job.counts || (['found', 'exported', 'duplicates', 'errors', 'verifiedEmails', 'diamond', 'missingEmails'] as const).some(key => event.counts[key] !== job.counts![key]) || this.receivedResult) throw new Error('Unexpected result.');
      this.receivedResult = true;
      if (job.tool === 'cognism') job.phase = 'closing_browser';
      this.log('stdout', 'Browser closed. Waiting for a successful worker exit before merging.');
    }
  }

  async actChecked(id: unknown, action: unknown): Promise<JobSnapshot> {
    if (this.job?.tool === 'outlook' && this.job.id === id && action === 'ready') await this.outlookPlans.assertUnchanged(this.job.cadence);
    return this.act(id, action);
  }
  act(id: unknown, action: unknown): JobSnapshot {
    const job = this.job;
    if (typeof id !== 'string' || typeof action !== 'string' || !job || id !== job.id || !['ready', 'close_browser', 'cancel'].includes(action)) throw new CadenceError('Invalid job action.');
    if (job.state !== 'running') throw new CadenceError('This job has already finished.');
    if (action === 'cancel') {
      if (job.phase === 'cancelling') return this.current()!;
      if (!job.canCancel) throw new CadenceError('The atomic save is in progress. Wait for the result.');
      job.phase = 'cancelling'; job.canCancel = false;
      this.log('system', 'Cancellation requested. Waiting for the current browser operation to finish and the browser to close.');
      this.send('cancel'); this.armTimeout();
    } else {
      if ((action === 'ready' && job.phase !== 'browser_ready') || (action === 'close_browser' && job.phase !== 'close_browser')) throw new CadenceError('This action is not available at the current step.');
      job.phase = action === 'ready' ? 'extracting' : 'closing_browser';
      this.send(action as JobAction); this.publish();
    }
    return this.current()!;
  }
  private send(action: JobAction) {
    if (this.child && !this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify({ v: 1, action }) + '\n');
  }
  private armTimeout() {
    if (this.timer || !this.child) return;
    this.timer = setTimeout(() => {
      if (!this.child || !this.isRunning()) return;
      this.forced = true; this.blockedProfile = true;
      this.log('system', this.job?.tool === 'outlook' ? 'Forced stop. Close Chrome and inspect Outlook Drafts and attempt history before restarting; drafts may exist.' : 'Worker did not stop in time. Forcing termination; close its Chrome window before restarting the app. Cadence data is unchanged.');
      this.child.kill('SIGKILL');
    }, this.options.cancelTimeoutMs ?? 45000);
  }
  private fail(message: string) {
    if (!this.job || !this.isRunning() || this.job.error || this.job.phase === 'cancelling') return;
    this.job.error = message; this.job.canCancel = false;
    this.log('system', message); this.send('cancel'); this.armTimeout();
  }
  private async exited(code: number | null, signal: NodeJS.Signals | null, workspace: string, output: string) {
    this.child = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const job = this.job!;
    if (job.error) { await this.finish('failed', workspace); return; }
    if (job.phase === 'cancelling') {
      if (this.forced) job.error = 'Cancellation required forced termination. Check that the external Chrome window has closed. Existing cadence data was not changed.';
      await this.finish('cancelled', workspace); return;
    }
    if (job.tool === 'outlook') {
      if (code !== 0 || signal || !this.receivedResult) job.error = 'Outlook ended without a complete result. Drafts may exist; inspect attempt history before proceeding.';
      await this.finish(job.error ? 'failed' : 'completed', workspace); return;
    }
    if (code !== 0 || signal || !this.receivedResult || !job.counts) {
      job.error = 'The worker exited without a verified export. No cadence data was merged. Review the logs and start a new run when ready.';
      await this.finish('failed', workspace); return;
    }
    job.phase = 'merging'; job.canCancel = false; this.publish();
    try {
      const path = await (job.tool !== 'salesforce' ? this.options.store.contactsPath(job.cadence) : this.options.store.accountsPath(job.cadence));
      const incoming = await readAccountFile(output);
      job.result = await (job.tool === 'cognism' ? commitContacts(path, incoming!, job.counts.exported) : commitAccounts(path, incoming!, job.counts.exported));
      job.result.duplicates += job.counts.duplicates;
      await this.finish('completed', workspace);
    } catch (reason) {
      job.error = reason instanceof CadenceError ? reason.message : 'Could not save the export. Check file permissions and available disk space. Existing cadence data was not changed.';
      await this.finish('failed', workspace);
    }
  }
  private async finish(state: JobSnapshot['state'], workspace?: string) {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => {});
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.job) {
      this.job.state = state; this.job.phase = 'finished'; this.job.canCancel = false;
      this.log('system', this.job.tool === 'outlook' ? (state === 'completed' ? 'Draft batch finished — check your drafts. Subject checks require manual recipient/body review. No messages sent.' : 'Outlook task stopped. Drafts may already exist; durable attempt history prevents automatic retry.') : state === 'completed' ? this.job.tool === 'cognism' ? 'Contacts merged successfully. Refreshing the Contacts table.' : 'Accounts merged successfully. Refreshing the Accounts table.' : state === 'cancelled' ? 'Job cancelled. No cadence data was changed.' : this.job.error ?? 'Job failed. No cadence data was changed.');
    }
    this.finishStop?.(); this.finishStop = null;
  }
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.job?.state === 'running' && this.job.canCancel) this.act(this.job.id, 'cancel');
    await this.stopped;
  }
}
