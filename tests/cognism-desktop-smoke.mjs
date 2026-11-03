import { _electron as electron } from 'playwright';
import { build } from 'vite';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const root = resolve('.');
const temporary = await mkdtemp(join(tmpdir(), 'tachyon-cognism-ui-'));
const cadence = join(temporary, 'Tachyon', 'Cadences', 'Synthetic Test');
for (const group of ['Accounts', 'Contacts', 'Storage']) await mkdir(join(cadence, group), { recursive: true });
const contactFile = join(cadence, 'Contacts', 'Synthetic Test_contacts.csv');
const original = '\uFEFFName,Email,Notes,Contacted\r\nAlex Example,alex@example.test,Keep this note,Yes\r\n';
await writeFile(contactFile, original);
let desktop;
try {
  await build({ configFile: false, logLevel: 'error', build: { ssr: true, outDir: join(temporary, 'harness'), rollupOptions: { input: join(root, 'tests/fixtures/jobs-desktop-main.ts'), external: ['electron'], output: { entryFileNames: 'index.mjs' } } } });
  const env = { ...process.env, TACHYON_TEST_REPO: root, TACHYON_DATA_ROOT: join(temporary, 'Tachyon') };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = await electron.launch({ args: [join(temporary, 'harness/index.mjs'), `--user-data-dir=${join(temporary, 'profile')}`], env, chromiumSandbox: true });
  const page = await desktop.firstWindow(); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Existing Cadences' }).click();
  await page.getByRole('button', { name: /CADENCE 01 Synthetic Test/ }).click();
  await page.getByRole('button', { name: '+ Import Contacts', exact: true }).click();
  await page.getByRole('dialog', { name: 'Import Cognism Contacts' }).waitFor();
  assert.equal((await page.evaluate(() => window.villageDesktop.jobs.current())).data, null);
  await page.getByRole('button', { name: 'Launch Cognism', exact: true }).click();
  await page.getByRole('button', { name: 'Start Import', exact: true }).waitFor();
  assert.equal(await readFile(contactFile, 'utf8'), original);
  assert.equal((await page.evaluate(() => window.villageDesktop.jobs.startCognism('Synthetic Test'))).ok, false);
  await page.getByRole('button', { name: 'Start Import', exact: true }).click();
  await page.locator('.job-status span').filter({ hasText: /^completed$/ }).waitFor();
  const result = (await page.evaluate(() => window.villageDesktop.jobs.current())).data;
  assert.deepEqual(result.counts, { found: 4, exported: 3, duplicates: 0, errors: 1, verifiedEmails: 1, diamond: 1, missingEmails: 1 });
  assert.equal(result.result.added, 2); assert.equal(result.result.duplicates, 1);
  assert.equal(result.result.total, 3); assert.ok(result.result.review.length);
  await page.getByRole('region', { name: 'Error reviewer' }).waitFor();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('cell', { name: 'Missing Email', exact: true }).waitFor();
  const saved = await readFile(contactFile, 'utf8');
  assert.ok(saved.includes('Keep this note')); assert.ok(saved.includes('001234')); assert.ok(saved.includes('Import Review'));
  await page.getByRole('button', { name: '+ Import Contacts', exact: true }).click();
  await page.getByRole('button', { name: 'Launch Cognism', exact: true }).click();
  await page.getByRole('button', { name: 'Start Import', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancel task', exact: true }).click();
  await page.locator('.job-status span').filter({ hasText: /^cancelled$/ }).waitFor();
  assert.equal(await readFile(contactFile, 'utf8'), saved);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  // Ensure the existing Salesforce confirmation remains available after a Cognism task.
  await page.getByRole('button', { name: '+ Add Accounts', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add Salesforce Accounts' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Launch Salesforce', exact: true }).isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log('SYNTHETIC ONLY: Cognism confirmation, stdin ready, real adapter progress, atomic contact merge, review report, table refresh, cancellation and Salesforce confirmation passed. No live browser or account used.');
} finally {
  if (desktop) await desktop.close();
  await rm(temporary, { recursive: true, force: true });
}
