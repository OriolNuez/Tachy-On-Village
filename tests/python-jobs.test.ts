import { contactColumns } from '../electron/contact-merge';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CadenceStore } from '../electron/cadence-files';
import { PythonJobs, redactLog } from '../electron/python-jobs';
import { parseWorkerEvent, type JobSnapshot } from '../shared/jobs';

class FakeChild extends EventEmitter {
  stdin = new PassThrough(); stdout = new PassThrough(); stderr = new PassThrough();
  commands: string[] = []; killed = false;
  constructor() { super(); this.stdin.on('data', data => this.commands.push(String(data))); }
  kill() { this.killed = true; this.close(null, 'SIGKILL'); return true; }
  event(data: object) { this.stdout.write(JSON.stringify({ v: 1, ...data }) + '\n'); }
  close(code: number | null = 0, signal: string | null = null) { this.stdout.end(); this.stderr.end(); this.emit('close', code, signal); }
}
const counts = { found: 3, exported: 2, duplicates: 1, errors: 0 };
const csv = 'Account Name,Salesforce Account ID,Salesforce URL\nExample One,001000000000001,https://example.salesforce.com/one\nExample Two,001000000000002,https://example.salesforce.com/two\n';
async function settled(jobs: PythonJobs): Promise<JobSnapshot> {
  await expect.poll(() => jobs.current()?.state).not.toBe('running');
  return jobs.current()!;
}

