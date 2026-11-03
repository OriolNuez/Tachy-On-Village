import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CadenceStore, parseCSV } from '../electron/cadence-files';
let root: string, store: CadenceStore;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'cadence-edit-')); store = new CadenceStore(root); await store.create('Example'); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
it('creates, edits and deletes real dated steps in calendar; rejects stale IDs and invalid dates', async () => {
  await store.edit('Example', { kind: 'step', type: 'linkedin', title: 'Introduce', date: '2026-11-10', contact: 'Example Person' });
  const event = (await store.calendar()).events[0];
  expect(event).toMatchObject({ type: 'linkedin', title: 'Introduce', cadence: 'Example' });
  await store.edit('Example', { kind: 'step', id: event.id, type: 'call', title: 'Discuss', date: '2026-11-11', contact: '' });
  await expect(store.edit('Example', { kind: 'step', id: event.id, remove: true })).rejects.toThrow(/changed/);
  await expect(store.edit('Example', { kind: 'step', type: 'call', title: 'Bad', date: '2026-02-30', contact: '' })).rejects.toThrow();
  const current = (await store.read('Example')).events[0];
  await store.edit('Example', { kind: 'step', id: current.id, remove: true });
  expect((await store.calendar()).events).toEqual([]);
});
it('edits and removes exactly one CSV row, preserving full fields and rejecting stale selections', async () => {
  const path = await store.contactsPath('Example');
  await writeFile(path, 'Name,Company,Phone,Email Verified,Custom\nAlex,Example,+440001,Unknown,keep\nAlex,Other,00123,Yes,also keep\n');
  const [first, second] = (await store.read('Example')).contacts;
  await store.edit('Example', { kind: 'contact', id: first.id, values: { name: 'Edited', position: 'Director' } });
  expect(parseCSV(await readFile(path, 'utf8'))[0]).toMatchObject({ name: 'Edited', phone: '+440001', emailverified: 'Unknown', custom: 'keep', position: 'Director' });
  await expect(store.edit('Example', { kind: 'contact', id: second.id, remove: true })).rejects.toThrow(/changed/);
  const current = (await store.read('Example')).contacts[1];
  await store.edit('Example', { kind: 'contact', id: current.id, remove: true });
  expect(parseCSV(await readFile(path, 'utf8'))).toHaveLength(1);
});
it('archives the full cadence outside the visible library and keeps remaining colours stable', async () => {
  await store.create('Other');
  const color = (await store.list()).cadences.find(c => c.name === 'Other')!.color;
  await writeFile(await store.accountsPath('Example'), 'Name,Custom\nExample,keep\n');
  await store.edit('Example', { kind: 'archive' });
  expect((await store.list()).cadences).toEqual([{ name: 'Other', color }]);
  const bin = join(root, '.cadence-bin');
  expect(await readFile(join(bin, (await readdir(bin))[0], 'Accounts', 'Example_accounts.csv'), 'utf8')).toContain('keep');
});
it('blocks traversal, symlink files and malformed CSV without destroying data', async () => {
  await expect(store.edit('../Example', { kind: 'archive' })).rejects.toThrow();
  const path = await store.accountsPath('Example');
  const outside = join(root, 'outside.csv'); await writeFile(outside, 'Name\nKeep\n'); await symlink(outside, path);
  await expect(store.edit('Example', { kind: 'account', id: 'invalid', remove: true })).rejects.toThrow();
  expect(await readFile(outside, 'utf8')).toBe('Name\nKeep\n');
});
it('persists manual reply marks per email attempt without changing sent data or other replies', async () => {
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  await store.edit('Example', { kind: 'reply', id: a, replied: true });
  await store.edit('Example', { kind: 'reply', id: b, replied: true });
  await store.edit('Example', { kind: 'reply', id: a, replied: false });
  expect((await new CadenceStore(root).read('Example')).replies).toEqual({ [a]: false, [b]: true });
  await expect(store.edit('Example', { kind: 'reply', id: '../escape', replied: true })).rejects.toThrow();
  expect((await store.read('Example')).outreach).toEqual([]);
});
