import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Two selector prefixes: `hlm` for Spartan helm primitives (copied/owned),
      // `ui` for our own generic composites (theme toggle, etc.). Inputs are
      // deliberately aliased to `class` / the selector name (Spartan convention).
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: ['hlm', 'ui'],
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['hlm', 'ui'],
          style: 'kebab-case',
        },
      ],
      // Spartan primitives intentionally alias inputs (e.g. `class`, `hlmBtn`).
      '@angular-eslint/no-input-rename': 'off',
    },
  },
  {
    // Spartan CLI-generated reactive class manager: the `manager!` non-null
    // assertions are safe (manager is assigned before every closure runs).
    // Keep verbatim so future CLI diffs stay clean.
    files: ['**/lib/utils/hlm.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.html'],
    rules: {
      // Form-field wrappers associate a label by projecting the control inside
      // the <label> via <ng-content>, which the static rule can't see.
      '@angular-eslint/template/label-has-associated-control': 'off',
    },
  },
];
