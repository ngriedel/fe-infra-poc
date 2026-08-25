# Spartan UI component architecture

How we build, style, own, and reuse UI components across the AIC frontends.
This is the reference for **where things live**, **how they're styled**, and the
**decision rules** for turning a Spartan primitive into one of our own components.

> Status: **decided & in progress (2026-07-01).** This supersedes the initial
> "Tailwind v4 deferred" scaffold choice. See [Decision](#0-decision-summary).

---

## 0. Decision summary

This is a **correctness-first POC**: it should demonstrate the _canonical_ way to
build with Spartan NG, not a hand-rolled approximation that merely works. That
principle forced one concrete decision:

> **Migrate to Tailwind v4 and adopt the real Spartan 1.0 CLI workflow.**

Why it's not optional: `@spartan-ng/brain@1.0.2` (current stable) declares
`tailwindcss ">=4.0.0"` and `tw-animate-css` as **required peers**. On Tailwind v3
the canonical Spartan toolchain simply cannot run. Staying on v3 is what produced
every symptom we found (no CLI, a hand-written button missing its behaviour layer,
a `tailwind-merge` version mismatch).

The upgrade is clean: **Spartan 1.0.2 peers `@angular/core ">=21 <23"`, so it runs
on our held Angular 21** — the Tailwind v4 move is fully **independent of the
[Angular 22 hold](angular-22-upgrade.md)**.

---

## 1. The mental model: brain → helm → composite

Spartan is a **two-layer** system, and we add a third layer of our own:

| Layer                  | What it is                                                                                                                                                              | Who owns it                              | Where it lives                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **brain** (`brn*`)     | Headless, accessible behaviour: ARIA, keyboard nav, focus management, disabled-state normalisation. Zero visual opinion.                                                | Spartan (npm, auto-updated)              | `@spartan-ng/brain/*`                                                  |
| **helm** (`hlm*`)      | The styled skin: thin Angular directives/components that apply Tailwind classes (via CVA + `classes()`/`cn`) and attach the matching brain primitive. shadcn-flavoured. | **Us** — copied into the repo by the CLI | `libs/shared/ui`                                                       |
| **composite** (`ui-*`) | _Our_ components: combine ≥1 primitive, add structure/slots, or encode an app-domain concept.                                                                           | **Us**                                   | `libs/shared/ui` (generic) or a `feature` lib / the app (app-specific) |

Key facts that shape everything below:

- **Helm is copy-in, not a dependency.** There is no `@spartan-ng/helm` npm
  package and there never will be (maintainer confirmed). The CLI _generates the
  source into our repo_ so we own and restyle every line — the shadcn philosophy.
  Our `libs/shared/ui` **is** our helm layer.
- **brain is a real dependency** we install and let Spartan maintain. It's where
  the hard accessibility work lives — we never hand-roll it.

### Why the current button is wrong

The existing `hlm-button.directive.ts` was **hand-authored** (commit `5b05958`,
"clean Spartan-style starter"), not CLI-generated. It skips brain entirely. That's
not merely stylistic — its selector is `button[hlmBtn], a[hlmBtn]`, but it relies
on `disabled:*` utilities, and **`disabled` isn't a real attribute on `<a>`**. So
`<a hlmBtn disabled>` neither dims nor blocks clicks. Canonical helm wires
`BrnButton` via `hostDirectives`, which normalises exactly this. The fix is to
generate the button the canonical way.

---

## 2. Where things live (Nx library architecture)

### One shared UI lib (flat), single barrel

All helm + generic composites live in the **single** `libs/shared/ui` library
(tags `scope:shared`, `type:ui`), exported through one barrel (`@aic/shared/ui`).
We do **not** create a lib-per-component and we do **not** duplicate UI into apps.
Both frontends consume it.

> **Packaging decision (learned from the CLI's real output).** Spartan's CLI
> `generateAs: "entrypoint"` does **not** add lightweight secondary entry points
> to an existing lib — it scaffolds a **separate buildable ng-packagr library per
> primitive** (e.g. `libs/shared/ui/button`, `libs/shared/ui/utils`, each with its
> own `project.json`/`ng-package.json`). Pointed at our existing `libs/shared/ui`,
> that **nests Nx projects inside another project** (an anti-pattern). So we keep
> our single flat lib and place the CLI's (style-transformed) output into
> `src/lib/<name>/`, wired through the barrel. The component **code is
> byte-identical to the generator**; only the packaging differs. Revisit adopting
> Spartan's per-lib layout if the library grows large enough to want per-component
> build granularity.

### `components.json` (repo root)

The CLI is configured by a root `components.json` (analogous to shadcn's). We
commit it explicitly so `style`/`importAlias` are fixed and codemods
(`healthcheck`, `migrate-*`) read a stable alias:

```jsonc
{
  "componentsPath": "libs/shared/ui",
  "buildable": false,
  "generateAs": "entrypoint",
  "style": "vega", // component recipe flavour (see §4)
  "importAlias": "@aic/shared/ui",
}
```

> **Adding a component:** do **not** run `nx g @spartan-ng/cli:ui <name>`
> directly against this repo — it nests buildable libs (see above). Instead
> generate to a scratch path (or read the templates under
> `node_modules/@spartan-ng/cli/src/generators/ui/libs/<name>`), copy the
> transformed `hlm-*.ts` into `libs/shared/ui/src/lib/<name>/`, repoint its
> `classes` import to `../utils/hlm`, add a per-folder `index.ts`, and export it
> from the barrel. Diff the CLI templates on upgrade to pull upstream fixes (§7).

### Module boundaries

Enforced in ESLint via `@nx/enforce-module-boundaries`:

- `type:ui` may depend on `type:ui` and `type:util` **only** — never on
  `type:feature`, an app, or a `scope:client` / `scope:agent` lib.
- The litmus for "does it belong in `shared/ui`?": no app models/services, no
  HTTP/router/store injection, named after a **UI role** not a **business
  concept**. `<ui-stat-card>` yes; `<checkout-summary>` no (that's a feature lib).

### The Tailwind preset's fate

`libs/shared/ui-tailwind-preset` was a Tailwind **v3 JS preset**
(`Partial<Config>` mapping `hsl(var(--x))`). Tailwind v4 is **CSS-first** — the
preset concept goes away. It's replaced by a shared **theme CSS** (`@theme` +
token vars) that both apps `@import`. See §4.

---

## 3. Styling conventions

- **Variants** are declared with **CVA** (`class-variance-authority`): a base
  class string, a `variants` map, and `defaultVariants`. Export the CVA function
  and its `VariantProps`-derived union types so other components can compose the
  same variants.
- **Class merging** uses the generated **`classes()`** helper (canonical Spartan
  1.0) — an effect-based host-class manager that avoids the interference a raw
  `[class]` host binding causes. `cn()` (`twMerge(clsx(...))`) remains available
  for plain string merging.
- **Override-by-class is sacred.** Every component exposes an overridable `class`
  input and applies it **last** so a consumer's class wins:
  `classes(() => [buttonVariants({ variant, size }), userClass()])`. Ordering
  (base → variants → user) is the one rule that must never be reversed.
- **`tailwind-merge`** must match the Tailwind major: **v3.x of the lib for
  Tailwind v4** (what we'll be on). The current `^3.6.0` becomes correct after the
  migration; on the old Tailwind v3 it was a latent mis-merge bug.
- **Multi-part components** (card, dialog, field) use **per-part class strings**,
  one directive/component per part (the shadcn/Spartan pattern) — **not**
  `tailwind-variants` slots. Don't introduce a second styling paradigm.

---

## 4. Design tokens & theming (Tailwind v4)

### The token tiers

- **Semantic tokens** (`--primary`, `--background`, `--ring`, `--radius`, …) are
  what components consume. Components reference **only** these — never raw palette
  colours (`bg-blue-600`) — so a re-skin never touches component code.
- **Primitive tokens** (raw scales like `blue-600`) are **not** hand-maintained in
  app CSS. They arrive later via the [Style Dictionary pipeline](design-tokens-pipeline.md)
  as a build tier. Keep app CSS semantic-only.

### v4 wiring (replaces the JS preset)

Tailwind v4 is configured in CSS. A shared theme file maps semantic names to CSS
variables via `@theme`, and dark mode becomes a custom variant:

```css
/* shared theme (imported by both apps) */
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* …ring, muted, accent, destructive, card, popover… */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

> **v4 gotcha — content scanning.** v4 auto-detects an app's own sources, but
> classes that live in `libs/shared/ui` are outside the app and get purged unless
> declared. Add `@source "<relative-path-to>/libs/shared/ui/src";` in each app's
> CSS. This replaces the v3 `createGlobPatternsForDependencies` call.

### Values: OKLCH

Token **values** move to **OKLCH** (the Spartan/shadcn v4 default; perceptually
uniform). Each app's CSS supplies `:root` (light) and `.dark` blocks:

```css
:root {
  --primary: oklch(0.62 0.19 259);
  --radius: 0.5rem; /* … */
}
.dark {
  --primary: oklch(0.62 0.19 259); /* … */
}
```

> Note the storage rule **inverts** from v3: v4 stores the full colour function in
> the var and maps `--color-x: var(--x)`; v3 stored bare HSL channels and wrapped
> with `hsl()` in the config. Don't copy v3 snippets.

### Per-app branding & dark mode

- **One shared base, per-app overrides.** A shared theme holds the structure +
  defaults; each app overrides only its brand vars (`--primary`, `--ring`,
  `--radius`, …). A third brand later = a new app CSS that imports the base and
  sets ~5 vars.
- **Dark mode** = a signals `ThemeService` toggling `.dark` on
  `document.documentElement`, plus a **synchronous inline `<script>`** in
  `index.html` that sets the class before first paint (a service alone flashes).

---

## 5. The decision rule (the core question)

> "We want our buttons rounded, orange, with special spacing." Token change? New
> variant? New component?

Resolve it with three gates, in order of preference:

**Gate 1 — Token change (default answer for "style X _everywhere_").**
If it's a system-wide statement, edit the tokens, nothing else:

```css
:root {
  --primary: oklch(0.7 0.19 40); /* orange */
  --ring: oklch(0.7 0.19 40);
  --radius: 1rem; /* more rounded everywhere */
}
```

Every `bg-primary`, `ring-ring`, and `rounded-*` (incl. all of `buttonVariants`)
inherits it. No TS changes. If only one app should change, edit only that app's
CSS — that's why tokens are per-app.

**Gate 2 — New CVA variant (a recurring, _named_ intent that coexists with the
default).** e.g. a `cta`/`pill` button used in many places:

```ts
variant: {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  cta: 'rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90',
}
// <button hlmBtn variant="cta">Get started</button>
```

**Gate 2b — One-off at a single call site:** just override inline, no abstraction:
`<button hlmBtn class="rounded-full px-8">Buy now</button>`.

**Gate 3 — New component.** Only when you're adding **structure** (icon + label +
spinner slots), **composing multiple primitives**, or encoding **domain meaning**.
Never create a component whose whole job is to hard-code a class string — that's
the premature-abstraction trap.

---

## 6. When to promote to _our_ component (composite)

A composite belongs in `libs/shared/ui` when it's **generic and structural**:

```ts
@Component({
  selector: 'ui-form-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-content />`,
})
export class UiFormActions {
  readonly align = input<'start' | 'end' | 'between'>('end');
  readonly userClass = input<string>('', { alias: 'class' });
  protected readonly classes = computed(() =>
    cn('flex items-center gap-2', ALIGN[this.align()], this.userClass()),
  );
}
```

Rules that keep composites clean:

- **Project, don't wrap.** A composite **projects** `<button hlmBtn>` children via
  `<ng-content>` rather than attaching `HlmButton` through `hostDirectives`. Two
  `[class]`-owning directives on one host clobber each other (silent
  last-writer-wins), and projection preserves override-by-class.
- **Composition over prop-explosion.** When tempted to add a 4th boolean input,
  add a named slot (`<ng-content select="[slot=…]">`) instead.
- **`hostDirectives` is for behaviour**, i.e. attaching a **brain** directive to a
  composite — not for re-hosting a styled helm directive.
- **No app state in `shared/ui`.** A component that injects a domain store or is
  named after a business concept (`checkout-*`) goes in a `type:feature` lib.
- **Rule of three for cross-app reuse.** Duplicate until it hurts. Visual
  similarity isn't reusability (colours already unify via tokens); only
  _structural_ sameness justifies promotion. Extract on the 3rd real need.

### Worked example: the form-field

Our `HlmFormFieldComponent` is Signal-Forms-aware (auto-derives error state from
the projected control). That's genuine domain value → it's a legitimate
**composite** and stays. But it will be **rebuilt to compose the CLI-generated
helm `input`/`label`/`error` primitives**, instead of the current hand-rolled
ones. That's the promotion rule in practice: keep the smart wrapper, own the
primitives canonically underneath.

---

## 7. Maintenance & updates

Copied helm is **owned code** — there is no smart 3-way merge with upstream.

- **To pull upstream fixes:** bump `@spartan-ng/brain` + `@spartan-ng/cli`
  **together** (same version), run `nx g @spartan-ng/cli:healthcheck` (applies
  codemods), then **diff** the CLI's templates against our copy and reapply
  relevant changes by hand. Git is the merge tool.
- **Never** run `nx g @spartan-ng/cli:migrate-helm-libraries` or re-run `:ui` over
  a customised component — it **overwrites** local changes.
- **Keep local edits small and documented** so the diff stays legible. Prefer
  token/variant changes (which live outside the generated structure) over editing
  generated internals.

---

## 8. Migration plan (phased)

Executed as a **thin vertical slice first** (button), then breadth.

**Phase 0 — Toolchain**

- `@spartan-ng/brain` + `@spartan-ng/cli` `alpha.697 → 1.0.2` (pinned together).
- Add peers: `tw-animate-css`, `luxon`, `@ng-icons/core`, `@ng-icons/lucide`,
  `@tailwindcss/postcss`. Remove unused `@lucide/angular`.

**Phase 1 — Tailwind v3 → v4**

- **PostCSS config must be JSON**: `.postcssrc.json` with `@tailwindcss/postcss`.
  Angular's `@angular/build` only reads `.postcssrc.json`/`postcss.config.json` —
  a `postcss.config.js` is silently ignored and Tailwind never runs.
- `styles.css` → `@import 'tailwindcss'` + `tw-animate-css`; `@theme`;
  `@custom-variant dark`; `@source` for `libs/shared/ui`.
- Convert `ui-tailwind-preset` (JS) → shared theme CSS; values → OKLCH.
- Remove `tailwind.config.ts` JS preset usage.

**Phase 2 — CLI + button**

- Commit root `components.json`.
- `nx g @spartan-ng/cli:ui button` → brain-wired `HlmButton` + generated `utils`.
- Delete the hand-rolled directive; update the showcase; add specs (variant→class,
  override-wins, `<a hlmBtn disabled>` now blocks).

**Phase 3 — Form stack**

- Generate helm `input`/`label`/`form-field` primitives via CLI.
- Rebuild `HlmFormField` composite over them; migrate icon usage to `@ng-icons`.

**Phase 4 — Tokens, branding, pipeline**

- Update [design-tokens-pipeline.md](design-tokens-pipeline.md) to its v4 shape.
- Prove the model with the "orange/rounded/spacing" brand as pure token overrides.
- De-dupe the two `styles.css` into shared base + per-app overrides.

**Phase 5 — Correctness scaffolding**

- `@nx/enforce-module-boundaries` constraints.
- Signals `ThemeService` + no-flash inline script + `<meta name="color-scheme">`.
- Update [feature-overview.md](feature-overview.md).

---

## 9. Open decisions

| Decision                           | Options                                             | Chosen                                    |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Component recipe flavour (`style`) | `vega` / `nova` / `lyra` / `maia` / `mira` / `luma` | `vega` (swappable; preview on spartan.ng) |
| Base colour theme (`init --theme`) | `neutral` / `stone` / `zinc` / `gray` / `slate`     | `slate` (rebrand per-app later)           |
| Token value format                 | OKLCH / hsl()                                       | **OKLCH** (done)                          |
| Library packaging                  | Spartan per-lib / single flat lib                   | **single flat `@aic/shared/ui`** (done)   |

### Resolved: "Empty sub-selector" warning = Tailwind wasn't running

An earlier build logged `N rules skipped … & -> Empty sub-selector`. The
2026-07-01 audit root-caused it: `@angular/build` only reads
`.postcssrc.json`/`postcss.config.json`, **never `postcss.config.js`** — so once
the v3 `tailwind.config.ts` was deleted, Tailwind stopped running entirely and the
apps shipped **uncompiled CSS with zero utilities**. The warning was the canary,
not a benign artifact. **Fixed** by switching both apps to `.postcssrc.json`;
verified `.bg-primary`/`.inline-flex` now emit, `@apply` fully resolves, and the
warning is gone.

---

## 10. References

Verified during research (workflow `wf_b3713cd2-69d`), primary sources:

- Spartan: spartan.ng (installation, theming, dark-mode, CLI, components.json,
  update-guide), `goetzrobin/spartan` GitHub, installed
  `@spartan-ng/cli` generator templates & `@spartan-ng/brain@1.0.2` peers.
- shadcn: ui.shadcn.com (theming, tailwind-v4).
- Tailwind: tailwindcss.com (functions-and-directives, upgrade-guide),
  `dcastil/tailwind-merge` (v3 release notes, configuration).
- Nx: nx.dev (enforce-module-boundaries). Angular: angular.dev
  (directive-composition-api, zoneless).

---

## AIC brand palette (added 2026-08-25)

The official palette from the AIC brand document now lives in
[libs/shared/ui/src/theme.css](../libs/shared/ui/src/theme.css), kept as **hex** so a
reviewer can diff it against that document directly (the rest of the file is Spartan's
OKLCH "slate" base).

### Two layers

**1. Raw brand values,** prefixed `--aic-*` and transcribed verbatim. Each status has an
_outline_ (strong line/icon/text) and a _filled_ (pale surface tint):

| Group          | Token(s)                                                                |
| -------------- | ----------------------------------------------------------------------- |
| Focus          | `--aic-focus` `#AF144B`                                                 |
| Auto-filled    | `--aic-autofill` `#FAFFBD`                                              |
| Information    | `--aic-info` `#099EF3` · `--aic-info-filled` `#F5FBFF`                  |
| Error          | `--aic-error` `#FED6C9` · `--aic-error-filled` `#FFF6F5`                |
| Success        | `--aic-success` `#3BB719` · `--aic-success-filled` `#F7FCF6`            |
| Warning        | `--aic-warning` `#FF9700` · `--aic-warning-filled` `#FFFBF5`            |
| Secondary      | active `#B5B2B2` · helper `#524A4A` · filled `#F9F8F8` · line `#E3E2E2` |
| Step Indicator | selected `#870A3C` · disabled `#CAC7C7`                                 |

**2. Mapped onto Spartan/shadcn semantics,** so existing components inherit the brand with
no component-level changes:

```
--ring             <- --aic-focus            (focus rings are brand crimson)
--border, --input  <- --aic-secondary-line
--muted-foreground <- --aic-secondary-helper
--muted, --secondary, --accent <- --aic-secondary-filled
--primary          <- --aic-step-selected    (PROVISIONAL — see below)
```

The status families (information/success/warning/error) have no shadcn equivalent, so they
are registered as new Tailwind colours in an `@theme inline` block: `border-info`,
`bg-success-filled`, `text-warning` and so on. `inline` keeps each utility pointing at the
`var()` rather than baking in a value, which is what lets dark mode re-point them.

Autofill is applied for real, via a `:-webkit-autofill` box-shadow override — otherwise the
browser forces its own yellow.

### Per-app accent

All four portals share the palette. The single token an app overrides is `--app-accent`,
used for the strip across the top of the shell:

| App    | Accent                | Hex       |
| ------ | --------------------- | --------- |
| client | step-selected crimson | `#870A3C` |
| agent  | information blue      | `#099EF3` |
| dealer | success green         | `#3BB719` |
| broker | warning orange        | `#FF9700` |

This replaces the old per-app `--primary` overrides (teal/violet/blue), which were invented
colours rather than brand ones.

### Confirmed and outstanding

**Confirmed.** `--primary` is the AIC brand crimson `#AF144B`. The DSP base also gave us
the logo red `#DC0032` (declared as `--aic-logo`, **reserved for the logo, not a UI
colour**), white background, and graphite-black foreground `#2D2323`.

**Changed on instruction.** The brand document lists the Error _outline_ as `#FED6C9`, a
pale peach. Every other status outline is a strong saturated colour and a peach line does
not read as an error, so `--aic-error` is now `#D32F2F`. That specific red is
**provisional** — swap it for the official error red when the brand team confirms one. The
pale `#FFF6F5` error surface is unchanged.

**Still outstanding — dark mode is derived, not official.** The palette is light-mode: the
"filled" tints are near-white and vanish on a dark page. Each pale surface is re-derived as
its own accent over the dark background, preserving the light-mode relationship instead of
inventing hues, and the crimsons plus the error red are lifted for contrast. Needs brand
sign-off.

**Derived values are stored as literal hex, not a live `color-mix()`.** The build (lightningcss)
emits a plain fallback alongside an `@supports (color: color-mix(…))` wrapper, and that
fallback resolves to the _un-mixed_ colour — which would render each subtle tint at full
strength as a surface on a pre-2023 browser, and would make broker's accent identical to
client's. The literals are exactly what `color-mix(in oklab, …)` produces, computed once.
This is the same reasoning as preferring hex over HSL channels: store the value, keep it
diffable, don't make the browser recompute it.

---

## Why this is CSS-first, not a Tailwind preset

A Tailwind **preset** (`Partial<Config>` with `theme.extend.colors`) plus **bare HSL
channel** tokens (`--brand: 338.7 79.5% 38.2%`) is the correct shadcn pattern **for
Tailwind v3**. This repo is on **v4.3.2**, where that shape is either removed or no longer
buys anything:

| v3 pattern                                | Status in v4                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `@tailwind base/components/utilities`     | Replaced by `@import "tailwindcss"`                                       |
| JS config `theme.extend.colors`           | Replaced by the CSS `@theme` directive                                    |
| `container: { center, padding, screens }` | Options removed; use `@utility container`                                 |
| `darkMode: 'class'`                       | Replaced by `@custom-variant dark` (Spartan's preset already declares it) |
| Bare HSL channels for `/alpha`            | Unnecessary — see below                                                   |

The bare-channel trick existed because v3 needed `hsl(var(--x) / <alpha-value>)` for opacity
modifiers to work. v4 composes alpha with `color-mix()` instead, so it works on any full
colour value. Verified in this repo's own compiled CSS — `outline-ring/50`, where `--ring`
resolves to the plain hex `#af144b`, emits:

```css
outline-color: color-mix(in oklab, var(--ring) 50%, transparent);
```

So splitting colours into channels costs readability and gains nothing. It also introduces a
conversion step that can drift: the DSP base carries a `TODO - check all HSL value
conversions`, and indeed `#2D2323` is listed as `0 13.6% 15.7%` where the true saturation is
`12.5%`. Storing `#2D2323` removes that class of bug entirely, and keeps the file diffable
against the brand document.

**What was worth borrowing from the DSP base, and has been:** a single company-wide token
file as the source of truth; brand and logo as first-class named tokens with the logo
explicitly reserved; `-foreground` pairs; provenance in the file header; and apps
overriding tokens _after_ the import rather than redefining them.

**Class-based theming** (`.theme-agent { --primary: … }`) is a genuinely good v4-compatible
pattern and is worth adopting if a single app ever needs to host more than one theme at
once, or switch theme at runtime. It is not needed yet: each app here is one theme, so the
accent is set once on `:root`. The token indirection means moving to `.theme-*` later is a
selector change, not a re-architecture.

---

## Is this the canonical approach? (verified 2026-08-25)

Checked against the Tailwind v4 docs and the Spartan theming docs rather than assumed.

### Confirmed correct

**`@theme inline` for tokens that reference other variables.** Spartan documents exactly this
shape — `@theme inline { --color-warning: var(--warning); }` — and it is what we use.

It turns out to be **required**, not merely preferred. Tailwind's [theme docs](https://tailwindcss.com/docs/theme)
explain that plain `@theme` makes the utility reference the theme variable, which CSS then
resolves **where that variable was defined** — at `:root`. A `.theme-<app>` class on a
descendant would therefore be ignored. `@theme inline` substitutes the value, so the utility
emits `background-color: var(--app-accent)` and resolves at the element. Confirmed in our own
compiled CSS.

A widely-shared blog post claims `@theme inline` "bakes values at build time and breaks dark
mode". That is only true when the value is a **literal**; with a `var()` reference — which is
the documented pattern and ours — the reference is what gets inlined, and dark mode works.

**Custom semantic colours as `--x` + `--x-foreground` pairs, registered via `@theme inline`.**
Spartan's documented example for adding a `warning` colour. Ours follow it.

**Components consuming semantic tokens only.** `HlmButton` already did; `ui-transaction-card`
was written to the same rule.

### Fixed as a result of this check

1. **Dark selector aligned.** Spartan documents `.dark { … }`; we had `:root.dark`. Now `.dark`.
   (The `<body>` theme class still wins by inheritance, so the reasoning below is unaffected.)
2. **Missing `-foreground` pairs added** for info/success/warning/error/step-selected — Spartan's
   convention includes them and we had none, so a component had no defined text colour on a
   solid status surface.
3. **Accent foregrounds were wrong.** Every theme paired its accent with white. Measured
   against WCAG: white on dealer's orange is **2.17:1** and on broker's blue **2.92:1** — both
   fail AA. Each theme now pairs with its matching `-foreground` token (graphite on
   info/success/warning, white on brand/plum/error). No live bug, since the accent currently
   renders as a text-free rule, but the token was wrong and would have failed the first time
   anything put a label on it.

### Deliberate divergences

**Colour format.** Spartan uses OKLCH exclusively. The `--aic-*` layer is hex, because the
brand document is hex and keeping it diffable against that document matters more here than
matching Spartan's house style. Functionally identical — Tailwind v4 accepts any format, and
opacity modifiers work via `color-mix()` regardless (verified). Worth revisiting if the design
team ever publishes OKLCH values.

**Two token layers.** Spartan has one (`--primary` → `--color-primary`); we have
`--aic-brand` → `--primary` → `--color-primary`. The extra layer is what makes "locked palette
vs themeable token" expressible, which was a stated requirement. It costs one indirection.

**Multiple themes via a wrapper class.** Spartan's docs cover light/dark only. The
`.theme-<app>` pattern comes from the wider shadcn ecosystem, is plain CSS, and is what the
Absa DSP example itself used (`.theme-agent`).
