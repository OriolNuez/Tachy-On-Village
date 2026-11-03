import { editCadence, readReplies, readSteps, snapshotId } from './cadence-edits';
import type { StepKind } from '../shared/cadence-edits';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rmdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { cadenceNameError, isDateOnly, type CadenceDetail, type CadenceLibrary, type CalendarData } from '../shared/cadences';

export class CadenceError extends Error {}
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10000;
const key = (value: string) => value.normalize('NFC').toLocaleLowerCase('en-US');
const header = (value: string) => value.trim().toLowerCase().replace(/[ _-]/g, '');
const hasCode = (error: unknown, code: string) => error instanceof Error && 'code' in error && error.code === code;

// Quoted commas, CRLF, escaped quotes, UTF-8 BOM and embedded newlines are supported.
export function parseCSVDocument(source: string): { headers: string[]; rows: string[][] } {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  const pushField = () => { row.push(field); field = ''; closed = false; };
  const pushRow = () => {
    pushField();
    if (row.some(value => value.trim())) rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new CadenceError('File exceeds the 10,000-row limit.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',') pushField();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (closed || c === '"') throw new CadenceError('CSV has invalid quoting.');
    else field += c;
  }
  if (quoted) throw new CadenceError('CSV contains an unclosed quoted field.');
  if (field || row.length || closed) pushRow();
  const headers = rows.shift() ?? [];
  const keys = headers.map(header);
  if (keys.some(h => !h) || new Set(keys).size !== keys.length) throw new CadenceError('CSV needs unique, non-empty column headers.');
  for (const values of rows) {
    if (values.length !== headers.length) throw new CadenceError('CSV rows do not match the column headers.');
  }
  return { headers, rows };
}
export function parseCSV(source: string): Record<string, string>[] {
  const { headers, rows } = parseCSVDocument(source);
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [header(h), values[i]])));
}

function pick(row: Record<string, string>, ...names: string[]) {
  return names.map(name => row[header(name)]).find(value => value?.trim()) ?? '';
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function cell(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'string' && value.trim() ? value : 'Unknown';
}

export function parseOutreach(text: string, cadence: string): Pick<CadenceDetail, 'outreach' | 'events'> {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data) && !record(data)) throw new CadenceError('Outreach JSON must be an array or an object with outreach and/or events arrays.');
  if (record(data) && !('outreach' in data) && !('events' in data)) throw new CadenceError('Outreach JSON needs an outreach or events array.');
  const outreach = Array.isArray(data) ? data : data.outreach ?? [];
  const events = Array.isArray(data) ? [] : data.events ?? [];
  if (!Array.isArray(outreach) || !Array.isArray(events) || outreach.length > MAX_ROWS || events.length > MAX_ROWS) throw new CadenceError('Outreach and events must be arrays with at most 10,000 records each.');
  return {
    outreach: outreach.map((item: unknown) => {
      if (!record(item) || typeof item.contact !== 'string' || !item.contact.trim()) throw new CadenceError('Each outreach record needs a contact string.');
      for (const field of ['sent', 'replied']) if (item[field] != null && !['string', 'boolean'].includes(typeof item[field])) throw new CadenceError('Sent and replied must be strings or booleans.');
      return { contact: item.contact, sent: cell(item.sent), replied: cell(item.replied) };
    }),
    events: events.map((item: unknown) => {
      if (!record(item) || typeof item.title !== 'string' || !item.title.trim() || !isDateOnly(item.date) || (item.contact != null && typeof item.contact !== 'string')) throw new CadenceError('Each event needs a title, a valid YYYY-MM-DD date, and an optional contact string.');
      return { cadence, title: item.title, date: item.date, contact: typeof item.contact === 'string' ? item.contact : '' };
    }),
  };
}

export class CadenceStore {
  readonly root: string;
  private writes: Promise<unknown> = Promise.resolve();
  constructor(tachyonRoot: string) { this.root = resolve(tachyonRoot, 'Cadences'); }

