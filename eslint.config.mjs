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
            {
              sourceTag: 'scope:dealer',
              onlyDependOnLibsWithTags: ['scope:dealer', 'scope:shared'],
            },
            {
              sourceTag: 'scope:broker',
              onlyDependOnLibsWithTags: ['scope:broker', 'scope:shared'],
            },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            // Type layering: what each kind of project may consume.
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:ui', 'type:auth', 'type:contracts'],
            },
            {
              sourceTag: 'type:bff',
              onlyDependOnLibsWithTags: [
                'type:bff-core',
                'type:bff-auth',
                'type:data-access',
                'type:contracts',
              ],
            },
            {
              sourceTag: 'type:bff-auth',
              onlyDependOnLibsWithTags: ['type:bff-core', 'type:contracts'],
            },
            { sourceTag: 'type:bff-core', onlyDependOnLibsWithTags: ['type:contracts'] },
            // Shared frontend auth: wraps the session contract for the OIDC apps.
            { sourceTag: 'type:auth', onlyDependOnLibsWithTags: ['type:contracts'] },
            // Generated upstream clients (e.g. the ESL OpenAPI→Zod client).
            { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:contracts'] },
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
      // Zod import hygiene, enforced because both mistakes are invisible at review.
      //
      // `import { z } from 'zod'` pulls in a materialized namespace object that
      // defeats tree-shaking and retains all 53 locale files. Measured in this
      // repo on a route that validates at runtime: 55.47 kB gzip vs 18.98 kB for
      // the namespace form — same schema, same call site, only the import line.
      // `import * as z from 'zod'` is the form Zod's own docs use.
      //
      // `zod/mini` is banned outright for now. It saves ~13 kB gzip on top, but
      // a mini schema's .parse() throws core `$ZodError`, which is NOT
      // `instanceof` the classic `ZodError` that libs/bff/core's error handler
      // branches on — so adopting it silently converts 400s into 500s. Revisit
      // only alongside that handler.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='zod'][importKind!='type'] > ImportSpecifier[imported.name='z'][importKind!='type']",
          message:
            "Use `import * as z from 'zod'` — the named `z` export defeats tree-shaking (+36 kB gzip on a runtime-validating route).",
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zod/mini',
              message:
                'zod/mini is not adopted: its $ZodError is not instanceof ZodError, so the BFF error handler would turn 400s into 500s. See docs/direction-review.md.',
            },
          ],
        },
      ],

      // Allow intentionally-unused, underscore-prefixed args/vars/caught-errors
      // (e.g. Fastify preHandler `_reply`, interface-conformance `_returnTo`).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];
