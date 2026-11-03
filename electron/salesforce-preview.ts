import { BrowserWindow, WebContentsView, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { previewChannels } from '../shared/salesforce-preview';
import { approvedPreviewURL, previewHost, territoryURL } from './salesforce-policy';

export function registerSalesforcePreview(trusted: (event: IpcMainInvokeEvent) => boolean) {
  const previews = new Map<number, { close: () => void; status: () => string }>();
  function owner(event: IpcMainInvokeEvent) {
    if (!trusted(event)) throw new Error('Untrusted preview request.');
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('Desktop window unavailable.');
    return window;
  }
  ipcMain.handle(previewChannels.open, event => {
    const window = owner(event);
    if (previews.has(window.id)) return;
    // No persist: prefix: credentials remain in this isolated in-memory session.
    const isolated = session.fromPartition(`salesforce-preview-${randomUUID()}`, { cache: false });
    let status = 'Loading Salesforce…';
    let blocked = false;
    const reportBlock = (url: string) => { blocked = true; status = `Blocked destination: ${previewHost(url)}. Use Open in Chrome or request domain review.`; };
    isolated.setPermissionRequestHandler((_wc, _permission, callback) => { status = 'Browser permission blocked. Use Chrome if your login requires it.'; callback(false); });
    isolated.setPermissionCheckHandler(() => false);
    isolated.on('will-download', event => { event.preventDefault(); status = 'Downloads are disabled in this viewing prototype.'; });
    isolated.webRequest.onBeforeRequest((details, callback) => {
      const navigation = details.resourceType === 'mainFrame' || details.resourceType === 'subFrame';
      const cancel = navigation && !approvedPreviewURL(details.url);
      if (cancel) reportBlock(details.url);
      callback({ cancel });
    });
    const view = new WebContentsView({ webPreferences: {
      session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false, devTools: false,
    } });
    const contents = view.webContents;
    contents.on('will-frame-navigate', event => { if (!approvedPreviewURL(event.url)) { event.preventDefault(); reportBlock(event.url); } });
    contents.on('will-redirect', (event, url) => { if (!approvedPreviewURL(url)) { event.preventDefault(); reportBlock(url); } });
    contents.setWindowOpenHandler(({ url }) => {
      // Even approved popups are blocked: preserve authentication semantics rather than redirecting POST flows.
      status = `Popup blocked (${previewHost(url)}). If required for sign-in, use Open in Chrome.`;
      blocked = true;
      return { action: 'deny' };
    });
    contents.on('will-attach-webview', event => event.preventDefault());
    contents.on('did-finish-load', () => { if (!blocked) status = `Page loaded: ${previewHost(contents.getURL())}. Login, filters and tables require manual verification.`; });
    contents.on('did-fail-load', (_event, code, _description, _url, main) => { if (main && code !== -3 && !blocked) status = `Page load failed (${code}). Open in Chrome is available.`; });
    contents.on('render-process-gone', () => { status = 'Salesforce view stopped. Close and reopen the prototype, or use Chrome.'; });
    const resize = () => { const [width, height] = window.getContentSize(); view.setBounds({ x: 0, y: 180, width, height: Math.max(0, height - 180) }); };
    window.contentView.addChildView(view); resize(); window.on('resize', resize);
    const close = () => {
      if (!previews.delete(window.id)) return;
      window.removeListener('resize', resize); window.removeListener('closed', close);
      if (!window.isDestroyed()) window.contentView.removeChildView(view);
      contents.close({ waitForBeforeUnload: false });
      isolated.webRequest.onBeforeRequest(null);
      void isolated.clearStorageData().catch(() => {});
    };
    previews.set(window.id, { close, status: () => status }); window.once('closed', close);
    void contents.loadURL(territoryURL).catch(() => { if (!blocked) status = 'Could not load Salesforce. Open in Chrome is available.'; });
  });
  ipcMain.handle(previewChannels.close, event => { previews.get(owner(event).id)?.close(); });
  ipcMain.handle(previewChannels.status, event => previews.get(owner(event).id)?.status() ?? 'Preview closed.');
  ipcMain.handle(previewChannels.chrome, async event => {
    owner(event);
    let executable: string | undefined;
    let args = [territoryURL];
    if (process.platform === 'darwin') { executable = '/usr/bin/open'; args = ['-a', 'Google Chrome', territoryURL]; }
    else if (process.platform === 'win32') {
      executable = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter((root): root is string => !!root).map(root => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')).find(existsSync);
    } else executable = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].find(existsSync);
    if (!executable) return 'Google Chrome was not found. Open Territory Prospecting in your approved browser manually.';
    return new Promise<string>(resolve => {
      const child = spawn(executable!, args, { shell: false, stdio: 'ignore' });
      child.once('error', () => resolve('Could not open Google Chrome. Check that it is installed.'));
      if (process.platform === 'darwin') child.once('exit', code => resolve(code === 0 ? 'Opened in Chrome.' : 'Could not open Google Chrome. Check that it is installed.'));
      else child.once('spawn', () => { child.unref(); resolve('Opened in Chrome.'); });
    });
  });
}
