import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Scope isolation: each frontend/BFF reaches only its own scope + shared.
            {
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: ['scope:client', 'scope:shared'],
            },
            { sourceTag: 'scope:agent', onlyDependOnLibsWithTags: ['scope:agent', 'scope:shared'] },
            { sourceTag: 'scope:dealer', onlyDependOnLibsWithTags: ['scope:dealer', 'scope:shared'] },
            { sourceTag: 'scope:broker', onlyDependOnLibsWithTags: ['scope:broker', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            // Type layering: what each kind of project may consume.
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:ui', 'type:auth', 'type:contracts'],
            },
            {
              sourceTag: 'type:bff',
              onlyDependOnLibsWithTags: ['type:bff-core', 'type:bff-auth', 'type:contracts'],
            },
            {
              sourceTag: 'type:bff-auth',
              onlyDependOnLibsWithTags: ['type:bff-core', 'type:contracts'],
            },
            { sourceTag: 'type:bff-core', onlyDependOnLibsWithTags: ['type:contracts'] },
            // Shared frontend auth: wraps the session contract for the OIDC apps.
            { sourceTag: 'type:auth', onlyDependOnLibsWithTags: ['type:contracts'] },
            // Leaves: may not depend on any other workspace lib.
            { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: [] },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      // Allow intentionally-unused, underscore-prefixed args/vars/caught-errors
      // (e.g. Fastify preHandler `_reply`, interface-conformance `_returnTo`).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];
