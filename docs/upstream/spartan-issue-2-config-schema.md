# `buildable` and `generateAs` in `components.json` are silently ignored by `nx g :ui`

**Repo:** https://github.com/spartan-ng/spartan
**Package:** `@spartan-ng/cli@1.0.2`
**Labels:** bug, cli, nx

## Summary

In an Nx workspace, `nx g @spartan-ng/cli:ui <primitive>` parses `components.json`
with **`AngularCliConfigSchema`**, which has no `buildable` and no `generateAs`
field. Zod strips both, they fall back to `buildable: true` / `generateAs: 'library'`,
and the generator scaffolds a full Angular library — regardless of what the config says.

`buildable` and `generateAs` are documented as "(NX only)" options, but the Nx
invocation is precisely the one that cannot read them.

## Reproduction

`components.json`:

```jsonc
{
  "componentsPath": "libs/shared/ui",
  "buildable": false,
  "generateAs": "entrypoint",
  "style": "vega",
  "importAlias": "@aic/shared/ui",
}
```

```sh
nx g @spartan-ng/cli:ui badge --dry-run
```

Expected, per the config: no nested project, files under the configured path.
Actual:

```
CREATE libs/shared/ui/badge/project.json
CREATE libs/shared/ui/utils/project.json
CREATE libs/shared/ui/badge/ng-package.json
CREATE libs/shared/ui/badge/tsconfig.json
CREATE libs/shared/ui/badge/tsconfig.lib.json
CREATE libs/shared/ui/badge/tsconfig.lib.prod.json
CREATE libs/shared/ui/badge/eslint.config.mjs
UPDATE tsconfig.base.json
UPDATE nx.json
UPDATE package.json
```

Two buildable ng-packagr libraries nested inside an existing Nx project, plus a
second `utils` alongside one that already exists.

## Mechanism

`src/generators/ui/generator.ts`:

```ts
const config = await loadOrInitConfig(tree, {
  componentsPath: options.directory,
  angularCli: options.angularCli ?? true, // <- defaults to TRUE
});
```

`src/utils/config.ts`:

```ts
if (tree.exists(configPath)) {
  return getConfig(tree, defaults?.angularCli ?? false); // <- receives true
}
```

`getConfig(tree, true)` selects `AngularCliConfigSchema`, whose fields are only
`componentsPath`, `style`, `importAlias`. Zod's default object behaviour strips
the unknown `buildable` / `generateAs`, so downstream:

```ts
buildable: options.buildable ?? config.buildable ?? true,          // -> true
generateAs: options.generateAs ?? config.generateAs ?? 'library',  // -> 'library'
```

`hlmBaseGenerator` then takes the `generateAs === 'library'` branch and calls
`initializeAngularLibrary`.

`--angularCli=false` selects the right schema, but `ui/schema.json` does not declare
that option either, so it is not a documented escape hatch.

## Impact

For a workspace that keeps a single flat UI library — one barrel, no per-primitive
entry points — the generator cannot be used at all. It has to be replaced with a
script that calls `createStyleMap` / `transformStyle` directly and places the output
by hand, which then depends on unexported internals by deep path.

## Suggested fix

Pick the schema from the workspace kind rather than an option default — e.g. use
`AngularCliConfigSchema` only when there is no `nx.json` — or have `NXConfigSchema`
apply whenever `components.json` contains `buildable`/`generateAs`. A `.strict()`
on the Angular-CLI schema would at least turn the silent drop into an error.
