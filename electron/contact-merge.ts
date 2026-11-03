import { open, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CadenceError, parseCSVDocument } from './cadence-files';
import { readAccountFile } from './account-merge';
import type { MergeCounts } from '../shared/jobs';

export const contactColumns = ['Name', 'Job Title', 'Company', 'Company Domain', 'LinkedIn URL', 'Email', 'Email Verified', 'Mobile Phone', 'Direct Phone', 'HQ Phone', 'Other Phone', 'Diamond Verified'];
const reviewColumn = 'Import Review';
const key = (value: string) => value.trim().toLowerCase().replace(/[ _-]/g, '');
const normalize = (value: string) => value.trim().normalize('NFC').toLowerCase();
const quote = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const emails = (value: string) => value.split('|').map(normalize).filter(Boolean);
const validEmail = (value: string) => /^[^\s@|,;]+@[^\s@|,;]+\.[^\s@|,;]+$/.test(value);

export function mergeContactCSV(existing: string | null, incoming: string): { content: string; counts: MergeCounts; imported: number } {
  const source = parseCSVDocument(incoming);
  const sourceKeys = source.headers.map(key);
  if (contactColumns.some(column => !sourceKeys.includes(key(column)))) throw new CadenceError('Cognism export is missing required contact columns. Existing data was not changed.');
  const target = existing?.trim() ? parseCSVDocument(existing) : { headers: [...contactColumns, reviewColumn], rows: [] };
  const targetKeys = target.headers.map(key);
  if (existing?.trim() && !targetKeys.includes('name') && !targetKeys.includes('contactname')) throw new CadenceError('Existing contact CSV needs a Name column. Existing data was not changed.');
  // Union of columns preserves all existing values and all Cognism fields, even in older cadence schemas.
  const headers = [...target.headers];
  for (const column of [...source.headers, reviewColumn]) if (!headers.some(h => key(h) === key(column))) headers.push(column);
  const keys = headers.map(key);
  const mapRow = (row: string[], from: string[]) => keys.map(k => row[from.indexOf(k)] ?? '');
  const rows = target.rows.map(row => mapRow(row, targetKeys));
  const emailIndex = keys.indexOf('email'), nameIndex = keys.indexOf('name'), companyIndex = keys.indexOf('company');
  const reviewIndex = keys.indexOf(key(reviewColumn));
  const identity = (row: string[]) => [row[nameIndex] || row[keys.indexOf('contactname')], row[companyIndex] || row[keys.indexOf('account')]].map(value => normalize(value ?? '')).join('\0');
  const seen = new Map<string, string>();
  const identities = new Set<string>();
  const signatures = new Set<string>();
  const signature = (row: string[]) => JSON.stringify(contactColumns.map(column => row[keys.indexOf(key(column))]));
  for (const row of rows) {
    for (const email of emails(row[emailIndex])) if (validEmail(email)) seen.set(email, identity(row));
    identities.add(identity(row)); signatures.add(signature(row));
  }
  const counts: MergeCounts = { added: 0, duplicates: 0, total: rows.length, missingEmails: 0, review: [] };
  source.rows.forEach((raw, index) => {
    const row = mapRow(raw, sourceKeys);
    if (!row[nameIndex].trim()) throw new CadenceError('Cognism export contains an empty contact name. Existing data was not changed.');
    for (const column of ['Email Verified', 'Diamond Verified']) {
      const value = row[keys.indexOf(key(column))];
      if (!['Yes', 'No', 'Unknown', 'Mixed/Unknown'].includes(value)) throw new CadenceError('Cognism export has an unsupported verification value. Existing data was not changed.');
    }
    const addresses = [...new Set(emails(row[emailIndex]))];
    const reasons: string[] = [];
    if (!addresses.length) { counts.missingEmails!++; reasons.push('Missing email'); }
    if (addresses.some(email => !validEmail(email))) reasons.push('Invalid email format');
    if (addresses.length > 1) reasons.push('Multiple emails; review before use');
    const matches = addresses.filter(email => validEmail(email) && seen.has(email));
    if (matches.some(email => seen.get(email) !== identity(row))) reasons.push('Email matches a different name or company');
    if (identities.has(identity(row)) && !matches.length) reasons.push('Name/company match without matching email');
    const duplicate = matches.length > 0 || signatures.has(signature(row));
    if (matches.length && addresses.some(email => !matches.includes(email))) reasons.push('Partial email overlap; existing record retained');
    if (reasons.length) counts.review!.push({ row: index + 2, name: row[nameIndex], company: row[companyIndex], email: row[emailIndex], reason: reasons.join('; '), skipped: duplicate });
    if (duplicate) { counts.duplicates++; return; }
    row[reviewIndex] = [row[reviewIndex], ...reasons].filter(Boolean).join('; ');
    rows.push(row); counts.added++;
    for (const email of addresses) if (validEmail(email)) seen.set(email, identity(row));
    identities.add(identity(row)); signatures.add(signature(row));
  });
  counts.total = rows.length;
  if (rows.length > 10000) throw new CadenceError('Merged contacts exceed the 10,000-row limit.');
  // No rewrite at all for a duplicate-only run. Otherwise retain every existing cell, including custom columns.
  const content = !counts.added && existing !== null ? existing : '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  if (Buffer.byteLength(content) > 5 * 1024 * 1024) throw new CadenceError('Merged contacts exceed the 5 MB limit.');
  return { content, counts, imported: source.rows.length };
}

export async function commitContacts(path: string, incoming: string, exported: number): Promise<MergeCounts> {
  const lockPath = join(dirname(path), '.contacts-merge.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new CadenceError('Contacts are locked by another save. Check .contacts-merge.lock after closing other instances; existing data was not changed.'); }
  const temporary = join(dirname(path), `.contacts-${randomUUID()}.tmp`);
  try {
    const directory = await realpath(dirname(path));
    const existing = await readAccountFile(path, true);
    const merged = mergeContactCSV(existing, incoming);
    if (merged.imported !== exported) throw new CadenceError('Contact export row count does not match the worker result.');
    if (!merged.counts.added && existing !== null) return merged.counts;
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(merged.content, 'utf8'); await file.sync(); } finally { await file.close(); }
    if (await realpath(dirname(path)) !== directory || await readAccountFile(path, true) !== existing) throw new CadenceError('Contacts changed during the merge; existing data was not changed.');
    await rename(temporary, path);
    return merged.counts;
  } finally {
    await unlink(temporary).catch(() => {});
    await lock.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}
