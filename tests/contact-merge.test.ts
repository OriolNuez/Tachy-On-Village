import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, symlink, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { contactColumns, mergeContactCSV, commitContacts } from '../electron/contact-merge';
import { parseCSV, CadenceStore } from '../electron/cadence-files';
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
export function contactsCSV(records: Record<string, string>[]): string {
  return '\uFEFF' + [contactColumns, ...records.map(record => contactColumns.map(column => record[column] ?? (column.endsWith('Verified') ? 'Unknown' : '')))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
const person = { Name: 'Alex Example', Company: 'Example Labs', Email: 'alex@example.test', 'Email Verified': 'No', 'Diamond Verified': 'Yes', 'LinkedIn URL': 'https://www.linkedin.com/in/synthetic-example', 'Mobile Phone': '+44 07000 000001', 'Direct Phone': '0012345', 'HQ Phone': '00012', 'Other Phone': '+1 000 000 0000', 'Job Title': 'Engineer, Platform' };
describe('Cognism CSV merging', () => {
  it('preserves full fields, phone text, unknown verification and quoted content', () => {
    const merged = mergeContactCSV(null, contactsCSV([person]));
    const [record] = parseCSV(merged.content);
    expect(record.emailverified).toBe('No'); expect(record.diamondverified).toBe('Yes');
    expect(record.directphone).toBe('0012345'); expect(record.mobilephone).toBe(person['Mobile Phone']);
    expect(record.linkedinurl).toBe(person['LinkedIn URL']); expect(record.jobtitle).toBe('Engineer, Platform');
    expect(merged.counts.added).toBe(1);
  });
  it('deduplicates case/space-normalized emails without overwriting originals', () => {
    const original = contactsCSV([person]);
    const result = mergeContactCSV(original, contactsCSV([{ ...person, Name: 'Changed', Email: ' ALEX@EXAMPLE.TEST ', 'Email Verified': 'Yes' }]));
    expect(result.content).toBe(original); expect(result.counts.duplicates).toBe(1);
    expect(result.counts.review?.[0].reason).toContain('different name');
  });
  it('extends legacy columns and preserves custom data and contacted state', () => {
    const original = 'Name,Account,Position,Contacted,Notes\nExisting,Old Company,Lead,Yes,"Keep, this"\n';
    const result = mergeContactCSV(original, contactsCSV([person]));
    const rows = parseCSV(result.content);
    expect(rows[0].notes).toBe('Keep, this'); expect(rows[0].contacted).toBe('Yes');
    expect(rows[1].email).toBe(person.Email); expect(rows[1].directphone).toBe('0012345');
  });
  it('flags missing, invalid, multiple and name-only matches, without inferring verification', () => {
    const result = mergeContactCSV(contactsCSV([person]), contactsCSV([
      { ...person, Email: '' }, { ...person, Email: 'new@example.test | second@example.test', 'Email Verified': 'Mixed/Unknown' },
      { ...person, Name: 'Invalid Email', Email: 'bad-address' },
    ]));
    expect(result.counts).toMatchObject({ added: 3, missingEmails: 1 }); expect(result.counts.review).toHaveLength(3);
    const rows = parseCSV(result.content); expect(rows[1].importreview).toContain('Missing email');
    expect(rows[2].emailverified).toBe('Mixed/Unknown'); expect(rows[3].importreview).toContain('Invalid email');
    expect(mergeContactCSV(result.content, contactsCSV([{ ...person, Email: '' }])).counts.duplicates).toBe(1);
  });
  it('flags partial multi-email overlap and keeps the original record', () => {
    const result = mergeContactCSV(contactsCSV([person]), contactsCSV([{ ...person, Email: 'alex@example.test | extra@example.test' }]));
    expect(result.counts.duplicates).toBe(1); expect(result.counts.review?.[0].reason).toContain('Partial email overlap');
  });
  it('rejects malformed CSV, incomplete schemas and invented verification states', () => {
    for (const input of ['Name,Email\nX,x@example.test', '"unclosed', contactsCSV([{ ...person, 'Email Verified': 'Probably' }]), contactsCSV([{ ...person, Name: '' }])]) expect(() => mergeContactCSV(null, input)).toThrow();
  });
  it('atomically creates or appends and keeps existing bytes on validation/count failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tachyon-contact-'));
    try {
      const store = new CadenceStore(root); await store.create('Example'); const path = await store.contactsPath('Example');
      await commitContacts(path, contactsCSV([person]), 1);
      const original = await readFile(path, 'utf8');
      await expect(commitContacts(path, contactsCSV([{ ...person, Name: 'New', Email: 'new@example.test' }]), 2)).rejects.toThrow(/count/);
      expect(await readFile(path, 'utf8')).toBe(original);
      await expect(commitContacts(path, 'bad', 0)).rejects.toThrow();
      expect(await readdir(join(store.root, 'Example', 'Contacts'))).toEqual(['Example_contacts.csv']);
      await writeFile(join(root, 'outside.csv'), original);
      await rm(path); await symlink(join(root, 'outside.csv'), path);
      await expect(commitContacts(path, contactsCSV([person]), 1)).rejects.toThrow(/symbolic/);
      expect(await readFile(join(root, 'outside.csv'), 'utf8')).toBe(original);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
