import { ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { cadenceChannels, isSalesforceLink, type Result } from '../shared/cadences';
import { CadenceError, CadenceStore } from './cadence-files';

export function registerCadenceHandlers(store: CadenceStore, trusted: (event: IpcMainInvokeEvent) => boolean, isRunning: () => boolean = () => false) {
  function handle<T>(channel: string, count: number, operation: (...args: unknown[]) => Promise<T>) {
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<Result<T>> => {
      if (!trusted(event)) return { ok: false, error: 'This window cannot access cadence data.' };
      if (args.length !== count) return { ok: false, error: 'Invalid cadence request.' };
      try { return { ok: true, data: await operation(...args) }; }
      catch (error) {
        return { ok: false, error: error instanceof CadenceError ? error.message : 'Could not access the cadence folder. Check that it is available and writable, then try again.' };
      }
    });
  }
  handle(cadenceChannels.edit, 2, async (name, change) => {
    if (isRunning()) throw new CadenceError('Finish or cancel the running job before editing cadence data.');
    return store.edit(name, change);
  });
  handle(cadenceChannels.list, 0, () => store.list());
  handle(cadenceChannels.create, 1, name => store.create(name));
  handle(cadenceChannels.read, 1, name => store.read(name));
  handle(cadenceChannels.calendar, 0, () => store.calendar());
  handle(cadenceChannels.openSalesforceLink, 1, async url => {
    if (!isSalesforceLink(url)) throw new CadenceError('Only HTTPS Salesforce links can be opened.');
    await shell.openExternal(url);
    return null;
  });
}
