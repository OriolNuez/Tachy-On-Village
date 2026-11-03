import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CadenceStore } from '../electron/cadence-files';
import { OutlookPlans, outlookSettings } from '../electron/outlook-plan';
import type { OutlookSettings } from '../shared/outlook';
const settings: OutlookSettings = { subject: 'Hello {company}', body: 'Hi {first_name},\nExample body.', limit: 3, verifiedOnly: true, signature: false };
const csv = 'Name,Company,Email,Email Verified,Import Review,Opt Out\nAlex Example,Example Labs,alex@example.test,Yes,,\nOther Example,Example Labs,other@example.test,Unknown,,\nNo Email,Example Labs,,Yes,,\nReview Example,Example Labs,review@example.test,Yes,Review missing company,\nOpted Example,Example Labs,opted@example.test,Yes,,Yes\n';
describe('Outlook draft preview and consent snapshots', () => {
  let root: string, store: CadenceStore, plans: OutlookPlans;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tachyon-outlook-plan-'));
    store = new CadenceStore(join(root, 'Tachyon')); await store.create('Example');
    await writeFile(await store.contactsPath('Example'), csv);
    plans = new OutlookPlans(store, join(root, 'appdata'), resolve('backend'));
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  it('previews exact recipients/body and excludes unverified, missing, flagged and opted-out contacts', async () => {
    const preview = await plans.preview('Example', settings);
    expect(preview.selected).toHaveLength(1); expect(preview.skipped).toHaveLength(4);
    expect(preview.selected[0]).toMatchObject({ email: 'alex@example.test', subject: 'Hello Example Labs', body: 'Hi Alex,\nExample body.' });
    expect((await plans.preview('Example', { ...settings, verifiedOnly: false })).selected).toHaveLength(2);
  });
  it('reads original default template as source without importing Python', async () => {
    const defaults = await plans.defaults();
    expect(defaults.subject).toBe('Student enquiries at {university}'); expect(defaults.body).toContain('{first_name}'); expect(defaults.limit).toBe(3);
  });
  it('honors opt-outs in other cadences', async () => {
    await store.create('Other');
    await writeFile(await store.contactsPath('Other'), 'Name,Email,Do Not Contact\nAlex,ALEX@EXAMPLE.TEST,true\n');
    expect((await plans.preview('Example', settings)).selected).toHaveLength(0);
  });
  it('rejects commands/paths, invalid quantities and unknown placeholders', () => {
    for (const value of [{ ...settings, step: 0 }, { ...settings, step: 101 }, { ...settings, step: '2' }, { ...settings, limit: 0 }, { ...settings, limit: 101 }, { ...settings, subject: '{unknown}' }, { ...settings, executable: 'python' }, { ...settings, subject: 'a\nb' }]) expect(() => outlookSettings(value)).toThrow();
  });
  it('consumes a preview once and rejects edits before launch or while logging in', async () => {
    const workspace = join(root, 'job'); await mkdir(workspace);
    const preview = await plans.preview('Example', { ...settings, step: 2 });
    const request = await plans.consume('Example', preview.token, workspace);
    expect(JSON.parse(await readFile(request.request, 'utf8')).drafts[0].email).toBe('alex@example.test');
    expect(JSON.parse(await readFile(request.request, 'utf8')).step).toBe(2);
    expect(JSON.parse(await readFile(request.request, 'utf8')).batchId).toBeTruthy();
    await plans.assertUnchanged('Example');
    await expect(plans.consume('Example', preview.token, workspace)).rejects.toThrow(/Preview/);
    await writeFile(await store.contactsPath('Example'), csv + 'New,Example,new@example.test,Yes,,\n');
    await expect(plans.assertUnchanged('Example')).rejects.toThrow(/changed/);
    const second = await plans.preview('Example', settings);
    await writeFile(await store.contactsPath('Example'), csv);
    await expect(plans.consume('Example', second.token, workspace)).rejects.toThrow(/changed/);
  });
  it('persists uncertainty across restarts and blocks the email even with a changed template', async () => {
    const preview = await plans.preview('Example', settings); const draft = preview.selected[0];
    await mkdir(plans.stateDirectory, { recursive: true });
    await writeFile(plans.ledgerPath, JSON.stringify({ [draft.id]: { cadence: 'Example', name: draft.name, email: draft.email, subject: draft.subject, status: 'attempt_started', attemptedAt: new Date().toISOString() } }));
    const restarted = new OutlookPlans(store, join(root, 'appdata'), resolve('backend'));
    const next = await restarted.preview('Example', { ...settings, subject: 'Different subject' });
    expect(next.selected).toHaveLength(0); expect(next.history[0].status).toBe('attempt_started');
    await writeFile(plans.ledgerPath, 'broken JSON');
    await expect(restarted.preview('Example', settings)).rejects.toThrow(/history/);
  });
});
