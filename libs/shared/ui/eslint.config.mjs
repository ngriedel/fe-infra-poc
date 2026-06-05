import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // This lib follows the Spartan NG ("Helm") convention: `hlm` selector
      // prefix and inputs deliberately aliased to `class` / the selector name.
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'hlm',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'hlm',
          style: 'kebab-case',
        },
      ],
      // Spartan primitives intentionally alias inputs (e.g. `class`, `hlmBtn`).
      '@angular-eslint/no-input-rename': 'off',
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
