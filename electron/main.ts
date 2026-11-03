import { MessagingFiles } from './messaging-files';
import { registerMessagingHandlers } from './messaging-ipc';
import { registerSalesforcePreview } from './salesforce-preview';
import { app, BrowserWindow, dialog, Menu, net, protocol, session, type IpcMainInvokeEvent } from 'electron';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CadenceStore } from './cadence-files';
import { registerCadenceHandlers } from './cadence-ipc';
import { registerJobHandlers } from './job-ipc';
import { PythonJobs } from './python-jobs';
import { jobChannels } from '../shared/jobs';
import { isTrustedRenderer } from './trusted-renderer';

const here = dirname(fileURLToPath(import.meta.url));
const rendererRoot = resolve(here, '../renderer');
const trustedWindows = new Map<number, string>();
let jobs: PythonJobs;
let quitting = false;
function trusted(event: IpcMainInvokeEvent): boolean {
  return isTrustedRenderer(event, trustedWindows);
}

function developmentURL(): string | undefined {
  if (app.isPackaged || !process.env.ELECTRON_RENDERER_URL) return;
  const url = new URL(process.env.ELECTRON_RENDERER_URL);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password) return;
  return url.href;
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'village', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const window = new BrowserWindow({
    title: 'Tachy-on Village',
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#242238',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  const url = developmentURL() ?? 'village://app/index.html';
  const contentsId = window.webContents.id;
  trustedWindows.set(contentsId, url);
  window.on('closed', () => trustedWindows.delete(contentsId));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  let askingToClose = false;
  window.on('close', event => {
    if (quitting || !jobs?.isRunning()) return;
    event.preventDefault();
    if (askingToClose) return;
    askingToClose = true;
    void dialog.showMessageBox(window, {
      type: 'question', title: 'A browser task is running',
      message: 'Keep the app open, or cancel the task and quit?',
      detail: jobs.current()?.tool === 'outlook' ? 'Cancellation waits for browser cleanup. Outlook may already have autosaved drafts; inspect Drafts and attempt history before retrying.' : 'Cancellation waits for browser cleanup. An atomic save already in progress will finish before quitting.',
      buttons: ['Keep open', 'Cancel task and quit'], defaultId: 0, cancelId: 0,
    }).then(result => { askingToClose = false; if (result.response === 1) app.quit(); });
  });
  void window.loadURL(url);
}

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else void app.whenReady().then(() => {
  app.setName('Tachy-on Village');
  const override = process.env.TACHYON_DATA_ROOT;
  if (override && !isAbsolute(override)) throw new Error('TACHYON_DATA_ROOT must be an absolute path.');
  const dataRoot = override ?? (app.isPackaged ? join(app.getPath('documents'), 'Tachyon') : resolve(here, '../../Tachyon'));
  const store = new CadenceStore(dataRoot);
  registerCadenceHandlers(store, trusted, () => jobs.isRunning());
  registerMessagingHandlers(new MessagingFiles(app.isPackaged ? join(app.getPath('documents'), 'Tachyon', 'messaging') : resolve(here, '../../messaging')), trusted);
  jobs = new PythonJobs({ store, userData: app.getPath('userData'),
    backendRoot: app.isPackaged ? join(process.resourcesPath, 'backend') : resolve(here, '../../backend'),
    python: process.env.TACHYON_PYTHON,
  });
  registerJobHandlers(jobs, trusted);
  registerSalesforcePreview(trusted);
  jobs.subscribe(job => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.webContents.getURL() === trustedWindows.get(window.webContents.id)) window.webContents.send(jobChannels.update, job);
    }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle('village', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    let path: string;
    try { path = resolve(rendererRoot, '.' + decodeURIComponent(url.pathname)); }
    catch { return new Response('Bad request', { status: 400 }); }
    if (!path.startsWith(rendererRoot + sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path).href);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', event => {
  if (quitting || !jobs?.isRunning()) return;
  event.preventDefault();
  void jobs.shutdown().then(() => { quitting = true; app.quit(); });
});
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
