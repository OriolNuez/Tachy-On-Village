import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { messagingChannels } from '../shared/messaging';
import type { Result } from '../shared/cadences';
import { CadenceError } from './cadence-files';
import { MessagingFiles } from './messaging-files';

export function registerMessagingHandlers(files: MessagingFiles, trusted: (event: IpcMainInvokeEvent) => boolean) {
  function handle<T>(channel: string, count: number, operation: (...args: unknown[]) => Promise<T>) {
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<Result<T>> => {
      if (!trusted(event) || args.length !== count) return { ok: false, error: 'Invalid messaging request.' };
      try { return { ok: true, data: await operation(...args) }; }
      catch (error) { return { ok: false, error: error instanceof CadenceError ? error.message : 'Could not read the message file. Check that it still exists and is readable.' }; }
    });
  }
  handle(messagingChannels.list, 0, () => files.list());
  handle(messagingChannels.read, 1, filename => files.read(filename));
}
