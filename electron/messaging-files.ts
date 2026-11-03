import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { CadenceError } from './cadence-files';
import type { MessageTemplate } from '../shared/messaging';

export function parseMessageTemplate(filename: string, text: string): MessageTemplate {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  let subject: string | undefined;
  if (/^Subject:/i.test(lines[0])) {
    subject = lines.shift()!.slice('Subject:'.length).trim();
    if (!subject || subject.length > 250) throw new CadenceError('The Subject: line must contain 1–250 characters.');
    if (lines[0] === '') lines.shift();
  }
  const body = lines.join('\n');
  if (!body.trim() || body.length > 20000 || body.includes('\0')) throw new CadenceError('The message must contain 1–20,000 characters of text without null characters.');
  return { filename, body, ...(subject === undefined ? {} : { subject }) };
}
export class MessagingFiles {
  constructor(private readonly root: string) {}
  private async directory(): Promise<boolean> {
    try {
      const stat = await lstat(this.root);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CadenceError('The messaging folder must be a real directory, not a symbolic link.');
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }
  async list(): Promise<string[]> {
    if (!await this.directory()) return [];
    return (await readdir(this.root, { withFileTypes: true })).filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.txt').map(entry => entry.name).sort((a, b) => a.localeCompare(b));
  }
  async read(value: unknown): Promise<MessageTemplate> {
    if (typeof value !== 'string' || !value || value !== basename(value) || /[\\/]/.test(value) || value.includes('\0') || extname(value).toLowerCase() !== '.txt') throw new CadenceError('Choose a .txt filename from the messaging folder.');
    if (!await this.directory()) throw new CadenceError('The messaging folder is missing.');
    const path = join(this.root, value);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new CadenceError('Message templates must be regular text files, not symbolic links.');
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      if (!(await handle.stat()).isFile()) throw new CadenceError('Not a regular message file.');
      const buffer = Buffer.alloc(80001);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > 80000) throw new CadenceError('Message files must be no larger than 80 KB.');
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)); }
      catch { throw new CadenceError('Save the message as a UTF-8 .txt file.'); }
      return parseMessageTemplate(value, text);
    } finally { await handle.close(); }
  }
}
