<!--
  Produced by a 10-agent research workflow on 2026-08-26 (5 independent source lenses,
  a reconciling deep dive, 3 adversarial refutation passes, and a synthesis).
  2 of 3 load-bearing claims were refuted and the text reflects those corrections inline.
-->

> **Verification addendum (checked by hand, 2026-08-27).**
> Recommendation 1 — the dark-mode AA failure — is confirmed: `.dark` redefines
> `--aic-brand: #d64b7c` (theme.css:155) but never redeclares `--aic-brand-foreground`,
> so it inherits `#ffffff` from `:root` (theme.css:37). `--primary`/`--primary-foreground`
> resolve to that pair. Independently computed: **4.07:1** in dark vs 6.94:1 in light.
>
> **But the proposed fix does not work as written.** The document offers "do the same
> [flip the foreground to graphite], or lift the dark brand" as alternatives. Flipping
> alone gives `#d64b7c` on graphite `#2d2323` = **3.75:1**, which also fails.
> `#d64b7c` sits in a dead zone: white text needs luminance <= 0.1833, graphite text needs
>
> > = 0.2597, and it is 0.2078. **Both changes are required** — lift the dark brand AND flip
> > the foreground. E.g. `#e87ba1` with graphite = 5.65:1. Any fix must be contrast-checked,
> > not reasoned about.

---

# Colour format for AIC tokens — hex vs HSL vs OKLCH (2026-08-26)

## Verdict

