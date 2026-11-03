import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isSalesforceLink } from '../shared/cadences';
import type { MergeCounts } from '../shared/jobs';
import { CadenceError, parseCSVDocument } from './cadence-files';

const LIMIT = 5 * 1024 * 1024;
const normalize = (text: string) => text.trim().toLowerCase().replace(/[ _-]/g, '');
const columns = ['Account Name', 'Salesforce Account ID', 'Salesforce URL'];

export function accountKey(id: string): string {
  if (!/^001[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?$/.test(id)) throw new CadenceError('An account has an invalid Salesforce Account ID. Existing data was not changed.');
  if (id.length === 18) return id.toUpperCase();
  let suffix = '';
  for (let group = 0; group < 3; group++) {
    let bits = 0;
    for (let i = 0; i < 5; i++) if (/[A-Z]/.test(id[group * 5 + i])) bits += 1 << i;
    suffix += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'[bits];
  }
  return (id + suffix).toUpperCase();
}
function indexes(headers: string[]): number[] {
  const keys = headers.map(normalize);
  return [
    keys.findIndex(key => ['accountname', 'account', 'name'].includes(key)),
    keys.indexOf('salesforceaccountid'),
    keys.findIndex(key => ['salesforceurl', 'salesforcelink', 'link'].includes(key)),
  ];
}
const quote = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function mergeAccountCSV(existing: string | null, incoming: string): { content: string; counts: MergeCounts; imported: number } {
  const source = parseCSVDocument(incoming);
  const sourceIndexes = indexes(source.headers);
  if (sourceIndexes.includes(-1)) throw new CadenceError('Export needs Account Name, Salesforce Account ID and Salesforce URL columns.');
  const target = existing?.trim() ? parseCSVDocument(existing) : { headers: columns, rows: [] };
  const targetIndexes = indexes(target.headers);
  if (targetIndexes.includes(-1)) throw new CadenceError('Existing accounts need a Salesforce Account ID column and account name/link columns before they can be merged. Existing data was not changed.');
  const seen = new Set(target.rows.map(row => accountKey(row[targetIndexes[1]])));
  const additions: string[][] = [];
  let duplicates = 0;
  for (const row of source.rows) {
    const name = row[sourceIndexes[0]], id = row[sourceIndexes[1]], url = row[sourceIndexes[2]];
    const key = accountKey(id);
    if (!name.trim() || !isSalesforceLink(url)) throw new CadenceError('Export contains an empty account name or unsupported Salesforce URL. Existing data was not changed.');
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const addition = target.headers.map(() => '');
    targetIndexes.forEach((index, i) => { addition[index] = [name, id, url][i]; });
    additions.push(addition);
  }
  if (target.rows.length + additions.length > 10000) throw new CadenceError('Merged accounts exceed the 10,000-row limit. Existing data was not changed.');
  let content = existing?.trim() ? existing : '\uFEFF' + target.headers.map(quote).join(',') + '\r\n';
  if (additions.length) content += (/[\r\n]$/.test(content) ? '' : '\r\n') + additions.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  if (Buffer.byteLength(content) > LIMIT) throw new CadenceError('Merged accounts exceed the 5 MB limit. Existing data was not changed.');
  return { content, counts: { added: additions.length, duplicates, total: target.rows.length + additions.length }, imported: source.rows.length };
}

export async function readAccountFile(path: string, missing = false): Promise<string | null> {
  let file;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new CadenceError('Account CSV must be a regular file, not a symbolic link.');
    file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if ((await file.stat()).size > LIMIT) throw new CadenceError('Account CSV exceeds the 5 MB limit.');
    const buffer = Buffer.alloc(LIMIT + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > LIMIT) throw new CadenceError('Account CSV exceeds the 5 MB limit.');
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length));
  } catch (error) {
    if (missing && error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  } finally { await file?.close(); }
}

// Write in the destination directory so rename is atomic on one filesystem.
// Re-check the file and directory before committing; never merge an old snapshot
// over edits made while the browser was open.
export async function commitAccounts(path: string, incoming: string, exported: number): Promise<MergeCounts> {
  const lockPath = join(dirname(path), '.accounts-merge.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new CadenceError('Accounts are locked by another save, or a previous save was interrupted. Check .accounts-merge.lock after closing other app instances. Existing data was not changed.'); }
  try { return await commitLocked(path, incoming, exported); }
  finally { await lock.close().catch(() => {}); await unlink(lockPath).catch(() => {}); }
}

async function commitLocked(path: string, incoming: string, exported: number): Promise<MergeCounts> {
  const directory = await realpath(dirname(path));
  const existing = await readAccountFile(path, true);
  const merged = mergeAccountCSV(existing, incoming);
  if (merged.imported !== exported) throw new CadenceError('Exported row count does not match the worker result. Existing data was not changed.');
  if (!merged.counts.added && existing !== null) return merged.counts;
  const temporary = join(dirname(path), `.accounts-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(merged.content, 'utf8'); await file.sync(); }
    finally { await file.close(); }
    if (await realpath(dirname(path)) !== directory || await readAccountFile(path, true) !== existing) throw new CadenceError('Accounts changed during the merge. Refresh and export again; existing data was not changed.');
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
  return merged.counts;
}
