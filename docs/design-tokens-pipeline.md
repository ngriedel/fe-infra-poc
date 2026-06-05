# Design tokens pipeline (Figma → code)

Notes from a discussion on pulling design tokens straight from Figma to generate
Tailwind/Spartan presets. Captures both the **technical pipeline** and the harder
**organisational** side (designer buy-in, release cadence, review process).

> Status: **idea / reference only.** Not proposed for this POC — for a single web
> app with one designer, a hand-maintained CSS-vars file beats the toolchain
> overhead. This is for when there are ≥2 platforms, multi-brand/theming, or real
> handoff friction.

---

## 1. The modern technical pipeline

The hand-rolled "scrape Figma via a GraphQL wrapper, generate presets" approach
(what we built years ago) is now mostly standardised. Three boxes:

```
Figma Variables
   │  (export)
   ▼
DTCG JSON  ◄── Tokens Studio plugin (or Figma Variables REST API)
   │  (transform)
   ▼
Style Dictionary (v4, DTCG-native)
   │  (build)
   ▼
CSS vars / Tailwind preset / iOS / Android / JSON
```

**Key shifts since the old hand-rolled version:**

- **Figma Variables** (2023) replaced styles-scraping. Real, typed, multi-mode
  tokens (light/dark, brand themes) living natively in the file. Figma never
  shipped an official GraphQL API — our old one was a third-party/plugin layer.
- **DTCG format** — the W3C Design Tokens Community Group JSON spec
  (`{ "$value": ..., "$type": "color" }`). The lingua franca; no more inventing
  our own intermediate shape.
- **Tokens Studio** (formerly "Figma Tokens") — de-facto plugin. Manages tokens
  in Figma, syncs them to a Git repo as DTCG JSON, handles aliasing/math/themes
  beyond native Variables.
- **Style Dictionary v4** (Amazon, DTCG-native) — the build tool. Takes DTCG
  tokens, emits platform artifacts via configurable transforms/formats. This
  replaces our custom preset-generation code.

**Practical gotcha:** the Figma **Variables REST API** read endpoint
(`GET /v1/files/:key/variables/local`) is **Enterprise-plan only**. That pushes
most teams to the Tokens Studio + Git-sync route — which is the better
architecture anyway: versioned, reviewable in PRs, no live Figma dependency at
build time.

### Fit with our stack

Spartan NG / shadcn theming is already token-shaped — semantic CSS vars like
`--ring`, `--destructive`, `--background`. So the pipeline's only job is:
Figma → Style Dictionary → emit `:root { --destructive: …; --ring: …; }`. Tailwind
already reads those via `hsl(var(--destructive))`. With **Tailwind v4's `@theme`**
the fit is even cleaner (tokens *are* CSS custom properties).

Adjacent commercial tools doing the whole loop: **Supernova.io**, **Knapsack**.
Figma's own **Code Connect** / Dev Mode is more component-to-code than tokens, but
same "designers feed code" spirit.

---

## 2. The hard part: getting designers on board

The biggest historical challenge wasn't technical — it was adoption. Tokens only
work as a single source of truth if designers *actually maintain them* in Figma
instead of using ad-hoc hex values. Ideas:

- **Make it the path of least resistance, not extra work.** Designers should be
  picking from Variables in their normal flow, not maintaining a separate token
  doc. Native Figma Variables + Tokens Studio sit inside their existing tooling —
  lean on that rather than a parallel system.
- **Lint/guardrail the design side.** Plugins (e.g. Tokens Studio, or Figma's own
  Variables enforcement) can flag "detached" raw values that aren't bound to a
  token. Treat a raw hex like a lint error — visible, fixable, not punitive.
- **Show them the payoff fast.** The selling demo is *theming*: flip a mode and
  watch the whole app re-skin, or stand up a second brand in minutes. Multi-mode
  is the strongest justification and the most visceral demo.
- **One owner on each side.** A design-systems point person who owns the Figma
  token library, and an eng counterpart who owns the build config. Avoids the
  "everyone and no one maintains it" failure.
- **Start tiny.** Colors only first (as we did), prove the loop end-to-end, then
  expand to spacing, typography, radii, shadows. Don't boil the ocean.

---

## 3. Release schedule & review process

Tokens become shared infrastructure the moment two consumers depend on them, so
they need the same change-management rigor as any shared API.

### Source of truth & sync direction

- **Git is the source of truth, not Figma.** Tokens Studio syncs Figma → a repo
  (or a `tokens/` folder in this monorepo). The committed DTCG JSON is canonical;
  the build reads from Git, never live Figma. This is what makes review possible.
- One **direction of authority**: designers propose in Figma → sync opens a PR →
  eng/design review the JSON diff → merge triggers the build.

### Review process

- **Token changes go through PRs like code.** The DTCG JSON diff is human-readable
  (`--destructive: 0 84% 60%` → `0 72% 51%`), so a reviewer can actually reason
  about it. Require a review from both a designer and an eng for semantic changes.
- **Distinguish primitive vs semantic changes.** Editing a primitive (`red-500`)
  ripples everywhere; editing a semantic alias (`--destructive`) is scoped.
  Primitive changes warrant broader review / a visual-regression check.
- **Visual regression on the consuming app.** A token PR should run the app's
  visual snapshot tests (Chromatic / Playwright screenshots) so an unintended
  re-skin is caught before merge.

### Release cadence

- **Version the token package** (semver). Breaking = renamed/removed token or a
  primitive change with wide blast radius. Additive = new token. Patch = value
  tweak. Consumers pin a version and upgrade deliberately.
- **Batch on a cadence** (e.g. per sprint) rather than streaming every Figma tweak
  straight to prod — gives a stable target and a changelog. Hotfix path for
  genuine fixes (a11y contrast failure, wrong brand color shipped).
