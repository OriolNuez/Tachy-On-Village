import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { OutlookAttempt, OutlookDraft, OutlookPreview, OutlookSettings } from '../shared/outlook';
import { CadenceError, CadenceStore, parseCSV } from './cadence-files';
import { readAccountFile } from './account-merge';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizedEmail = (value: string) => value.trim().normalize('NFC').toLowerCase();
const validEmail = (value: string) => /^[^@\s|,;<>]+@[^@\s|,;<>]+\.[^@\s|,;<>]+$/.test(value);
const optedOut = (row: Record<string, string>) => ['optout', 'donotcontact', 'unsubscribed'].some(key => ['yes', 'true', '1', 'opted out'].includes(row[key]?.trim().toLowerCase()));
export function renderTemplate(template: string, values: Record<string, string>): string {
  const result = template.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
    if (!Object.hasOwn(values, key)) throw new CadenceError(`Unsupported placeholder: ${key}. Use first_name, name, university, company or email.`);
    return values[key];
  });
  if (/[{}]/.test(result)) throw new CadenceError('Template contains unmatched braces.');
  return result;
}
export function outlookSettings(value: unknown): OutlookSettings {
  if (!value || typeof value !== 'object') throw new CadenceError('Invalid draft settings.');
  const v = value as Record<string, unknown>;
  if (typeof v.subject !== 'string' || !v.subject.trim() || v.subject.length > 250 || (/[\r\n]/.test(v.subject) || v.subject.includes('\0')) || typeof v.body !== 'string' || !v.body.trim() || v.body.length > 20000 || v.body.includes('\0') || !Number.isSafeInteger(v.limit) || (v.limit as number) < 1 || (v.limit as number) > 100 || typeof v.verifiedOnly !== 'boolean' || typeof v.signature !== 'boolean' || Object.keys(v).some(k => !['subject', 'body', 'limit', 'verifiedOnly', 'signature', 'step'].includes(k))) throw new CadenceError('Choose a subject, body and batch size from 1 to 100.');
  if (v.step !== undefined && (!Number.isSafeInteger(v.step) || (v.step as number) < 1 || (v.step as number) > 100)) throw new CadenceError('Choose a cadence step from 1 to 100.');
  renderTemplate(v.subject, { first_name: 'Example', name: 'Example', university: 'Example', company: 'Example', email: 'example@example.test' });
  renderTemplate(v.body, { first_name: 'Example', name: 'Example', university: 'Example', company: 'Example', email: 'example@example.test' });
  return v as unknown as OutlookSettings;
}

