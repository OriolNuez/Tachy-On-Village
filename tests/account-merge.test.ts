import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountKey, commitAccounts, mergeAccountCSV } from '../electron/account-merge';

const header = 'Account Name,Salesforce Account ID,Salesforce URL';
const row = (id: string, name = 'Example Account') => `${name},${id},https://example.my.salesforce.com/${id}`;
const first = '001000000000001', second = '001000000000002';

describe('Salesforce accounts merge', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'tachyon-merge-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  it('appends only new IDs and preserves all existing bytes, columns and values', async () => {
    const existing = '\uFEFFNotes,Salesforce Account ID,Account Name,Salesforce Link\r\n"Keep, exactly",001000000000001,Original name,https://example.my.salesforce.com/old';
    const incoming = header + '\n' + [row(first, 'Changed name'), row(second), row(second)].join('\n');
    const merged = mergeAccountCSV(existing, incoming);
    expect(merged.content.startsWith(existing + '\r\n')).toBe(true);
    expect(merged.counts).toEqual({ added: 1, duplicates: 2, total: 2 });
    expect(merged.content).not.toContain('Changed name');
    const target = join(root, 'accounts.csv');
    await writeFile(target, existing);
    expect(await commitAccounts(target, incoming, 3)).toEqual(merged.counts);
    expect(await readFile(target, 'utf8')).toBe(merged.content);
    expect(await readdir(root)).toEqual(['accounts.csv']);
  });
  it('recognises 15/18-character representations of the same Salesforce ID', () => {
    const id = '001Aa00000000Bc';
    const canonical = accountKey(id);
    expect(canonical).toHaveLength(18);
    expect(accountKey(canonical)).toBe(canonical);
    expect(accountKey(canonical.toLowerCase())).toBe(canonical);
    const merged = mergeAccountCSV(header + '\n' + row(id), header + '\n' + row(canonical));
    expect(merged.counts.added).toBe(0);
    expect(merged.counts.duplicates).toBe(1);
  });
  it('creates a header-only file for a genuinely empty successful export', async () => {
    const target = join(root, 'accounts.csv');
    expect(await commitAccounts(target, header + '\n', 0)).toEqual({ added: 0, duplicates: 0, total: 0 });
    expect(await readFile(target, 'utf8')).toBe('\uFEFF' + header + '\r\n');
  });
  it('never alters existing data for malformed exports, missing IDs or count mismatch', async () => {
    const target = join(root, 'accounts.csv'), existing = header + '\n' + row(first);
    await writeFile(target, existing);
    for (const invalid of ['broken', header + '\n"unclosed', header + '\n' + row('invalid'), header + '\nMissing,001000000000002,javascript:alert(1)']) {
      await expect(commitAccounts(target, invalid, 1)).rejects.toThrow();
      expect(await readFile(target, 'utf8')).toBe(existing);
    }
    await expect(commitAccounts(target, header + '\n' + row(second), 2)).rejects.toThrow(/count/);
    expect(await readFile(target, 'utf8')).toBe(existing);
    await writeFile(target, 'Account Name,Link\nExisting,https://example.salesforce.com');
    await expect(commitAccounts(target, header + '\n' + row(second), 1)).rejects.toThrow(/ID column/);
    expect(await readFile(target, 'utf8')).toBe('Account Name,Link\nExisting,https://example.salesforce.com');
  });
  it('blocks symlink targets and competing save locks', async () => {
    const external = join(root, 'external.csv'), target = join(root, 'accounts.csv');
    await writeFile(external, 'original'); await symlink(external, target);
    await expect(commitAccounts(target, header + '\n' + row(second), 1)).rejects.toThrow(/symbolic/);
    expect(await readFile(external, 'utf8')).toBe('original');
    await writeFile(join(root, '.accounts-merge.lock'), 'another writer');
    await expect(commitAccounts(target, header, 0)).rejects.toThrow(/locked/);
    expect(await readFile(join(root, '.accounts-merge.lock'), 'utf8')).toBe('another writer');
  });
});