- **Changelog generated from the token diff** so consuming teams see what moved.

### Suggested minimal setup for here, if we ever do it

1. `tokens/` folder of DTCG JSON, synced from Figma via Tokens Studio.
2. `style-dictionary.config.js` emitting a Spartan-flavored `:root` CSS-vars file.
3. CI step: rebuild on token change, run visual-regression, open/annotate the PR.
4. Two owners (1 design, 1 eng); semver tags; per-sprint batch + hotfix lane.

> Reminder: only worth this machinery with multiple platforms/brands or real
> handoff friction. For the current POC, keep the shadcn vars by hand.

---

## Appendix — concrete Style Dictionary → Spartan output

A minimal, runnable sketch targeting *this* repo's actual tokens
([apps/client/src/styles.css](../apps/client/src/styles.css)). The one non-obvious
bit: Spartan/shadcn stores colors as **bare HSL channels** (`221.2 83.2% 53.3%`),
not `#hex` or `hsl(...)`, so they can be composed as `hsl(var(--primary) / <alpha>)`.
That means we need a small custom transform — Style Dictionary's stock CSS output
would emit `#hex`.

### A. Source tokens (DTCG JSON, synced from Figma)

Two tiers — **primitives** (raw scale, what designers rarely touch directly) and
**semantic** aliases (what components consume). Modes live as separate files or as
DTCG `$extensions`; shown here as two theme files for clarity.

`tokens/primitives.json`
```json
{
  "blue":  { "600": { "$type": "color", "$value": "hsl(221.2 83.2% 53.3%)" } },
  "slate": {
    "50":  { "$type": "color", "$value": "hsl(210 40% 98%)" },
    "900": { "$type": "color", "$value": "hsl(222.2 47.4% 11.2%)" }
  },
  "red":   { "500": { "$type": "color", "$value": "hsl(0 84.2% 60.2%)" } },
  "radius": { "md": { "$type": "dimension", "$value": "0.5rem" } }
}
```

`tokens/semantic.light.json`
```json
{
  "background":  { "$type": "color", "$value": "{slate.50}" },
  "foreground":  { "$type": "color", "$value": "{slate.900}" },
  "primary":     { "$type": "color", "$value": "{blue.600}" },
  "primary-foreground": { "$type": "color", "$value": "{slate.50}" },
  "destructive": { "$type": "color", "$value": "{red.500}" },
  "ring":        { "$type": "color", "$value": "{blue.600}" },
  "radius":      { "$type": "dimension", "$value": "{radius.md}" }
}
```

(A `semantic.dark.json` overrides the same keys with the dark palette — these are
exactly Figma Variable *modes*.)

### B. Custom transform + config

`style-dictionary.config.js`
```js
import StyleDictionary from 'style-dictionary';

// shadcn stores colors as bare HSL channels: "221.2 83.2% 53.3%".
// Strip the hsl() wrapper that DTCG values carry so vars compose as
// hsl(var(--primary) / <alpha>).
StyleDictionary.registerTransform({
  name: 'color/hsl-channels',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) =>
    String(token.$value).replace(/^hsl\(/i, '').replace(/\)$/, '').trim(),
});

// Emit a :root (or .dark) block instead of the default selector.
StyleDictionary.registerFormat({
  name: 'css/spartan-vars',
  format: ({ dictionary, options }) => {
    const sel = options.selector ?? ':root';
    const lines = dictionary.allTokens.map((t) => `    --${t.name}: ${t.$value};`);
    return `@layer base {\n  ${sel} {\n${lines.join('\n')}\n  }\n}\n`;
  },
});

const base = {
  transform: ['name/kebab', 'color/hsl-channels'],
  buildPath: 'libs/shared/ui-tailwind-preset/src/generated/',
};

export default {
  platforms: {
    light: {
      ...base,
      source: ['tokens/primitives.json', 'tokens/semantic.light.json'],
      files: [{ destination: '_tokens.light.css', format: 'css/spartan-vars',
                options: { selector: ':root' } }],
    },
    dark: {
      ...base,
      source: ['tokens/primitives.json', 'tokens/semantic.dark.json'],
      files: [{ destination: '_tokens.dark.css', format: 'css/spartan-vars',
                options: { selector: '.dark' } }],
    },
  },
};
```

> Note: in SD v4, `transform: 'name/kebab'` + alias resolution mean only the
> *semantic* tokens that get referenced surface as `--vars`; primitives stay as
> internal aliases. Filter primitives out of the final file if any leak through.

### C. Generated output

`npx style-dictionary build` → `_tokens.light.css`:
```css
@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222.2 47.4% 11.2%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}
```

…which is byte-for-byte the kind of block currently hand-written in
[styles.css](../apps/client/src/styles.css). The app's `@tailwind base` import would
just `@import` the two generated files instead of inlining the `:root`/`.dark`
blocks; nothing in the Tailwind preset
([libs/shared/ui-tailwind-preset](../libs/shared/ui-tailwind-preset/src)) changes —
it still reads `hsl(var(--primary))`.

### D. Wiring it up

1. `tokens/` ← synced from Figma by Tokens Studio (or committed by hand to start).
2. `nx run shared-ui:build-tokens` wraps the SD build; outputs to
   `libs/shared/ui-tailwind-preset/src/generated/`.
3. Each app's `styles.css` swaps its inline `:root { … }` for
   `@import '…/generated/_tokens.light.css';` + `…dark.css`.
4. CI runs the build, fails if `generated/` is dirty (tokens changed but not
   rebuilt), then runs visual-regression on the apps.

This is a couple hours of setup and entirely decoupled from Figma — you can adopt
steps 1–3 with hand-edited `tokens/*.json` today and bolt Figma sync on later.
