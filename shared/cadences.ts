import type { CadenceEdit, StepKind } from './cadence-edits';
export interface CadenceSummary { name: string; color: string }
export interface Account { id?: string; name: string; salesforceLink: string }
export interface Contact { id?: string; name: string; account: string; position: string; contacted: string }
export interface Outreach { contact: string; sent: string; replied: string }
export interface CadenceEvent { id?: string; type?: StepKind; cadence: string; title: string; date: string; contact: string }
export interface CadenceDetail {
  replies?: Record<string, boolean>;
  name: string;
  accounts: Account[];
  contacts: Contact[];
  outreach: Outreach[];
  events: CadenceEvent[];
  warnings: string[];
}
export interface CadenceLibrary { path: string; cadences: CadenceSummary[]; warnings: string[] }
export interface CalendarData { events: CadenceEvent[]; warnings: string[] }
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export interface CadenceAPI {
  edit(name: string, change: CadenceEdit): Promise<Result<null>>;
  list(): Promise<Result<CadenceLibrary>>;
  create(name: string): Promise<Result<CadenceDetail>>;
  read(name: string): Promise<Result<CadenceDetail>>;
  calendar(): Promise<Result<CalendarData>>;
  openSalesforceLink(url: string): Promise<Result<null>>;
}
export const cadenceChannels = {
  edit: 'cadences:edit', list: 'cadences:list', create: 'cadences:create', read: 'cadences:read',
  calendar: 'cadences:calendar', openSalesforceLink: 'cadences:open-salesforce-link',
} as const;

export function cadenceNameError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80) return 'Use a cadence name between 1 and 80 characters.';
  if (value !== value.trim() || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(value)) return 'Start with a letter or number. Use only letters, numbers, spaces, hyphens and underscores.';
  if (/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i.test(value)) return 'This name is reserved by the operating system. Choose another name.';
  return null;
}

export function isSalesforceLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['salesforce.com', 'force.com'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));
  } catch { return false; }
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
