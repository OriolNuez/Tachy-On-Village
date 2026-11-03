import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CadenceStore, parseCSV, parseOutreach } from '../electron/cadence-files';
import { cadenceNameError, isDateOnly, isSalesforceLink } from '../shared/cadences';
import { dateKey, monthDays, shiftMonth } from '../frontend/cadences/calendar-model';

describe('cadence files in an isolated synthetic library', () => {
  let folder: string;
  let store: CadenceStore;
  beforeEach(async () => { folder = await mkdtemp(join(tmpdir(), 'tachyon-unit-')); store = new CadenceStore(join(folder, 'Tachyon')); });
  afterEach(async () => { await rm(folder, { recursive: true, force: true }); });
  it('lists a missing root without writing and persists a complete empty cadence', async () => {
    expect((await store.list()).cadences).toEqual([]);
    expect(await readdir(folder)).toEqual([]);
    expect((await store.create('Autumn outreach')).name).toBe('Autumn outreach');
    expect((await readdir(join(store.root, 'Autumn outreach'))).sort()).toEqual(['Accounts', 'Contacts', 'Storage']);
    const reopened = new CadenceStore(join(folder, 'Tachyon'));
    expect((await reopened.list()).cadences.map(c => c.name)).toEqual(['Autumn outreach']);
    expect(await reopened.read('Autumn outreach')).toEqual({ name: 'Autumn outreach', accounts: [], contacts: [], outreach: [], events: [], warnings: [] });
  });
  it('rejects duplicates, including concurrent and case-insensitive requests, without overwriting', async () => {
    const results = await Promise.allSettled([store.create('Example'), store.create('example')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const file = join(store.root, 'Example', 'Storage', 'keep.txt');
    await writeFile(file, 'preserve me');
    await expect(store.create('EXAMPLE')).rejects.toThrow(/already exists/);
    expect(await readFile(file, 'utf8')).toBe('preserve me');
  });
  it.each(['../escape', '..', '/absolute', 'C:\\escape', 'a/b', 'a\\b', '.hidden', 'name.', 'trailing ', 'CON', 'nul', 'LPT9', '', 'x'.repeat(81), 'one\nline', 'a:b', '\u0000'])('rejects invalid name %j before filesystem access', async name => {
    await expect(store.create(name)).rejects.toThrow();
    await expect(store.read(name)).rejects.toThrow();
    expect(await readdir(folder)).toEqual([]);
  });
  it('accepts normal international names and rejects non-string payloads', async () => {
    expect(cadenceNameError('Équipe 2026_秋-01')).toBeNull();
    for (const value of [null, {}, ['Example'], 42]) await expect(store.create(value)).rejects.toThrow();
  });
  it('loads original exporter headers and preserves explicit states without inferring sends', async () => {
    await store.create('Example');
    await writeFile(join(store.root, 'Example', 'Accounts', 'Example_accounts.csv'), '\uFEFFAccount Name,Salesforce Account ID,Salesforce URL\r\n"Example, Ltd",demo,https://example.lightning.force.com/lightning/r/Account/demo/view\r\n');
    await writeFile(join(store.root, 'Example', 'Contacts', 'Example_contacts.csv'), 'Name,Company,Job Title,Mobile Phone\nAlex Example,"Example, Ltd",Researcher,+441234567890\n');
    await writeFile(join(store.root, 'Example', 'Storage', 'Example_outreach.json'), JSON.stringify({ outreach: [{ contact: 'Alex Example', drafted: true }], events: [{ title: 'Recorded review', date: '2026-11-03' }] }));
    const detail = await store.read('Example');
    expect(detail.warnings).toEqual([]);
    expect(detail.accounts[0].name).toBe('Example, Ltd');
    expect(detail.contacts[0]).toMatchObject({ name: 'Alex Example', account: 'Example, Ltd', position: 'Researcher', contacted: 'Unknown' });
    expect(detail.outreach[0]).toEqual({ contact: 'Alex Example', sent: 'Unknown', replied: 'Unknown' });
    expect((await store.calendar()).events).toEqual([{ cadence: 'Example', title: 'Recorded review', date: '2026-11-03', contact: '' }]);
  });
  it('isolates malformed files and reports issues without leaking their contents', async () => {
    await store.create('Example');
    await writeFile(join(store.root, 'Example', 'Accounts', 'Example_accounts.csv'), 'Account Name,Link\n"unclosed');
    await writeFile(join(store.root, 'Example', 'Contacts', 'Example_contacts.csv'), 'Name,Account,Position,Contacted\nAlex Example,Example,Director,No');
    await writeFile(join(store.root, 'Example', 'Storage', 'Example_outreach.json'), '{private invalid data');
    const result = await store.read('Example');
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.join(' ')).not.toContain('private invalid data');
    expect(result.contacts[0].contacted).toBe('No');
    expect((await store.calendar()).events).toEqual([]);
    expect((await store.calendar()).warnings).toHaveLength(1);
  });
  it('blocks symlink roots, cadence directories, subfolders, and data files', async () => {
    const outside = join(folder, 'outside');
    await mkdir(outside);
    await mkdir(join(folder, 'Tachyon'));
    await symlink(outside, store.root, 'dir');
    await expect(store.list()).rejects.toThrow(/symbolic/);
    await expect(store.create('Example')).rejects.toThrow(/symbolic/);
    await rm(store.root);
    await store.create('Example');
    await symlink(outside, join(store.root, 'Linked'), 'dir');
    expect((await store.list()).cadences).toHaveLength(1);
    await expect(store.read('Linked')).rejects.toThrow(/symbolic/);
    await rm(join(store.root, 'Example', 'Accounts'), { recursive: true });
    await symlink(outside, join(store.root, 'Example', 'Accounts'), 'dir');
    const externalFile = join(outside, 'contacts.csv');
    await writeFile(externalFile, 'Name\nPrivate Example');
    await symlink(externalFile, join(store.root, 'Example', 'Contacts', 'Example_contacts.csv'));
    const detail = await store.read('Example');
    expect(detail.contacts).toEqual([]);
    expect(detail.warnings).toHaveLength(2);
    expect(await readdir(outside)).toEqual(['contacts.csv']);
  });
  it('rejects oversized data and handles removed cadences', async () => {
    await store.create('Example');
    await writeFile(join(store.root, 'Example', 'Storage', 'Example_outreach.json'), 'x'.repeat(5 * 1024 * 1024 + 1));
    expect((await store.read('Example')).warnings[0]).toMatch(/5 MB/);
    await rm(join(store.root, 'Example'), { recursive: true });
    await expect(store.read('Example')).rejects.toThrow(/no longer available/);
  });
  it('assigns distinct colours and never generates calendar events from contacts or cadences', async () => {
    await store.create('Example'); await store.create('Second');
    expect(new Set((await store.list()).cadences.map(c => c.color)).size).toBe(2);
    expect((await store.calendar()).events).toEqual([]);
  });
});

describe('file formats and allowed links', () => {
  it('parses quoted multiline CSV and keeps phone strings intact', () => {
    expect(parseCSV('Name,Phone,Notes\r\n"Alex ""A"" Example",+440001,"line one\nline two"\r\n')).toEqual([{ name: 'Alex "A" Example', phone: '+440001', notes: 'line one\nline two' }]);
    expect(parseCSV('')).toEqual([]);
    expect(() => parseCSV('Name,Name\nA,B')).toThrow(/unique/);
    expect(() => parseCSV('Name,Account\nA')).toThrow(/headers/);
    expect(() => parseCSV('Name\n"A"invalid')).toThrow(/quoting/);
  });
  it('keeps true, false, missing, and recorded string statuses separate', () => {
    expect(parseOutreach('[{"contact":"Example","sent":false,"replied":true},{"contact":"Other","sent":"2026-11-01"}]', 'One').outreach).toEqual([{ contact: 'Example', sent: 'No', replied: 'Yes' }, { contact: 'Other', sent: '2026-11-01', replied: 'Unknown' }]);
    for (const data of ['null', '{}', '{"events":{}}', '{"outreach":[{}]}', '{"events":[{"title":"Invalid","date":"2026-02-30"}]}']) expect(() => parseOutreach(data, 'One')).toThrow();
  });
  it('restricts external links to HTTPS Salesforce domains', () => {
    expect(isSalesforceLink('https://example.lightning.force.com/lightning/r/Account/demo/view')).toBe(true);
    expect(isSalesforceLink('https://example.my.salesforce.com/demo')).toBe(true);
    for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'https://salesforce.com.evil.test', 'https://evilforce.com', 'https://user:pass@salesforce.com', 'http://salesforce.com', 'https://salesforce.com:8443', null]) expect(isSalesforceLink(value)).toBe(false);
  });
});

describe('monthly calendar dates', () => {
  it('starts on Monday, includes leap days, and handles year changes without UTC shifts', () => {
    const days = monthDays(new Date(2024, 1, 1, 12));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(dateKey(days[0])).toBe('2024-01-29');
    expect(days.map(dateKey)).toContain('2024-02-29');
    expect(dateKey(shiftMonth(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2024-02-29')).toBe(true);
  });
});