The format of a colour literal in `libs/shared/ui/src/theme.css` changes **nothing about what Tailwind v4 generates and nothing about what any supported browser paints**, for every value currently in the file. The mixed hex/OKLCH state is not a defect — it is a provenance marker (hex = came from the brand document or we decided it; OKLCH = we never got a brand value and Spartan's stock slate is still showing through), and converting either way is pure cost. Two narrow exceptions exist (gradient/filter interpolation, and minifier behaviour) and both are neutralised by a one-line styling rule rather than a migration.

**Call: keep the mix. Convert nothing. Spend the budget on the dark-mode AA failure and on making the contract mechanical.**

---

## What actually differs

### HSL's non-uniformity — the classic argument, and why it does not apply here

CSS Color 4 makes the case against HSL in its own words:

> "A disadvantage of HSL over OkLCh is that hue manipulation changes the visual lightness, and that hues are not evenly spaced apart." … "because the lightness is simply the mean of the gamma-corrected red, green and blue components it does not correspond to the visual perception of lightness across hues."
> — [drafts.csswg.org/css-color-4](https://drafts.csswg.org/css-color-4/)

Worked example, from the spec, with the physics added:

|        | HSL                 | OKLCH                      | WCAG relative luminance | Contrast vs white |
| ------ | ------------------- | -------------------------- | ----------------------- | ----------------- |
| Blue   | `hsl(240 100% 50%)` | `oklch(0.452 0.313 264.1)` | 0.0722                  | 8.59:1            |
| Yellow | `hsl(60 100% 50%)`  | `oklch(0.968 0.211 109.8)` | 0.9278                  | 1.07:1            |

Identical HSL lightness; **12.8× the light output**, and 0.516 apart on Oklab's L axis. Hue is equally uneven: `hsl(220)`→`hsl(250)` is 6.4° of real separation while `hsl(50)`→`hsl(80)` is 35.8° — same nominal 30° step, 5.6× the perceived difference.

**But `theme.css` contains zero `hsl()` values** (42 hex-valued declarations, 22 `oklch`, 31 `var()`, 1 length; the "49 hex" figure counts 7 hex strings that appear only inside comments). A repo-wide grep for `hsl` across `apps/ libs/ tools/ docs/` returns nothing. The HSL leg of this decision is dead. The live question is hex vs OKLCH, and it is a much narrower one.

Worth recording: the file is already on the correct side of shadcn's Tailwind v4 migration, which killed the bare-HSL-channel trick (`--background: 0 0% 100%` + `hsl(var(--background))`) in favour of full colour values plus `@theme inline` — [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4). Nobody should reintroduce v3-era snippets.

### Where OKLCH is genuinely better

- **Derivation.** "Same hue, lighter" is expressible in OKLCH and not in hex. The four hand-lifted dark crimsons (`#af144b`→`#d64b7c`, `#870a3c`→`#c31856`, `#d32f2f`→`#f26a6a`) sit at a suspiciously consistent **+0.125 Oklab L**, but drift −6.3° to +1.9° in hue and −0.032 to +0.045 in chroma. That is an undocumented eyeball rule that will keep drifting in hex.
- **Interpolation.** Oklab avoids sRGB's grey dead-zone in gradients (see below).
- **Consistency with upstream.** Tailwind v4's whole default palette is OKLCH, "taking advantage of the wider gamut to make the colors more vivid" — [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4).

### Where OKLCH is _worse_ — be honest about this

1. **Reviewability.** OKLCH hue angles differ from designers' colour-wheel intuition by 15–50° (red `#ff0000` → 29.2°, yellow → 109.8°, blue → 264.1°) — MDN warns about exactly this on [oklch()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch). A reviewer recognises `#ff9700` as the brand orange; nobody recognises `oklch(0.769 0.174 63.6)`. The file's own stated design goal (line 6) is diffability against the brand PDF.
2. **You can write an invalid colour.** Chroma is unbounded — MDN: the maximum is "theoretically unbounded (but in practice does not exceed 0.5)". Every `#rrggbb` is in sRGB by construction; `oklch()` is one keystroke away from not being.
3. **Perceptual uniformity is a fit, not a guarantee.** Ottosson's own caveat: "since the lightness and chroma data was generated using CAM16 rather than being data from experiments, this data can't be used to say which model best matches human perception" — [bottosson.github.io/posts/oklab](https://bottosson.github.io/posts/oklab/). And Oklab "doesn't account for viewing conditions, such as the background color" ([Smashing interview, Oct 2024](https://www.smashingmagazine.com/2024/10/interview-bjorn-ottosson-creator-oklab-color-space/)). Say "substantially more uniform than HSL", never "perceptually uniform".
4. **Chroma is not portable across hues.** At Oklab L=0.65 the sRGB gamut affords 2.81× more chroma at magenta (321°, maxC 0.310) than at cyan-teal (200°, maxC 0.111). "All statuses at L=0.65, C=0.20" is not a palette you can generate.

---

## What does NOT differ

Compiled side by side through the installed **tailwindcss 4.3.2**, hex and OKLCH literals produce byte-identical rule structure, including under the `/50` opacity modifier — only the literal differs. Same for arbitrary values (`bg-[#af144b]/50` vs `bg-[oklch(...)]/50`).

Also identical or absent:

- **Tailwind has no documented preferred format.** The [theme docs](https://tailwindcss.com/docs/theme) use `oklch` in one example and the [colors docs](https://tailwindcss.com/docs/colors) use hex in another, both as correct.
- **Alpha compositing** is `color-mix(in oklab, C X%, transparent)` regardless of the source format — so `bg-brand/50` is _already_ being mixed in Oklab whether or not the source says `oklch`.
- **Browser support** is not a differentiator inside Tailwind's matrix. `oklch()` and `color-mix()` are both Baseline **Widely available since 2025-11-09** (low date 2023-05-09; floors Chrome 111 / Firefox 113 / Safari 16.2–15.4) per [webstatus.dev](https://api.webstatus.dev/v1/features?q=oklch). Every browser in Tailwind v4's stated minimum — "Chrome 111 …, Safari 16.4 …, Firefox 128" ([compatibility](https://tailwindcss.com/docs/compatibility)) — supports both.
- **WCAG contrast.** Oklab L is not relative luminance. Eight maximally-chromatic hues at exactly Oklab L=0.65 span 3.03:1 to 3.74:1 against white. Converting the palette does not help the accessibility story and is not a route to generating foreground pairs. WCAG 2.x sRGB maths stays the gate — [Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Wide gamut.** Nothing is recovered by conversion. The eight light chromatic brand colours sit at **86.6%–100%** of the maximum chroma sRGB holds at their own L and H (`#d32f2f` lowest at 86.6%; `#dc0032` and `#ff9700` at 100%). Reaching P3's 13–27% headroom requires _deliberately changing brand values_, which is what a locked palette exists to prevent.

> **Skeptic's correction, and it changed the wording here.** The original claim was "colour format is functionally inert in this toolchain." That is false as stated — it is inert _for Tailwind's utility codegen_. Two real exceptions, detailed under Risks: CSS interpolation (§13.1) treats hex as legacy sRGB and `oklch()` as not, and esbuild rewrites `oklch()`→hex when lossless while hex is a fixed point. Neither reaches this repo today. Also corrected: 100%-of-max-chroma is the _signature_ of a wider-gamut original having been clipped, not proof that no wide-gamut intent existed. The conclusion survives only because you cannot recover information that is not in the file — not because the evidence rules the intent out.

---

## The current state of theme.css

**The split is not arbitrary.** All 25 tier-1 `--aic-*` tokens are hex, plus six shadcn neutrals hand-mapped to brand values (`--background: #ffffff`, `--foreground: #2d2323`, card/popover pairs). The 22 `oklch` values are _exactly_ the residue of Spartan's stock slate base that never got a brand equivalent — `--secondary-foreground` / `--accent-foreground` / `--sidebar-accent-foreground` (slate-900), `--sidebar` (slate-50), `--sidebar-foreground` (slate-950), `--destructive` (red-600/red-400), and in `.dark` the secondary greys. Each is byte-identical to `node_modules/tailwindcss/index.css`.

So: **hex = owned, OKLCH = inherited and unresolved.** That is real information, and a blanket conversion destroys it unless it is re-encoded some other way.

The architecture around it is sound and enforced. Four hops: `--aic-*` (hex) → semantic (`--primary`, `--border`, `--ring`) → `@theme inline { --color-x: var(--y) }` → utility. `inline` is load-bearing, and for the right reason — not "makes it overridable" but "the utility must end up referencing a variable that is redefined at the level where the override happens." The spec basis is [css-variables-1 §2.3](https://www.w3.org/TR/css-variables-1/): "custom properties resolve any `var()` functions in their values at computed-value time, which occurs before the value is inherited." (That sentence has been relocated out of the Editor's Draft — cite the `/TR/` URL or a reviewer will not find it.) The rationale matches Tailwind [PR #14095](https://github.com/tailwindlabs/tailwindcss/pull/14095) almost exactly.

**Defensible? Yes** — with three caveats to fix in comments, not in values:

- `theme.css:276` justifies the `<body>` theme class partly by "`.dark`, whose (0,2,0) specificity…" — but line 132 is a bare `.dark`, which is (0,1,0). The selector changed in commit `1421030`. The conclusion still holds on the inheritance argument; the specificity argument no longer does.
- Three tier-1 tokens documented as "the Absa palette … LOCKED" quietly become Tailwind slate in dark (`--aic-secondary-filled` = slate-800, `--aic-secondary-helper` = slate-400) while `--aic-secondary-active` and `--aic-step-disabled` stay warm grey with no dark variant. Dark mode mixes two grey temperatures.
- `.dark` line 181 hardcodes `--input: oklch(1 0 0 / 15%)` instead of `var(--aic-secondary-line)`, which its sibling `--border` uses. And 16 of 42 declarations in `.dark` are byte-identical no-ops.

**The five frozen dark tints are arithmetically exact.** Independently reproduced: `#099ef3`@15% over `#020618` → `#051833`; `#3bb719` → `#041d21`; `#ff9700` → `#1d1a22`; `#faffbd`@20% → `#252f37`; error from the **dark** `#f26a6a` → `#1d1525` (re-deriving from the light `#d32f2f` gives `#1b101f` — a trap for anyone regenerating these).

---

## Options

| #     | Option                                                                     | Pros                                                                                                                                                                                                                                                                            | Cons                                                                                                                                                                                                                                                             | Effort                              |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **A** | **Keep the mix; fix the real defects**                                     | Zero risk. Preserves the provenance signal and byte-diffability against the brand PDF. Avoids reintroducing the hand-conversion step this repo already eliminated once (the DSP HSL bug: `#2D2323` written as 13.6% saturation when the true value is 12.5% — confirmed 12.5%). | Looks inconsistent to a newcomer; needs a comment. Two inherited Spartan `--destructive` values stay marginally out of sRGB with nothing checking.                                                                                                               | **Low**                             |
| B     | Unify on OKLCH                                                             | Consistency with Tailwind/Spartan. Makes the +0.125 L dark lift expressible as a formula.                                                                                                                                                                                       | Buys nothing functional. Destroys reviewability. Needs a mandated 4dp precision policy or it silently alters 4 brand values including a themeable portal accent. Converts a palette sitting on the gamut surface into one where an edit can leave sRGB silently. | **Medium**, pure downside on tier 1 |
| C     | Unify on hex (convert Spartan's residue down)                              | One format, no gamut hazard, no precision policy, one interpolation space.                                                                                                                                                                                                      | Erases the owned-vs-inherited signal. Makes Spartan upgrade diffs harder. Solves a problem nobody has.                                                                                                                                                           | Low–medium                          |
| **D** | Keep hex; rewrite the 5 frozen tints as **literal-endpoint** `color-mix()` | Deletes five magic numbers; source states the rule instead of a comment explaining it. Literal-endpoint mixes bypass Tailwind's polyfill entirely (no unresolvable var) and are constant-folded by lightningcss to the same bytes.                                              | Still not live — a brand change does not propagate. Needs a comment saying _why_ endpoints must stay literal, or the next dev "improves" it to `var()`.                                                                                                          | **Low**, opportunistic              |
| E     | Live `color-mix()` with `var()` endpoints                                  | Genuinely single-source.                                                                                                                                                                                                                                                        | This is the configuration that emits `--aic-info-filled: var(--aic-info)` as the fallback. Unreachable in supported browsers, but ships as permanent doubled output. The obvious escape hatch does not work (below).                                             | Low to write, medium to trust       |

---

## Recommendation

**Take A. Convert nothing.** Then, in this order:

**1. Fix the dark-mode AA failure. This is the only user-facing defect the whole investigation found, and it has nothing to do with format.** `.dark` sets `--aic-brand: #d64b7c` but never redeclares `--aic-brand-foreground`, so it stays `#ffffff` from `:root`. `--primary`/`--primary-foreground` resolve to that pair: **4.07:1, below AA's 4.5:1**. `hlm-button.ts:13` sets `default: 'bg-primary text-primary-foreground'`, so it is live on every default button in the client, agent and broker portals, and on `--sidebar-primary`. It is the only pair in the file with no annotation — every other stated ratio recomputes correct to 2dp (5.23, 4.98, 5.79, 7.03, 9.82, 5.86, 5.12). The file already solved this exact problem once, flipping `--aic-error-foreground` to graphite in dark. Do the same, or lift the dark brand; and add the ratio comment, because its absence is what let this through. Note `docs/styling-guide.md` §7 currently reassures the reader with the _light-mode_ 6.94:1 figure.

**2. Correct the comment at `theme.css:141-145` — but not the way the first draft of this document said.**

> **Skeptic's correction, and it reversed an action item.** The proposed fix was "the comment blames lightningcss; it's actually Tailwind." **`theme.css` never names lightningcss** — verbatim it says _"the build emits a plain fallback plus an `@supports` wrapper"_, which is correct and agent-neutral. The lightningcss attribution existed only in the briefing. There is no attribution error to fix.

What _does_ need correcting is the substance. The degraded branch is **unreachable in this stack's declared support matrix**. It fires only where `color-mix()` is absent — Chrome/Edge <111, Firefox <113, Safari/iOS <16.2 — and the only such browser in Angular 21.2's default floor (`BASELINE_DATE = '2025-10-20'` → chrome 111 / edge 111 / firefox 112 / safari 16.4) is **Firefox 112**, which is already below Tailwind v4's own minimum and also lacks `@property`, on which Tailwind v4's token layer depends. Worse for the original logic: the shipped bundle contains 24 raw `oklch(` with **no** `lab()` fallback and no `@supports (color: lab(…))`, so Firefox 112 cannot parse `--background`, `--card`, `--popover` or `--destructive` at all. The frozen tints protect a browser already broken by the tokens sitting beside them.

**Keep the hex anyway** — for the honest reason: `@tailwindcss/postcss` exposes only `base`, `optimize`, `transformAssetUrls`, with no way to disable the ColorMix polyfill ([PR #17513](https://github.com/tailwindlabs/tailwindcss/pull/17513), [#17562](https://github.com/tailwindlabs/tailwindcss/pull/17562)), and the escape hatch of naming the operands as theme variables **does not work under `@theme inline`** — the resolver follows the theme value to another non-theme var and gives up. Making it resolve means moving the palette into a non-inline `@theme`, turning those values into build-time constants and defeating the per-app `<body>`-class overrides. Also record that the error tint derives from the **dark** `#f26a6a`.

**3. Make the contract mechanical where it is currently prose.** `theming-contract.spec.ts` already enforces the tier-2 rules well (only `THEMEABLE_TOKENS`, values must match `/^var\(--aic-[a-z0-9-]+\)$/`, no `--aic-*` redefinition, gated by `.githooks/pre-push`). Extend it with:

- **assertions on the documented WCAG pairs** — correct today, but nothing recomputes them when a value changes. Highest value-per-line change available, and independent of every format decision;
- a **per-token intent tag** (`text` / `ui-boundary` / `disabled-exempt`), or the gate false-positives on `--aic-secondary-active` (2.11:1) and `--aic-step-disabled` (1.67:1), both legitimately exempt as inactive affordances under WCAG 2.2 SC 1.4.11;
- a **gamut assertion** (would immediately flag the two inherited `--destructive` values) and a **4dp minimum on any OKLCH L and C**, so that if the file ever gains OKLCH it cannot silently drift.

**4. Add one styling-guide rule, new since the skeptic pass:** _any gradient or filter that touches a brand token must name its interpolation space explicitly_ — `linear-gradient(in oklab, …)`. Because the file is mixed, `--primary` (hex, legacy sRGB) and `--destructive` (`oklch`, Oklab) would otherwise interpolate in **different colour spaces**. There are currently no gradients in `apps/` or `libs/` and exactly one `transition-colors` (`hlm-table.ts`), so this is latent, not live — and naming the space neutralises it without a migration.

### Explicitly do NOT

- **Do not add a `.browserslistrc`.** It was two researchers' headline recommendation and it does nothing here. Tailwind's ColorMix polyfill takes no targets input — it is unconditional in 4.3.2. `@tailwindcss/node` hard-codes its lightningcss targets (`safari 16.4 / ios_saf 16.4 / firefox 128 / chrome 111`) and ignores browserslist. And `@angular/build@21.2.12` has no lightningcss at all — it minifies with esbuild 0.27.3. The `@supports` guards survive any browserslist edit.
- **Do not convert tier 1 to OKLCH** without a 4dp precision policy _and_ a gamut assertion. At Spartan's own 3dp, `#ff9700` becomes `#ff9703` — and that token is one of the values a portal theme may select as `--app-accent`.
- **Do not adopt relative colour syntax yet.** `oklch(from var(--aic-brand) calc(l + 0.125) c h)` is the natural way to express the dark lift, and it passes through both Tailwind and lightningcss completely untouched — which is the problem. It is Baseline **Newly** available only (2024-09-16; Chrome 122 / Firefox 128 / **Safari 18**), and with a `var()` origin there is no downlevelling path at all. Revisit ~2027.
- **Do not build the contrast story on APCA.** It was removed from WCAG 3, whose contrast algorithm is undetermined; the [current WCAG 3.0 WD (03 Mar 2026)](https://www.w3.org/TR/wcag-3.0/) contains no APCA mention and leaves contrast as `@@[non-text-contrast]` placeholders.
- **Do not reach for `contrast-color()`.** It returns only white or black ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/contrast-color)), so it cannot express AIC's graphite `#2d2323`, and MDN specifically warns about mid-tone backgrounds — which is exactly what `#099ef3`, `#ff9700` and `#3bb719` are.

If the team wants a cosmetic win alongside the fixes, **D is free and safe**. Say plainly in the ADR that it changes nothing that renders.

---

## Risks and gotchas

**Out-of-gamut clipping.** The spec mandates gamut mapping — "out of gamut values _must_ be converted to an in-gamut color", via constant-lightness constant-hue chroma reduction in OKLCH, with 1 JND = 0.02 ([CSS Color 4 §14.2](https://drafts.csswg.org/css-color-4/)). **No engine implements it.** All three clip — [mdn/browser-compat-data#26838](https://github.com/mdn/browser-compat-data/issues/26838) ("Browsers are not spec compliant, support is only partial"), WebKit bug 255939 (NEW, last comment 2026-04-21), Mozilla bug 1847421 (ASSIGNED, blocked on 1847503). Clipping shifts hue: the spec's own example moves 265.1° → 196.1°, "a substantial change of 69°". At AIC's crimson hue, an over-chroma `oklch(0.49 0.30 8.5)` clips to `#d4003d` — hue +9.6°, L +0.062. For a corporate identity colour, a hue drift that appears on some displays and not others is the worst possible failure mode. **`theme.css` already contains two out-of-sRGB values** — both Spartan `--destructive` (light 4.1% over max chroma, dark 1.8% over) — with nothing checking. Measured clip damage is under 1.5° of hue, i.e. invisible. It is a governance gap, not a rendering defect; do not overstate it.

**Tailwind's ColorMix polyfill.** Triggered by an _unresolvable_ `var()` (or `currentcolor`), not any var; applies to any declaration, not just custom properties; fires for `in srgb` too. The "resolvable operands are mixed correctly" exception is overstated — Tailwind substitutes the literals and rewrites the space (`oklab|oklch|lab|lch → srgb`) but leaves an **unevaluated** `color-mix()`, so a browser lacking `color-mix` still drops it; and the sRGB result differs anyway (`color-mix(in srgb, #099ef3 15%, #020618)` = `#031d39` vs the frozen Oklab `#051833`). The utility layer already ships 21–24 such guards (`bg-destructive/10`, `bg-primary/80`, `outline-ring/50` from `@apply border-border outline-ring/50` on `*`), so avoiding `color-mix` in tokens does not close the hole — it closes only the part the team controls.

**lightningcss.** Reaches the CSS _only_ as Tailwind's own optimizer, with hard-coded targets. It leaves `var()`-argument `color-mix` byte-identical at every target; it constant-folds literal mixes correctly (`color-mix(in oklab,#099ef3 15%,#020618)` → `#051833` — byte-identical to the hand-written value); and where it downlevels custom-property `oklch` it emits a _correct_ sRGB fallback plus `@supports (color: lab(0% 0 0))`, never an un-mixed colour. It never sees this project's CSS at a target low enough to do that.

**Conversion drift.** Across the 29 distinct 6-digit hex in the file (27 declared; `#020618` and `#fed6c9` appear only in comments), round-tripping hex→OKLCH→hex: **2dp → 25 drift; 3dp → 4; 4dp/5dp/6dp → 0.** Confirmed by three independent implementations (colorjs.io, culori, and a from-scratch spec implementation validated against the spec's own published figures). The four at 3dp — the precision Spartan itself uses:

| Source                                 | 3dp round-trip | Channel delta |
| -------------------------------------- | -------------- | ------------- |
| `#099ef3` (`--aic-info`)               | `#079ef3`      | R −2          |
| `#3bb719` (`--aic-success`)            | `#3bb71a`      | B +1          |
| `#c31856` (dark `--aic-step-selected`) | `#c31956`      | G +1          |
| `#ff9700` (`--aic-warning`)            | `#ff9703`      | B +3          |

_Correction from the skeptic pass:_ these are 1, 1, 2 and 3 steps — not "one 8-bit step" each. All four are perceptually null (max ΔE2000 0.115, ~10× below the JND) but they destroy byte-diffability, which is the property the file says it wants. Also: `oklch(1 0 0 / 15%)` has no exact 6-digit hex form at all.

**Contrast verification cannot be automated away by a colour space.** Keep the hand-checked ratios; make them assertions.

**The dark tints are hue-wrong by up to 121°.** The dark background `#020618` is not neutral — `oklch(0.130 0.043 265.1)` — and at a 15% mix it contributes 85% of the result's a/b. Hue error vs source accent: info 13.0°, success 69.0°, error −75.8°, **warning −121.3°** (`--aic-warning-filled #1d1a22` lands at hue ~302, a purple-grey, from an orange at 63.6°). Consequently `--aic-error-filled` and `--aic-warning-filled` are **1.0 JND apart** — at the threshold of distinguishability. Masked today because the strong outline colours carry the signal. Fixable in either format by authoring the tint _at_ the accent's hue: `oklch(0.213 0.053 244.0)`=`#001b2f` (info), `oklch(0.213 0.055 22.5)`=`#2e0c0d` (error), `oklch(0.213 0.055 140.4)`=`#091f05` (success), `oklch(0.213 0.048 63.6)`=`#281300` (warning). Note the per-hue chroma ceiling at that lightness is only 0.048–0.086, so the fix must be hue-correct rather than more saturated. The light tints, by contrast, are hue-faithful (mixed over neutral white) but sit only **0.5–1.1 JND from white** — barely perceptible as surfaces. Those are the brand document's own values: a design conversation, not a bug.

**Enforcement gap, independent of format.** The contract test inspects `apps/*/src/styles.css` theme blocks, so it catches a raw hex but cannot see an off-palette Tailwind utility in a template. One has already leaked: `text-emerald-600` in `apps/client/src/app/signal-forms-demo/signal-forms-demo.component.ts:165` — and `--aic-success` already exists to replace it. Tailwind's full 286-colour default palette remains live in all four portals. `--color-*: initial` is the [documented mechanism](https://tailwindcss.com/docs/colors) to close this, but it deletes Spartan's expected names too and needs its own spike.

**Tailwind's source detection is scanning `docs/*.md`.** `.bg-brand`, `.bg-blue-600`, `.bg-warning` and `--color-blue-600` are in the production bundle, originating from prose counter-examples in the styling guide. Narrow it with explicit `@source` / `@source not`.

**`docs/spartan-ui-architecture.md` is materially stale** and contradicts itself on at least five facts this decision touches, including the per-app accent table (wrong on all four rows) and the current value of `--aic-error`. Treat `docs/styling-guide.md` and `theme.css` as authoritative for present state; that file is a record of reasoning, not of state.

**Also latent:** `@import 'tailwindcss/utilities.css';` in all four apps omits `layer(utilities)`, so no `@layer utilities` block exists in the output and every utility ships unlayered, outranking anything a consumer puts in a layer. It may be deliberate (Spartan ships one unlayered `.cdk-overlay-backdrop` rule) but nothing says so.

---

## What we could not establish

- **Does anything in the AIC deployment actually need Firefox 112?** No analytics or SOE browser policy was available. It is the sole browser in Angular's default set below the `oklch`/`color-mix` floor, and it is already below Tailwind's own minimum — but the assertion "no supported browser takes the fallback" rests on the _declared_ matrix, not on measured traffic.
- **Was the brand document authored in sRGB hex, or converted down from Pantone/CMYK/P3?** Nobody should argue the wide-gamut case for tier 1 without answering this. `#dc0032` and `#ff9700` sitting at exactly 100% of sRGB max chroma is consistent with clipping from a wider original.
- **What do AIC's users actually display?** The entire P3 discussion scales with wide-gamut screen share. If the four portals are internal/dealer-facing on managed hardware it is moot.
- **Is the IACVT failure mode confirmed empirically?** The reasoning that an unsupported `color-mix()` in a custom property degrades to _unset/inherited_ rather than full-strength is INFERRED from CSS variable semantics, not observed in a real Firefox 112. Cheap to test; it would decide whether the frozen tints could be retired outright.
- **Browser support for explicit gradient interpolation-space syntax** (`linear-gradient(in oklab, …)`) was not checked in this pass. The rule in Recommendation 4 assumes it; verify before writing it into the styling guide. The safe fallback rule is simply "no gradients spanning tokens of different formats".
- **Do any Spartan 1.0.2 components read `--color-*` directly?** `@theme inline` does _not_ emit those variables into `:root` — only `--aic-*` exists at runtime, and unused `--color-*` are tree-shaken. Only the preset's registration was audited, not the helm component sources.
- **Does design intend to supply official dark values, or OKLCH values, at all?** `theme.css:145` says "NEEDS BRAND SIGN-OFF". If official dark values are coming, live derivation is throwaway work and literals are the honest placeholder. This is a governance answer, not a technical one — and it is the largest single unknown behind this decision.
- **Successor colour spaces** (Helmlab, "Oklch+") could not be corroborated against any primary standards source, have no CSS syntax and no implementation. No action; nothing here justifies hedging.
