import { spawnSync } from 'node:child_process';
import { isAbsolute } from 'node:path';

const configured = process.env.TACHYON_PYTHON;
if (configured && !isAbsolute(configured)) throw new Error('TACHYON_PYTHON must be an absolute executable path.');
const result = spawnSync(configured || (process.platform === 'win32' ? 'python' : 'python3'),
  ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*worker.py', '-v'],
  { shell: false, stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
if (result.error) console.error('Could not start Python tests:', result.error.message);
process.exitCode = result.status ?? 1;
