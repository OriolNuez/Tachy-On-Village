import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { CadenceError, parseCSVDocument } from './cadence-files';
import { readAccountFile } from './account-merge';
import { isDateOnly, isSalesforceLink } from '../shared/cadences';

export const snapshotId = (text: string, index: number) => createHash('sha256').update(text).digest('hex') + ':' + index;
const normalized = (s: string) => s.trim().toLowerCase().replace(/[ _-]/g, '');
async function directory(path: string) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CadenceError('Unsupported cadence directory.');
}
export async function editCadence(root: string, name: string, input: unknown): Promise<void> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CadenceError('Invalid edit.');
  const change = input as Record<string, unknown>;
  await directory(root); await directory(join(root, name));
  if (change.kind === 'archive') {
    if (Object.keys(change).length !== 1) throw new CadenceError('Invalid archive request.');
    const bin = join(root, '..', '.cadence-bin');
    await mkdir(bin, { recursive: true, mode: 0o700 }); await directory(bin);
    await rename(join(root, name), join(bin, name + '--' + randomUUID()));
    return;
  }
  if (!['reply', 'step', 'account', 'contact'].includes(String(change.kind)) || Object.keys(change).some(k => !['kind', 'id', 'remove', 'values', 'title', 'date', 'contact', 'type', 'replied'].includes(k)) || (change.remove !== undefined && typeof change.remove !== 'boolean')) throw new CadenceError('Invalid edit.');
  const group = change.kind === 'step' || change.kind === 'reply' ? 'Storage' : change.kind === 'account' ? 'Accounts' : 'Contacts';
  const folder = join(root, name, group);
  await directory(folder);
  const path = join(folder, name + (change.kind === 'reply' ? '_replies.json' : change.kind === 'step' ? '_steps.json' : change.kind === 'account' ? '_accounts.csv' : '_contacts.csv'));
  const lockPath = join(folder, change.kind === 'account' ? '.accounts-merge.lock' : change.kind === 'contact' ? '.contacts-merge.lock' : '.steps-edit.lock');
  const lock = await open(lockPath, 'wx', 0o600).catch(() => { throw new CadenceError('These records are being edited. Try again after the other save finishes.'); });
  const temporary = join(folder, '.edit-' + randomUUID() + '.tmp');
  try {
    const existing = await readAccountFile(path, true);
    let content: string;
    if (change.kind === 'reply') {
      if (typeof change.id !== 'string' || !/^[a-f0-9]{64}$/.test(change.id) || typeof change.replied !== 'boolean' || Object.keys(change).some(k => !['kind', 'id', 'replied'].includes(k))) throw new CadenceError('Invalid reply record.');
      const replies = readReplies(existing);
      replies[change.id] = change.replied;
      if (Object.keys(replies).length > 10000) throw new CadenceError('Too many reply records.');
      content = JSON.stringify(replies, null, 2);
    } else if (change.kind === 'step') {
      const steps = readSteps(existing);
      const index = steps.findIndex((_row, i) => snapshotId(existing ?? '', i) === change.id);
      if (change.id !== undefined && index < 0 || change.remove && index < 0) throw new CadenceError('Next steps changed. Refresh before editing.');
      if (change.remove) steps.splice(index, 1);
      else {
        if (!['email', 'linkedin', 'call'].includes(String(change.type)) || !isDateOnly(change.date) || typeof change.title !== 'string' || !change.title.trim() || change.title.length > 250 || typeof change.contact !== 'string' || change.contact.length > 250) throw new CadenceError('Choose a type, title and valid date.');
        const row = { type: change.type, title: change.title.trim(), date: change.date, contact: change.contact.trim() };
        if (index >= 0) steps[index] = row; else steps.push(row);
      }
      if (steps.length > 10000) throw new CadenceError('Too many next steps.');
      content = JSON.stringify(steps, null, 2);
    } else {
      const doc = parseCSVDocument(existing ?? '');
      const index = doc.rows.findIndex((_row, i) => snapshotId(existing ?? '', i) === change.id);
      if (index < 0) throw new CadenceError('Records changed. Refresh before editing.');
      if (change.remove) doc.rows.splice(index, 1);
      else {
        const fields: Record<string, string[]> = change.kind === 'account'
          ? { name: ['Account Name', 'Account', 'Name'], salesforceLink: ['Salesforce URL', 'Salesforce Link', 'Link'] }
          : { name: ['Name', 'Contact Name'], account: ['Account', 'Company', 'Account Name'], position: ['Position', 'Job Title', 'Title'], contacted: ['Contacted'] };
        if (!change.values || typeof change.values !== 'object' || Array.isArray(change.values)) throw new CadenceError('Invalid record fields.');
        const values = change.values as Record<string, unknown>;
        if (!Object.keys(values).length || Object.keys(values).some(k => !Object.hasOwn(fields, k)) || Object.values(values).some(v => typeof v !== 'string' || v.length > 2048 || v.includes('\0')) || typeof values.name !== 'string' || !values.name.trim()) throw new CadenceError('Enter a valid name and record fields.');
        if (values.salesforceLink && !isSalesforceLink(values.salesforceLink)) throw new CadenceError('Use an HTTPS Salesforce link.');
        for (const [field, value] of Object.entries(values)) {
          const aliases = fields[field];
          const indexes = doc.headers.flatMap((h, i) => aliases.map(normalized).includes(normalized(h)) ? [i] : []);
          if (!indexes.length) { indexes.push(doc.headers.length); doc.headers.push(aliases[0]); doc.rows.forEach(row => row.push('')); }
          for (const column of indexes) doc.rows[index][column] = value as string;
        }
      }
      const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
      content = [doc.headers, ...doc.rows].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
    }
    if (Buffer.byteLength(content) > 5 * 1024 * 1024) throw new CadenceError('File exceeds the supported size.');
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
    await directory(folder);
    if (await readAccountFile(path, true) !== existing) throw new CadenceError('Records changed during saving. Refresh and retry.');
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); await lock.close(); await unlink(lockPath); }
}
export function readSteps(text: string | null): Record<string, unknown>[] {
  const rows: unknown = text === null ? [] : JSON.parse(text);
  if (!Array.isArray(rows) || rows.length > 10000 || rows.some(row => !row || typeof row !== 'object' || !['email', 'linkedin', 'call'].includes(row.type) || typeof row.title !== 'string' || !isDateOnly(row.date) || typeof row.contact !== 'string')) throw new CadenceError('Invalid next steps file.');
  return rows;
}

export function readReplies(text: string | null): Record<string, boolean> {
  const data: unknown = text === null ? {} : JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length > 10000 || Object.entries(data).some(([id, value]) => !/^[a-f0-9]{64}$/.test(id) || typeof value !== 'boolean')) throw new CadenceError('Invalid replies file.');
  return data as Record<string, boolean>;
}
