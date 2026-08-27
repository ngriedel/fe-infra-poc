# `--style=<unknown>` is accepted and silently emits unstyled components

**Repo:** https://github.com/spartan-ng/spartan
**Package:** `@spartan-ng/cli@1.0.2` (path unchanged on `main`)
**Labels:** bug, cli

## Summary

`nx g @spartan-ng/cli:ui <primitive> --style=<unknown>` **succeeds** and writes a
component with the entire style recipe stripped. No error, no warning. The
component compiles, lints and renders — with no border, height, background,
focus ring or invalid styling.

The `style` enum in `components.json` is validated (`z.enum(STYLES)`), so the
config path is guarded. The **flag** path is not.

## Reproduction

```sh
nx g @spartan-ng/cli:ui badge --style=aic --dry-run
# exits 0, CREATEs every file
```

## Mechanism

Three things line up:

1. `src/generators/ui/schema.json` declares only `name`, `directory`, `tags` — no
   `style`. Nx does not reject undeclared options (no `additionalProperties: false`),
   so `--style` lands in `options` regardless.
2. `src/generators/ui/generator.ts` reads it: `style: options.style ?? config.style`,
   bypassing the `z.enum(STYLES)` validation that only ever runs against
   `components.json`.
3. `getStyleMap()` in `src/generators/base/generator.ts` swallows the failure:

```js
try {
  const cssPath = path.join(__dirname, '..', 'ui', `style-${style}.css`);
  const css = await fs.promises.readFile(cssPath, 'utf-8');
  return createStyleMap(css);
} catch {
  return {}; // <- ENOENT for an unknown style
}
```

An empty style map is not inert. `transformStyleMap` calls
`removeSpartanClasses(...)` unconditionally, so the `spartan-*` placeholders are
**deleted** rather than left in place — nothing replaces them and nothing reports it.

## Demonstrated

Running the CLI's own `transformStyle` over the `input` template with
`styleMap: {}` (exactly what `getStyleMap` returns for an unknown style):

```
// expected (style: vega)
'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50
 … h-9 rounded-md border bg-transparent px-2.5 py-1 … file:text-foreground …'

// actual (style: aic)
'file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none
 file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none …'
```

`spartan-input` — the whole visual recipe — is gone.

## Suggested fix

Either is small:

- declare `style` in `ui/schema.json` with `"enum": STYLES`, so Nx rejects it; or
- have `getStyleMap` rethrow on `ENOENT` (keep the catch for genuinely optional cases),
  so an unknown style fails loudly instead of degrading.

The silent-degradation path is the dangerous one: a typo produces a component that
looks broken with no indication of why.