  editing = false;
  async edit(value: unknown, input: unknown): Promise<null> {
    if (this.editing) throw new CadenceError('Another edit is saving. Try again.');
    const name = this.name(value);
    this.editing = true;
    try { if (!await this.rootExists()) throw new CadenceError('Cadence folder unavailable.'); await editCadence(this.root, name, input); return null; }
    finally { this.editing = false; }
  }

  // Main-process only: callers never receive or supply paths over IPC.
  async accountsPath(value: unknown): Promise<string> {
    const name = this.name(value);
    if (!await this.rootExists()) throw new CadenceError('Cadence folder is unavailable.');
    await this.directory(join(this.root, name));
    await this.directory(join(this.root, name, 'Accounts'));
    return join(this.root, name, 'Accounts', `${name}_accounts.csv`);
  }

  async contactsPath(value: unknown): Promise<string> {
    const name = this.name(value);
    if (!await this.rootExists()) throw new CadenceError('Cadence folder is unavailable.');
    await this.directory(join(this.root, name));
    await this.directory(join(this.root, name, 'Contacts'));
    return join(this.root, name, 'Contacts', `${name}_contacts.csv`);
  }

  private name(value: unknown): string {
    const error = cadenceNameError(value);
    if (error) throw new CadenceError(error);
    return value as string;
  }
  private async directory(path: string): Promise<void> {
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CadenceError('Cadence folders must be real directories, not symbolic links.');
  }
  private async rootExists(): Promise<boolean> {
    try { await this.directory(resolve(this.root, '..')); await this.directory(this.root); return true; }
    catch (error) { if (hasCode(error, 'ENOENT')) return false; throw error; }
  }
  async list(): Promise<CadenceLibrary> {
    if (!await this.rootExists()) return { path: this.root, cadences: [], warnings: [] };
    const entries = await readdir(this.root, { withFileTypes: true });
    const warnings: string[] = [];
    const names = entries.filter(entry => {
      if (entry.isSymbolicLink() || (entry.isDirectory() && cadenceNameError(entry.name))) { warnings.push('A folder was skipped because its name or directory type is unsupported.'); return false; }
      return entry.isDirectory();
    }).map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en'));
    return { path: this.root, warnings: [...new Set(warnings)], cadences: names.map(name => ({ name, color: `hsl(${(parseInt(snapshotId(name, 0).slice(0, 8), 16) / 0x100000000 * 360).toFixed(6)} 55% 68%)` })) };
  }
  create(value: unknown): Promise<CadenceDetail> {
    const task = this.writes.then(() => this.createFolder(value));
    this.writes = task.catch(() => {});
    return task;
  }
  private async createFolder(value: unknown): Promise<CadenceDetail> {
    const name = this.name(value);
    const parent = resolve(this.root, '..');
    await mkdir(parent, { recursive: true });
    await this.directory(parent);
    await mkdir(this.root, { recursive: true });
    await this.directory(this.root);
    const entries = await readdir(this.root);
    if (entries.some(entry => key(entry) === key(name))) throw new CadenceError('A cadence with that name already exists.');
    const folder = join(this.root, name);
    try { await mkdir(folder); }
    catch (error) { if (hasCode(error, 'EEXIST')) throw new CadenceError('A cadence with that name already exists.'); throw error; }
    const created: string[] = [];
    try {
      for (const part of ['Accounts', 'Contacts', 'Storage']) { const path = join(folder, part); await mkdir(path); created.push(path); }
    } catch (error) {
      // Only remove empty directories made by this operation; never delete user files.
      for (const path of created.reverse()) await rmdir(path).catch(() => {});
      await rmdir(folder).catch(() => {});
      throw error;
    }
    return { name, accounts: [], contacts: [], outreach: [], events: [], warnings: [] };
  }
  private async readFile(name: string, group: string, filename: string): Promise<string | null> {
    try {
      await this.directory(join(this.root, name, group));
      const path = join(this.root, name, group, filename);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new CadenceError('Only regular data files are supported; symbolic links are blocked.');
      const root = await realpath(this.root);
      if (!(await realpath(path)).startsWith(root + sep)) throw new CadenceError('Data file is outside the cadence library.');
      const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        if ((await file.stat()).size > MAX_BYTES) throw new CadenceError('File exceeds the 5 MB limit.');
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > MAX_BYTES) throw new CadenceError('File exceeds the 5 MB limit.');
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
      } finally { await file.close(); }
    } catch (error) { if (hasCode(error, 'ENOENT')) return null; throw error; }
  }
  async read(value: unknown): Promise<CadenceDetail> {
    const name = this.name(value);
    if (!await this.rootExists()) throw new CadenceError('This cadence is no longer available. Refresh the library.');
    try { await this.directory(join(this.root, name)); }
    catch (error) { if (hasCode(error, 'ENOENT')) throw new CadenceError('This cadence is no longer available. Refresh the library.'); throw error; }
    const result: CadenceDetail = { name, accounts: [], contacts: [], outreach: [], events: [], warnings: [] };
    for (const group of ['Accounts', 'Contacts', 'Storage']) {
      try {
        const suffix = group === 'Storage' ? 'outreach.json' : `${group.toLowerCase()}.csv`;
        const text = await this.readFile(name, group, `${name}_${suffix}`);
        if (text === null || !text.trim()) continue;
        if (group === 'Storage') Object.assign(result, parseOutreach(text, name));
        else {
          const rows = parseCSV(text);
          if (group === 'Accounts') {
            if (rows.some(row => !pick(row, 'Account Name', 'Account', 'Name'))) throw new CadenceError('Accounts CSV needs an Account Name column and a name on every row.');
            result.accounts = rows.map((row, i) => ({ id: snapshotId(text, i), name: pick(row, 'Account Name', 'Account', 'Name'), salesforceLink: pick(row, 'Salesforce URL', 'Salesforce Link', 'Link') }));
          } else {
            if (rows.some(row => !pick(row, 'Name', 'Contact Name'))) throw new CadenceError('Contacts CSV needs a Name column and a name on every row.');
            result.contacts = rows.map((row, i) => ({ id: snapshotId(text, i), name: pick(row, 'Name', 'Contact Name'), account: pick(row, 'Account', 'Company', 'Account Name'), position: pick(row, 'Position', 'Job Title', 'Title'), contacted: pick(row, 'Contacted') || 'Unknown' }));
          }
        }
      } catch (error) { result.warnings.push(`${group}: ${error instanceof CadenceError ? error.message : 'Could not read this file. Check its format and permissions.'}`); }
    }
    try {
      const text = await this.readFile(name, 'Storage', name + '_steps.json');
      result.events.push(...readSteps(text).map((row, i) => ({ id: snapshotId(text ?? '', i), cadence: name, type: row.type as StepKind, title: String(row.title), date: String(row.date), contact: String(row.contact) })));
    } catch { result.warnings.push('Storage: Could not read next steps. Check the file format and permissions.'); }
    try {
      const text = await this.readFile(name, 'Storage', name + '_replies.json');
      if (text !== null) result.replies = readReplies(text);
    } catch { result.warnings.push('Storage: Could not read reply records. Check the file format and permissions.'); }
    return result;
  }
  async calendar(): Promise<CalendarData> {
    const library = await this.list();
    const result: CalendarData = { events: [], warnings: [...library.warnings] };
    for (const cadence of library.cadences) {
      try {
        const detail = await this.read(cadence.name);
        result.events.push(...detail.events);
        result.warnings.push(...detail.warnings.filter(w => w.startsWith('Storage:')).map(w => `${cadence.name}: ${w}`));
      } catch { result.warnings.push(`${cadence.name}: Calendar data could not be read.`); }
    }
    return result;
  }
}
