import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { Result } from '../shared/cadences';
import { jobChannels } from '../shared/jobs';
import { CadenceError } from './cadence-files';
import { PythonJobs } from './python-jobs';

export function registerJobHandlers(jobs: PythonJobs, trusted: (event: IpcMainInvokeEvent) => boolean) {
  function handle<T>(channel: string, count: number, callback: (...args: unknown[]) => T | Promise<T>) {
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<Result<T>> => {
      if (!trusted(event)) return { ok: false, error: 'This window cannot control jobs.' };
      if (args.length !== count) return { ok: false, error: 'Invalid job request.' };
      try { return { ok: true, data: await callback(...args) }; }
      catch (error) { return { ok: false, error: error instanceof CadenceError ? error.message : 'The job request could not be completed.' }; }
    });
  }
  handle(jobChannels.outlookHistory, 1, cadence => jobs.outlookHistory(cadence));
  handle(jobChannels.previewOutlook, 2, (cadence, settings) => jobs.previewOutlook(cadence, settings));
  handle(jobChannels.startOutlook, 2, (cadence, token) => jobs.startOutlook(cadence, token));
  handle(jobChannels.startCognism, 1, cadence => jobs.startCognism(cadence));
  handle(jobChannels.start, 1, cadence => jobs.startSalesforce(cadence));
  handle(jobChannels.current, 0, () => jobs.current());
  handle(jobChannels.action, 2, (id, action) => jobs.actChecked(id, action));
}
