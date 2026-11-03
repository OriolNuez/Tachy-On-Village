import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // These existing .tsx files are Tiled XML tilesets, not TypeScript/React.
  { ignores: ['node_modules/**', 'out/**', '.tooling/**', '.npm-cache/**', '.electron-cache/**', 'backend/**', 'artifacts/**', 'Tachyon/Cadences/**', 'animated_white_sand_shore_autotile_by_j_treecko252_deuric4.tsx', 'pokemon_tileset_from_public_tiles_32x32_by_chaoticcherrycake_dab2byf.tsx'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', requestAnimationFrame: 'readonly', document: 'readonly', window: 'readonly' } } },
);
