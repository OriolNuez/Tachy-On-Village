import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
if (!process.argv.includes('--live')) throw new Error('This check contacts Salesforce. Run explicitly with --live; it never signs in.');
const profile = await mkdtemp(join(tmpdir(), 'tachyon-preview-'));
const env = { ...process.env, TACHYON_DATA_ROOT: join(profile, 'Tachyon') };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${profile}`], env });
try {
  const page = await desktop.firstWindow();
  await page.getByRole('button', { name: /Salesforce/ }).click();
  await page.getByRole('button', { name: 'Open in Chrome ↗' }).waitFor();
  const security = await desktop.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const view = window.contentView.children.find(child => child.webContents && child.webContents !== window.webContents);
    if (!view) throw new Error('Missing native WebContentsView');
    const prefs = view.webContents.getLastWebPreferences();
    return { node: prefs.nodeIntegration, isolation: prefs.contextIsolation, sandbox: prefs.sandbox, security: prefs.webSecurity, preload: prefs.preload, separate: view.webContents.session !== window.webContents.session, y: view.getBounds().y };
  });
  assert.deepEqual(security, { node: false, isolation: true, sandbox: true, security: true, preload: undefined, separate: true, y: 180 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]').textContent.includes('Loading Salesforce'), undefined, { timeout: 20000 }).catch(() => {});
  console.log('Initial load:', await page.getByRole('status').first().textContent());
  console.log('Rendered page:', await desktop.evaluate(async ({ BrowserWindow }) => {
    const view = BrowserWindow.getAllWindows()[0].contentView.children[0];
    return view.webContents.executeJavaScript('({hasBody: !!document.body, inputs: document.querySelectorAll("input").length, node: typeof require, bridge: typeof window.villageDesktop})');
  }));
  await page.getByRole('button', { name: '← Main menu' }).click();
  await page.getByRole('button', { name: 'Explore village' }).waitFor();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length), 0);
  console.log('Native view isolation, visible fallback, and cleanup passed. No login or account interactions performed.');
} finally { await desktop.close(); await rm(profile, { recursive: true, force: true }); }
