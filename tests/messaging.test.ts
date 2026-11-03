import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MessagingFiles, parseMessageTemplate } from '../electron/messaging-files';

it('imports body-only or Subject: templates while preserving placeholders', () => {
  expect(parseMessageTemplate('body.txt', 'Hi {first_name},\nExample message.')).toEqual({ filename: 'body.txt', body: 'Hi {first_name},\nExample message.' });
  expect(parseMessageTemplate('full.txt', '\uFEFFSubject: Hello {company}\r\n\r\nHi {name},\r\nExample.')).toEqual({ filename: 'full.txt', subject: 'Hello {company}', body: 'Hi {name},\nExample.' });
  for (const value of ['', 'Subject: \nBody', 'Subject: Example\n', 'x'.repeat(20001), 'a\0b']) expect(() => parseMessageTemplate('bad.txt', value)).toThrow();
});
describe('scoped message file reads', () => {
  it('lists only text files and rejects traversal, links, oversized and invalid UTF-8 files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tachyon-messages-'));
    try {
      const files = new MessagingFiles(root);
      await writeFile(join(root, 'message.TXT'), 'Hi {first_name}');
      await writeFile(join(root, 'ignore.json'), '{}');
      expect(await files.list()).toEqual(['message.TXT']);
      expect((await files.read('message.TXT')).body).toBe('Hi {first_name}');
      for (const name of ['../message.TXT', '/tmp/message.txt', '..\\message.txt', 'ignore.json', { filename: 'message.TXT' }]) await expect(files.read(name)).rejects.toThrow();
      await symlink(join(root, 'message.TXT'), join(root, 'link.txt'));
      await expect(files.read('link.txt')).rejects.toThrow(/symbolic/);
      expect(await files.list()).not.toContain('link.txt');
      await writeFile(join(root, 'huge.txt'), 'a'.repeat(80001));
      await expect(files.read('huge.txt')).rejects.toThrow(/80 KB/);
      await writeFile(join(root, 'invalid.txt'), Buffer.from([0xff, 0xfe]));
      await expect(files.read('invalid.txt')).rejects.toThrow(/UTF-8/);
      expect(await new MessagingFiles(join(root, 'missing')).list()).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