describe('allowlisted Python runner with fake child processes', () => {
  let root: string, store: CadenceStore, jobs: PythonJobs, child: FakeChild, output: string;
  let invocation: { executable: string; args: string[]; shell: boolean };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tachyon-runner-'));
    store = new CadenceStore(join(root, 'Tachyon')); await store.create('Example');
    jobs = new PythonJobs({ store, backendRoot: join(root, 'backend'), userData: join(root, 'appdata'), cancelTimeoutMs: 20,
      launch: (executable, args, options) => {
        invocation = { executable, args, shell: options.shell };
        output = args[args.indexOf('--output') + 1]; child = new FakeChild();
        return child as unknown as ChildProcessWithoutNullStreams;
      },
    });
  });
  afterEach(async () => { if (jobs.isRunning()) child?.close(1); await jobs.shutdown(); await rm(root, { recursive: true, force: true }); });
  async function exportReady() {
    child.event({ type: 'prompt', action: 'ready' }); jobs.act(jobs.current()!.id, 'ready');
    child.event({ type: 'progress', processed: 0, counts: { found: 3, exported: 0, duplicates: 0, errors: 0 } });
    child.event({ type: 'progress', processed: 3, counts });
    await writeFile(output, csv);
    child.event({ type: 'prompt', action: 'close_browser' });
  }
  it('spawns only the adapter with argument arrays and merges after explicit prompts and successful exit', async () => {
    jobs.subscribe(() => { throw new Error('renderer disconnected'); });
    await jobs.startSalesforce('Example');
    expect(invocation.shell).toBe(false);
    expect(invocation.args[1]).toBe(join(root, 'backend', 'workers', 'salesforce_exporter.py'));
    expect(invocation.args).not.toContain('Example');
    await exportReady();
    expect(jobs.current()?.phase).toBe('close_browser');
    expect(await readdir(join(store.root, 'Example', 'Accounts'))).toEqual([]);
    jobs.act(jobs.current()!.id, 'close_browser');
    child.event({ type: 'result', counts });
    expect(jobs.current()?.state).toBe('running');
    child.close();
    const result = await settled(jobs);
    expect(result.state).toBe('completed');
    expect(result.result).toEqual({ added: 2, duplicates: 1, total: 2 });
    expect(child.commands.map(line => JSON.parse(line).action)).toEqual(['ready', 'close_browser']);
    expect(await readFile(await store.accountsPath('Example'), 'utf8')).toContain('Example Two');
    expect(await readdir(join(root, 'appdata', 'jobs'))).toEqual([]);
  });
  it('runs Cognism with growing actual counts and merges only after a successful exit', async () => {
    await jobs.startCognism('Example');
    expect(invocation.args[1]).toBe(join(root, 'backend', 'workers', 'cognism_importer.py'));
    expect(invocation.args).toContain(join(root, 'appdata', 'browser_profiles', 'cognism'));
    await expect(jobs.startCognism('Example')).rejects.toThrow(/already in use/);
    await expect(jobs.startSalesforce('Example')).rejects.toThrow(/already in use/);
    child.event({ type: 'prompt', action: 'ready' }); jobs.act(jobs.current()!.id, 'ready');
    const contactCounts = { found: 1, exported: 1, duplicates: 0, errors: 0, verifiedEmails: 0, diamond: 1, missingEmails: 0 };
    child.event({ type: 'progress', processed: 0, counts: { ...contactCounts, found: 0, exported: 0, diamond: 0 } });
    child.event({ type: 'progress', processed: 1, counts: contactCounts });
    const values = ['Alex Example', 'Engineer', 'Example', 'example.test', '', 'alex@example.test', 'Unknown', '001234', '', '', '', 'Yes'];
    await writeFile(output, contactColumns.join(',') + '\n' + values.join(',') + '\n');
    child.event({ type: 'result', counts: contactCounts });
    expect(await readdir(join(store.root, 'Example', 'Contacts'))).toEqual([]);
    child.close();
    const result = await settled(jobs);
    expect(result.state).toBe('completed'); expect(result.result?.added).toBe(1);
    expect((await store.read('Example')).contacts[0].name).toBe('Alex Example');
    expect(await readFile(await store.contactsPath('Example'), 'utf8')).toContain('001234');
  });
  it.each(['cancel', 'failure', 'malformed'])('preserves Cognism destination on %s', async mode => {
    const target = await store.contactsPath('Example'); const original = 'Name,Email\nOriginal,original@example.test\n';
    await writeFile(target, original); await jobs.startCognism('Example');
    child.event({ type: 'prompt', action: 'ready' }); jobs.act(jobs.current()!.id, 'ready');
    if (mode === 'cancel') jobs.act(jobs.current()!.id, 'cancel');
    if (mode === 'malformed') child.event({ type: 'progress', processed: 1, counts: { found: 1, exported: 1, errors: 0, duplicates: 0 } });
    child.close(mode === 'cancel' ? 2 : 1);
    expect((await settled(jobs)).state).toBe(mode === 'cancel' ? 'cancelled' : 'failed');
    expect(await readFile(target, 'utf8')).toBe(original);
  });
  it('runs only a reviewed Outlook batch and uses draft-specific events without a CSV merge', async () => {
    await writeFile(await store.contactsPath('Example'), 'Name,Company,Email,Email Verified\nAlex,Example,alex@example.test,Yes\n');
    const preview = await jobs.previewOutlook('Example', { subject: 'Example subject', body: 'Hi {first_name}', limit: 1, signature: false, verifiedOnly: true });
    await jobs.startOutlook('Example', preview.token);
    expect(invocation.args[1]).toBe(join(root, 'backend', 'workers', 'outlook_worker.py'));
    expect(invocation.args).toContain('--request'); expect(invocation.args).not.toContain('--output');
    child.event({ type: 'prompt', action: 'ready' }); await jobs.actChecked(jobs.current()!.id, 'ready');
    const draftCounts = { total: 1, processed: 1, subjectVisible: 1, uncertain: 0, skipped: 0 };
    child.event({ type: 'outlook_progress', counts: draftCounts });
    child.event({ type: 'prompt', action: 'close_browser' });
    expect(jobs.current()?.phase).toBe('close_browser');
    jobs.act(jobs.current()!.id, 'close_browser'); child.event({ type: 'outlook_result', counts: draftCounts }); child.close();
    const result = await settled(jobs);
    expect(result.state).toBe('completed'); expect(result.outlook).toEqual(draftCounts); expect(result.result).toBeNull();
    expect(await readdir(join(store.root, 'Example', 'Storage'))).toEqual([]);
  });
  it('revalidates an Outlook preview after login and rejects stale contacts', async () => {
    const path = await store.contactsPath('Example');
    await writeFile(path, 'Name,Company,Email,Email Verified\nAlex,Example,alex@example.test,Yes\n');
    const preview = await jobs.previewOutlook('Example', { subject: 'Example', body: 'Hi {first_name}', limit: 1, signature: false, verifiedOnly: true });
    await jobs.startOutlook('Example', preview.token); child.event({ type: 'prompt', action: 'ready' });
    await writeFile(path, 'Name,Company,Email,Email Verified,Opt Out\nAlex,Example,alex@example.test,Yes,Yes\n');
    await expect(jobs.actChecked(jobs.current()!.id, 'ready')).rejects.toThrow(/changed/);
    expect(child.commands).toEqual([]);
  });
  it('keeps durable Outlook attempts when the worker fails', async () => {
    await writeFile(await store.contactsPath('Example'), 'Name,Company,Email,Email Verified\nAlex,Example,alex@example.test,Yes\n');
    const preview = await jobs.previewOutlook('Example', { subject: 'Example', body: 'Hi {first_name}', limit: 1, signature: false, verifiedOnly: true });
    await jobs.startOutlook('Example', preview.token);
    const ledger = join(root, 'appdata', 'outlook', 'attempts.json');
    await writeFile(ledger, '{"synthetic":"attempt retained"}'); child.close(1);
    expect((await settled(jobs)).state).toBe('failed');
    expect(await readFile(ledger, 'utf8')).toBe('{"synthetic":"attempt retained"}');
    expect(jobs.current()?.error).toMatch(/Drafts may exist/);
  });
  it('locks the profile across cadences and rejects invalid arguments/actions', async () => {
    await expect(jobs.startSalesforce('../escape')).rejects.toThrow();
    await jobs.startSalesforce('Example');
    await store.create('Other');
    await expect(jobs.startSalesforce('Other')).rejects.toThrow(/already in use/);
    for (const action of ['close_browser', 'ready', 'shell', ['cancel']]) expect(() => jobs.act(jobs.current()!.id, action)).toThrow();
    expect(() => jobs.act('wrong-id', 'cancel')).toThrow();
    expect(() => new PythonJobs({ store, backendRoot: root, userData: root, python: 'python && bad' })).toThrow(/absolute/);
  });
  it('keeps CSV intact on worker failure after creating an intermediate export', async () => {
    const target = await store.accountsPath('Example'); await writeFile(target, csv);
    await jobs.startSalesforce('Example'); await exportReady();
    child.close(1);
    expect((await settled(jobs)).state).toBe('failed');
    expect(await readFile(target, 'utf8')).toBe(csv);
  });
  it.each(['browser_ready', 'close_browser'])('cancels %s without merging and waits for actual process close', async phase => {
    await jobs.startSalesforce('Example');
    if (phase === 'close_browser') await exportReady();
    else child.event({ type: 'prompt', action: 'ready' });
    jobs.act(jobs.current()!.id, 'cancel');
    expect(jobs.current()?.state).toBe('running');
    child.event({ type: 'cancelled' }); child.close(2);
    expect((await settled(jobs)).state).toBe('cancelled');
    expect(await readdir(join(store.root, 'Example', 'Accounts'))).toEqual([]);
  });
  it('forces a stuck worker after the grace period and blocks unsafe profile reuse', async () => {
    await jobs.startSalesforce('Example'); jobs.act(jobs.current()!.id, 'cancel');
    child.stdout.write('{"v":1,"type":');
    expect((await settled(jobs)).state).toBe('cancelled');
    expect(child.killed).toBe(true);
    await expect(jobs.startSalesforce('Example')).rejects.toThrow(/forcibly/);
  });
  it('handles split UTF-8/protocol lines, redacts stderr, and rejects malformed protocol', async () => {
    await jobs.startSalesforce('Example');
    child.stdout.write('{"v":1,"type":"prompt",'); child.stdout.write('"action":"ready"}\n');
    expect(jobs.current()?.phase).toBe('browser_ready');
    child.stderr.write('token=secretvalue alex@example.test https://example.test/private\n');
    expect(jobs.current()?.logs.at(-1)?.text).not.toContain('secretvalue');
    child.stdout.write('not JSON\n'); child.close(0);
    expect((await settled(jobs)).state).toBe('failed');
    expect(await readdir(join(store.root, 'Example', 'Accounts'))).toEqual([]);
  });
  it('does not treat an exit code of zero as a verified success', async () => {
    await jobs.startSalesforce('Example'); child.close();
    expect((await settled(jobs)).state).toBe('failed');
  });
  it('handles spawn errors and releases the lock after process close', async () => {
    await jobs.startSalesforce('Example'); child.emit('error', new Error('ENOENT')); child.close(-2);
    expect((await settled(jobs)).error).toMatch(/Python could not start/);
    expect((await jobs.startSalesforce('Example')).state).toBe('running');
  });
  it('cancels on app shutdown and does not allow new jobs during shutdown', async () => {
    await jobs.startSalesforce('Example'); const stopped = jobs.shutdown();
    expect(child.commands.join('')).toContain('cancel'); child.close(2); await stopped;
    await expect(jobs.startSalesforce('Example')).rejects.toThrow(/shutting down/);
  });
});

it('validates protocol versions, count consistency and redaction', () => {
  for (const text of ['{}', '{"v":2,"type":"cancelled"}', '{"v":1,"type":"progress","processed":-1,"counts":{}}']) expect(() => parseWorkerEvent(text)).toThrow();
  expect(redactLog('password=abc Cookie=123 /Users/example/profile https://example.test')).not.toMatch(/abc|123|\/Users|https:/);
});
