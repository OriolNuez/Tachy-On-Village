import { MessagingFiles } from '../../electron/messaging-files';
import { registerMessagingHandlers } from '../../electron/messaging-ipc';
// Test-only Electron entry point. Production never imports this fixture or has
// a simulator switch. The real runner/adapter execute against fake Playwright.
import { app, BrowserWindow, net, protocol } from 'electron';
import { spawn } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CadenceStore } from '../../electron/cadence-files';
import { registerCadenceHandlers } from '../../electron/cadence-ipc';
import { registerJobHandlers } from '../../electron/job-ipc';
import { PythonJobs } from '../../electron/python-jobs';
import { jobChannels } from '../../shared/jobs';

protocol.registerSchemesAsPrivileged([{ scheme: 'village', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
void app.whenReady().then(() => {
  const root = process.env.TACHYON_TEST_REPO!;
  const store = new CadenceStore(process.env.TACHYON_DATA_ROOT!);
  const jobs = new PythonJobs({ store, backendRoot: join(root, 'backend'), userData: app.getPath('userData'),
    launch: (_executable, args, options) => spawn(process.platform === 'win32' ? 'python' : 'python3', [join(root, args[1] === join(root, 'backend/workers/outlook_worker.py') ? 'tests/fixtures/fake_outlook_worker.py' : args[1] === join(root, 'backend/workers/cognism_importer.py') ? 'tests/fixtures/fake_cognism_worker.py' : 'tests/fixtures/fake_salesforce_worker.py'), ...args.slice(2)], options),
  });
  const window = new BrowserWindow({ width: 1440, height: 960, webPreferences: {
    preload: join(root, 'out/preload/index.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false,
  } });
  const url = 'village://app/index.html';
  const trusted = (event: Electron.IpcMainInvokeEvent) => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === url;
  registerMessagingHandlers(new MessagingFiles(join(process.env.TACHYON_DATA_ROOT!, 'messaging')), trusted);
  registerCadenceHandlers(store, trusted); registerJobHandlers(jobs, trusted);
  jobs.subscribe(job => { if (!window.isDestroyed()) window.webContents.send(jobChannels.update, job); });
  const rendererRoot = join(root, 'out/renderer');
  protocol.handle('village', request => {
    const requestURL = new URL(request.url);
    const path = resolve(rendererRoot, '.' + decodeURIComponent(requestURL.pathname));
    if (requestURL.host !== 'app' || !path.startsWith(rendererRoot + sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path).href);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  void window.loadURL(url);
  let quitting = false;
  app.on('before-quit', event => {
    if (quitting || !jobs.isRunning()) return;
    event.preventDefault(); void jobs.shutdown().then(() => { quitting = true; app.quit(); });
  });
});
app.on('window-all-closed', () => app.quit());
