import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

// Exercises only this Electron prototype. No Python import, browser login, or service connection.
const artifacts = resolve('artifacts');
await mkdir(artifacts, { recursive: true });
const temporaryProfile = await mkdtemp(join(tmpdir(), 'tachyon-desktop-test-'));
const scriptPaths = ['backend/scripts/cognism_exporter.py', 'backend/scripts/outlook_drafter.py'];
const checksum = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const before = await Promise.all(scriptPaths.map(checksum));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${temporaryProfile}`], env, chromiumSandbox: true, timeout: 30000 });
let page;
try {
  page = await desktop.firstWindow();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Zoom in', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Zoom in"]').disabled);
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.title(), 'Tachy-on Village');
  const security = await desktop.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox };
  });
  assert.deepEqual(security, { contextIsolation: true, nodeIntegration: false, sandbox: true });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const motion = page.getByRole('button', { name: 'Reduce motion', exact: true });
  if (await motion.getAttribute('aria-pressed') !== 'true') await motion.click();
  await page.mouse.move(5, 5);
  await page.screenshot({ path: join(artifacts, 'village-overview.png') });
  console.log('Electron production launch, secure preferences, and one rendered canvas: passed.');

  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.equal(await page.getByLabel('Zoom level').textContent(), '120%');
  await page.getByRole('button', { name: 'Return to village overview' }).click();
  assert.equal(await page.getByLabel('Zoom level').textContent(), '100%');

  // Real canvas input: water rejection, camera dragging without issuing a walk,
  // then a click on the restaurant's visible frontage.
  await page.mouse.click(70, 300);
  assert.match(await page.locator('.village-status').textContent(), /out of reach/);
  const still = await page.locator('canvas').screenshot();
  await page.keyboard.down('Space');
  await page.mouse.move(80, 300); await page.mouse.down();
  await page.mouse.move(200, 350, { steps: 12 }); await page.mouse.up();
  await page.keyboard.up('Space');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const panned = await page.locator('canvas').screenshot();
  assert.notDeepEqual(still, panned);
  assert.match(await page.locator('.village-status').textContent(), /out of reach/);
  await page.getByRole('button', { name: 'Return to village overview' }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const frontage = await page.evaluate(() => {
    const scale = Math.min((window.innerWidth - 100) / 1595, (window.innerHeight - 210) / 880);
    return { x: window.innerWidth / 2 + (1060 - 712.5) * scale, y: window.innerHeight / 2 + (400 - 425) * scale };
  });
  await page.mouse.move(frontage.x, frontage.y);
  await page.locator('.world-tooltip').filter({ hasText: 'Lantern House' }).waitFor();
  await page.mouse.click(frontage.x, frontage.y);
  await page.getByRole('dialog', { name: 'Lantern House' }).waitFor({ state: 'visible', timeout: 20000 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Follow explorer' }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: join(artifacts, 'village-closeup.png') });
  await page.getByRole('button', { name: 'Return to village overview' }).click();
  console.log('Canvas hover/click, water rejection, drag/pan without movement, and follow camera: passed.');

  const places = ['Fisherman’s Dock', 'Lantern House', 'The Cook’s Court', 'Calendar Square', 'The Changing Room', 'Windbell Shrine'];
  for (const name of places) {
    await page.getByRole('button', { name: 'Village guide', exact: true }).click();
    await page.getByRole('button', { name: `Walk to ${name}`, exact: true }).click();
    await page.getByRole('dialog', { name, exact: true }).waitFor({ state: 'visible', timeout: 20000 });
    assert.match(await page.getByRole('dialog').innerText(), /For now, enjoy exploring the village/);
    if (name === 'Lantern House') await page.screenshot({ path: join(artifacts, 'restaurant-entrance.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('application', { name: 'Explorable village map' }).evaluate(el => el === document.activeElement), true);
    console.log(`Walk to ${name}, arrival panel, Escape, focus restoration: passed.`);
  }
  await page.getByRole('button', { name: 'Village guide', exact: true }).click();
  await page.getByRole('button', { name: 'Open Fisherman’s Dock', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Fisherman’s Dock' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return to village overview' }).click();
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
  await page.waitForFunction(() => window.innerWidth === 1366 && window.innerHeight === 768);
  await page.screenshot({ path: join(artifacts, 'village-1366x768.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(await Promise.all(scriptPaths.map(checksum)), before);
  assert.deepEqual(errors, []);
  console.log('Keyboard access, resizing, no renderer exceptions, and unchanged Python scripts: passed.');
} catch (error) {
  if (page) { await page.screenshot({ path: join(artifacts, 'desktop-failure.png') }).catch(() => {}); console.error(await page.locator('body').textContent().catch(() => 'No renderer text')); }
  throw error;
} finally {
  await desktop.close();
  await rm(temporaryProfile, { recursive: true, force: true });
}
