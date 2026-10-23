import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', '.tooling/**', '.npm-cache/**', '.electron-cache/**', 'backend/**', 'artifacts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', requestAnimationFrame: 'readonly', document: 'readonly', window: 'readonly' } } },
);
