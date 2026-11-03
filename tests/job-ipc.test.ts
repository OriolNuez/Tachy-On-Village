import { describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { isTrustedRenderer } from '../electron/trusted-renderer';
import { jobChannels } from '../shared/jobs';
import { registerJobHandlers } from '../electron/job-ipc';
import type { PythonJobs } from '../electron/python-jobs';

const handlers = vi.hoisted(() => new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>>());
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>) => handlers.set(name, handler) } }));

function event(url: string, id = 1, iframe = false): IpcMainInvokeEvent {
  const frame = { url };
  return { sender: { id, mainFrame: frame }, senderFrame: iframe ? { url } : frame } as unknown as IpcMainInvokeEvent;
}
describe('trusted job IPC boundary', () => {
  it('accepts only the registered top-level frame and exact URL', () => {
    const registered = new Map([[1, 'village://app/index.html']]);
    expect(isTrustedRenderer(event('village://app/index.html'), registered)).toBe(true);
    for (const request of [event('village://app/index.html', 2), event('village://app/index.html', 1, true), event('https://evil.test'), event('village://app/index.html/other'), event('village://other/index.html')]) expect(isTrustedRenderer(request, registered)).toBe(false);
  });
  it('uses the exact local development URL, including port', () => {
    const registered = new Map([[1, 'http://127.0.0.1:5173/']]);
    expect(isTrustedRenderer(event('http://127.0.0.1:5173/'), registered)).toBe(true);
    expect(isTrustedRenderer(event('http://127.0.0.1:5174/'), registered)).toBe(false);
    expect(isTrustedRenderer(event('http://localhost:5173/'), registered)).toBe(false);
  });
  it('rejects untrusted starts, actions and log snapshots without invoking the runner', async () => {
    const startSalesforce = vi.fn(), current = vi.fn(), act = vi.fn();
    registerJobHandlers({ startSalesforce, current, act } as unknown as PythonJobs, () => false);
    for (const name of [jobChannels.start, jobChannels.startCognism, jobChannels.outlookHistory, jobChannels.previewOutlook, jobChannels.startOutlook, jobChannels.current, jobChannels.action]) expect(await handlers.get(name)!(event('https://evil.test'))).toEqual({ ok: false, error: 'This window cannot control jobs.' });
    expect(startSalesforce).not.toHaveBeenCalled(); expect(current).not.toHaveBeenCalled(); expect(act).not.toHaveBeenCalled();
  });
  it('rejects extra arguments and exposes only the seven named handlers', async () => {
    const startSalesforce = vi.fn();
    registerJobHandlers({ startSalesforce } as unknown as PythonJobs, () => true);
    expect(await handlers.get(jobChannels.start)!(event('village://app/index.html'), 'Example', '/arbitrary/script.py')).toEqual({ ok: false, error: 'Invalid job request.' });
    expect(startSalesforce).not.toHaveBeenCalled();
    expect([...handlers.keys()].sort()).toEqual([jobChannels.start, jobChannels.startCognism, jobChannels.outlookHistory, jobChannels.previewOutlook, jobChannels.startOutlook, jobChannels.current, jobChannels.action].sort());
  });
  it('validates Cognism requests before starting the allowlisted job', async () => {
    const startCognism = vi.fn().mockResolvedValue({ tool: 'cognism' });
    registerJobHandlers({ startCognism } as unknown as PythonJobs, () => true);
    expect(await handlers.get(jobChannels.startCognism)!(event('village://app/index.html'), 'Example', '--profile')).toEqual({ ok: false, error: 'Invalid job request.' });
    expect(startCognism).not.toHaveBeenCalled();
    expect(await handlers.get(jobChannels.startCognism)!(event('village://app/index.html'), 'Example')).toEqual({ ok: true, data: { tool: 'cognism' } });
    expect(startCognism).toHaveBeenCalledWith('Example');
  });
  it('does not leak raw process or filesystem exceptions to the renderer', async () => {
    registerJobHandlers({ startSalesforce: () => { throw new Error('/private/path secret=123'); } } as unknown as PythonJobs, () => true);
    expect(await handlers.get(jobChannels.start)!(event('village://app/index.html'), 'Example')).toEqual({ ok: false, error: 'The job request could not be completed.' });
  });
});