export class OutlookPlans {
  private activePlan: { cadence: string; fingerprint: string } | null = null;
  private plans = new Map<string, { cadence: string; fingerprint: string; preview: OutlookPreview; createdAt: number }>();
  constructor(private store: CadenceStore, private userData: string, private backendRoot: string) {}
  get stateDirectory() { return join(this.userData, 'outlook'); }
  get ledgerPath() { return join(this.stateDirectory, 'attempts.json'); }
  async defaults(): Promise<OutlookSettings> {
    // Read reviewed constants as text; never import or execute Python to preview a message.
    const source = await readFile(join(this.backendRoot, 'scripts/outlook_drafter.py'), 'utf8');
    const subject = /^SUBJECT = '([^'\r\n]*)'/m.exec(source)?.[1];
    const body = /^BODY = '''([\s\S]*?)'''/m.exec(source)?.[1];
    if (!subject || !body) throw new CadenceError('Could not read the standalone Outlook template.');
    return { step: 1, subject, body, limit: 3, verifiedOnly: true, signature: true };
  }
  async history(): Promise<OutlookAttempt[]> {
    const text = await readAccountFile(this.ledgerPath, true);
    if (text === null) return [];
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new CadenceError('Outlook attempt history is invalid. Restore it before creating drafts; do not delete it to retry.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new CadenceError('Invalid Outlook attempt history.');
    const entries = Object.entries(parsed);
    if (entries.length > 10000) throw new CadenceError('Outlook history exceeds the supported limit.');
    return entries.map(([id, value]) => {
      const row = value as Record<string, unknown>;
      if (!/^[a-f0-9]{64}$/.test(id) || !row || typeof row !== 'object' || !['cadence', 'name', 'email', 'subject', 'attemptedAt'].every(key => typeof row[key] === 'string') || !['attempt_started', 'save_attempted', 'subject_visible_review_required', 'uncertain'].includes(String(row.status))) throw new CadenceError('Invalid Outlook attempt record. Restore history before creating drafts.');
      return { ...(Number.isSafeInteger(row.step) && Number(row.step) >= 1 && Number(row.step) <= 100 ? { step: Number(row.step) } : {}), ...(typeof row.batchId === 'string' ? { batchId: row.batchId } : {}), id, cadence: String(row.cadence), name: String(row.name), email: String(row.email), subject: String(row.subject), attemptedAt: String(row.attemptedAt), status: row.status as OutlookAttempt['status'] };
    });
  }
  private async source(cadence: string) {
    const contacts = await readAccountFile(await this.store.contactsPath(cadence), true);
    if (!contacts?.trim()) throw new CadenceError('Import contacts into this cadence before drafting.');
    const suppressed = new Set<string>();
    const library = await this.store.list();
    if (library.warnings.length) throw new CadenceError('Resolve cadence folder warnings before drafting so opt-outs can be checked.');
    for (const item of library.cadences) {
      const text = await readAccountFile(await this.store.contactsPath(item.name), true);
      if (text?.trim()) for (const row of parseCSV(text)) if (optedOut(row)) for (const email of (row.email ?? '').split('|')) if (email.trim()) suppressed.add(normalizedEmail(email));
    }
    return { contacts, suppressed };
  }
  async preview(cadence: string, input?: unknown): Promise<OutlookPreview> {
    const settings = input === undefined ? await this.defaults() : outlookSettings(input);
    const { contacts, suppressed } = await this.source(cadence);
    const history = await this.history();
    const attemptedEmails = new Set(history.map(row => normalizedEmail(row.email)));
    const seen = new Set<string>();
    const skipped: OutlookPreview['skipped'] = [];
    const eligible: OutlookDraft[] = [];
    for (const row of parseCSV(contacts)) {
      const name = clean(row.name || row.contactname || '');
      const university = clean(row.company || row.account || '');
      const email = normalizedEmail(row.email || '');
      const reason = !name || !university ? 'Missing name or company' : !validEmail(email) ? 'Missing or ambiguous email' : suppressed.has(email) || optedOut(row) ? 'Opted out / do not contact' : row.importreview?.trim() ? 'Resolve the Import Review flag first' : settings.verifiedOnly && row.emailverified !== 'Yes' ? 'Email not explicitly verified' : attemptedEmails.has(email) ? 'Already attempted; inspect Outlook and attempt history' : seen.has(email) ? 'Duplicate email' : null;
      if (reason) { skipped.push({ name: name || 'Unnamed contact', reason }); continue; }
      seen.add(email);
      const values = { first_name: name.split(' ')[0], name, university, company: university, email };
      const subject = renderTemplate(settings.subject, values), body = renderTemplate(settings.body, values);
      if (subject.length > 500 || body.length > 30000) throw new CadenceError('A rendered message exceeds the supported size.');
      // Email-wide suppression prevents changed templates/cadences from retrying an uncertain attempt.
      const id = hash(JSON.stringify([cadence, email, subject, body, settings.signature]));
      eligible.push({ id, name, university, email, subject, body });
    }
    const token = randomUUID();
    const preview: OutlookPreview = { token, settings, selected: eligible.slice(0, settings.limit), eligible: eligible.length, skipped, history: history.filter(row => row.cadence === cadence) };
    for (const [key, plan] of this.plans) if (Date.now() - plan.createdAt > 15 * 60 * 1000) this.plans.delete(key);
    while (this.plans.size >= 20) this.plans.delete(this.plans.keys().next().value!);
    this.plans.set(token, { cadence, fingerprint: hash(JSON.stringify([contacts, [...suppressed].sort(), history])), preview, createdAt: Date.now() });
    return preview;
  }
  async assertUnchanged(cadence: string): Promise<void> {
    if (!this.activePlan || this.activePlan.cadence !== cadence) throw new CadenceError('No reviewed Outlook batch is active.');
    const { contacts, suppressed } = await this.source(cadence);
    const history = await this.history();
    if (hash(JSON.stringify([contacts, [...suppressed].sort(), history])) !== this.activePlan.fingerprint) throw new CadenceError('Contacts, opt-outs or history changed while signing in. Cancel this task and review a fresh preview.');
  }
  async consume(cadence: string, token: unknown, workspace: string): Promise<{ request: string; ledger: string; total: number }> {
    const plan = typeof token === 'string' ? this.plans.get(token) : undefined;
    if (!plan || plan.cadence !== cadence || Date.now() - plan.createdAt > 15 * 60 * 1000 || !plan.preview.selected.length) throw new CadenceError('Preview the recipients and message again before launching Outlook.');
    this.plans.delete(token as string);
    const { contacts, suppressed } = await this.source(cadence);
    const history = await this.history();
    if (hash(JSON.stringify([contacts, [...suppressed].sort(), history])) !== plan.fingerprint) throw new CadenceError('Contacts, opt-outs or draft history changed. Review a fresh preview.');
    await mkdir(this.stateDirectory, { recursive: true, mode: 0o700 });
    if ((await lstat(this.stateDirectory)).isSymbolicLink()) throw new CadenceError('Outlook state directory must not be a symbolic link.');
    const request = join(workspace, 'draft-request.json');
    await writeFile(request, JSON.stringify({ v: 1, cadence, step: plan.preview.settings.step, batchId: randomUUID(), signature: plan.preview.settings.signature, drafts: plan.preview.selected }), { flag: 'wx', mode: 0o600 });
    this.activePlan = { cadence, fingerprint: plan.fingerprint };
    return { request, ledger: this.ledgerPath, total: plan.preview.selected.length };
  }
}
