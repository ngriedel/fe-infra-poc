<!--
  Produced by a 29-agent research workflow (12 independent source lenses across 4 topics,
  per-topic reconciling deep dives, 12 adversarial refutation passes, and a synthesis).
  10 load-bearing claims were refuted; corrections are marked [CORRECTED] inline.
  Run 2026-08-26, synthesis completed 2026-08-27.
-->

> **Note on provenance.** Two research agents in this run had write access and edited the repo
> mid-investigation: one rewrote `libs/dealer/contracts/src/lib/policy.ts` to `zod/mini` while
> measuring bundle sizes (the +54 kB / −36 kB figures in §1 come from that experiment), and one
> reverted `apps/agent/src/app/home/home-page.component.ts`. Both were reverted by hand on
> 2026-08-27. The measurements stand; the edits were not sanctioned. Future research runs should
> be read-only.

---

# AIC direction review — 2026-08-26

> Four topics were researched independently, then every load-bearing claim was attacked by a skeptic. **Ten claims were refuted.** Where a refutation changed the call, it is flagged inline as **[CORRECTED]**. Anything that could not be settled is in _What we could not establish_ — nothing has been smoothed over.

## Verdict at a glance

| Topic                             | Call                                                                                        | The one reason                                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Angular 22 + httpResource**  | **Go, with caveats** — rehearse on a throwaway branch before committing to a date           | The upgrade is probably fine, but the "verified cheap" evidence was produced with `tsc --noEmit`, which does not type-check Angular templates — and v22's compiler breaking changes are almost entirely template-level. Only an AOT `nx build` settles it.          |
| **2. AIC style flavour for helm** | **Change course** — do not build a flavour                                                  | The token layer reaches _further_ than the research assumed: density is a single `--spacing` variable and can be scoped per app. A flavour would encode by hand what one CSS custom property already expresses.                                                     |
| **3. Nx libs structure**          | **Go, with caveats** — do the moves, downgrade the urgency, use Nx's documented alias forms | `libs/bff/contracts` really is browser-consumed and `scope:shared`, but Nx calls folder layout "conventions… not requirements" — this is navigation debt, not a correctness defect, and the recommended alias spelling in the research is not the one Nx documents. |
| **4. Overall direction**          | **Go**                                                                                      | Every structural choice (copy-in helm, Tailwind v4 CSS-first, Zod-per-audience contracts, BFF-per-frontend) is verifiably canonical and nothing upstream threatens any of them. The real risks are staleness, doc drift, and a missing build gate.                  |

---

## 1. Angular 22 + httpResource

### What the research established

**httpResource is stable in v22 and the type surface is unchanged.** `@angular/common@22.1.4`'s `types/http.d.ts` carries zero `@experimental` tags; every overload is `@publicApi 22.0`, versus `@experimental 19.2` in the installed 21.2.14. `HttpResourceOptions` is field-identical in both (`parse`, `defaultValue`, `injector`, `equal`, `debugName` — no `id`, no `map`). The only signature delta is additive: `url: () => …` became `url: (ctx: ResourceParamsContext) => …`. Identical source compiles clean under each version's _own_ supported compiler (TS 5.9.3 + Angular 21.2.14; TS 6.0.3 + Angular 22.1.4).

**The runtime semantics were verified by execution**, not assertion — a 6-test probe on the repo's own Jest harness (Angular 21.2.14, jest-preset-angular 16, zoneless) passed 6/6:

1. `undefined` url → `status() === 'idle'`, no request issued.
2. Flipping the trigger → request fires, `statusCode() === 200`.
3. **`reload()` returns `false` and issues nothing while idle** — byte-identical guard in 21.2.14 and 22.1.4.
4. A 401 → `statusCode() === 401`, `error()` truthy, and **`value()` throws**.
5. A schema mismatch on a 200 → `error()` is a real `ZodError`, `instanceof Error`, **with `statusCode() === 200`** — contract drift is cleanly distinguishable from transport failure.
6. Changing the request → `'loading'` and **value blanks**; `reload()` → `'reloading'` and **value is preserved**.

**[CORRECTED] "Same runtime semantics" is false.** The v21 `HttpResourceImpl` in `@angular/common/fesm2022/http.mjs` has `const onAbort = () => sub.unsubscribe()`, which dereferences `sub` before assignment and leaks the subscription if abort fires during the synchronous subscribe. v22 guards it (`sub?.unsubscribe()` plus an `aborted` re-check) — [Angular CHANGELOG 22.0.0, commit e6cfaf5672](https://github.com/angular/angular/blob/main/CHANGELOG.md), _"prevent `httpResource` from leaking a subscription"_. **Not backported**: 21.2.22, the latest v21 LTS, still ships the buggy line. This is exactly the abort/cancel path a param-driven data layer hits.

**[CORRECTED] The upgrade is not "verified cheap."** The zero-type-errors evidence is methodologically void for Angular projects: `tsc -p apps/agent/tsconfig.app.json --noEmit` returned exit 0 with `{{ auth.user().thisPropertyDoesNotExist.nope }}` injected into a real template. The `.html` files are not in `include`, and inline templates are opaque string literals to `tsc`. Meanwhile [v22's breaking changes](https://github.com/angular/angular/releases/tag/v22.0.0) are template-level: _"`in` variables will throw in template expressions"_, _"data prefixed attribute no-longer bind inputs nor outputs"_, _"Elements with multiple matching selectors will now throw at compile time"_, and _"This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable` diagnostics on exisiting projects."_ (Those two default to _warning_ — see [extended diagnostics](https://angular.dev/extended-diagnostics) — so likely churn, not a blocker. But unquantified.) **The only valid test is `nx run-many -t build` on a v22 branch.**

**[CORRECTED] `withFetch()` is not a breaking change.** It is deprecated but functional — [angular.dev](https://angular.dev/api/common/http/withFetch): _"`withFetch` is not required anymore. `FetchBackend` is the default `HttpBackend`."_ The real change is the inverse: fetch is now the default, so upload-progress consumers need `provideHttpClient(withXhr)`. The repo has zero interceptors and zero `reportProgress` hits, so impact is nil — but the claim named the wrong thing.

**Two hard peer blocks the research missed**, both requiring majors: installed `angular-eslint@21.4.0` peers `"@angular/cli": ">= 21.0.0 < 22.0.0"`, and installed `jest-preset-angular@16.0.0` peers `"@angular/core": ">=19.0.0 <22.0.0"` (needs 17.0.0, which peers `>=20.0.0 <23.0.0`). Plus an Nx 22.7.4 → 23.1.x major and `@angular/cdk` 21.2.12 → 22.x.

**What genuinely is cheap:** the four Fastify BFFs, both contracts tiers and `libs/shared/auth` typecheck clean under TypeScript 6.0.3 (that half of the evidence is pure TS and stands); 17 of 18 `@Component`s declare `changeDetection` and **all 17 are `OnPush`**, so v22's OnPush-by-default is inert here; every route config is flat, so `paramsInheritanceStrategy: 'always'` is inert; `@spartan-ng/brain@1.0.2` peers `>=21.0.0 <23.0.0`, `@angular/cdk@21.2.12` peers `^21.0.0 || ^22.0.0`, `@ng-icons/core@33.3.0` peers `>=21.0.0` — none block v22.

**[CORRECTED] The Zod bundle finding was misattributed — and it changes the answer.** The measured +54 kB gzip is not the price of classic Zod; it is the price of `import { z } from 'zod'`, which the repo uses in all 14 Zod files. `zod/index.js` exports `z` as a materialized namespace object, defeating tree-shaking and retaining all 53 locale files (198 kB of a 327 kB raw bundle). Same schema, same call site, only the import line changed, measured in this repo's real production build (home-page lazy chunk, raw / transfer):

| Import form                     | raw          | transfer     | Δ gzip vs 1.54 kB baseline               |
| ------------------------------- | ------------ | ------------ | ---------------------------------------- |
| `import { z } from 'zod'`       | 331.94 kB    | 55.47 kB     | +53.9 kB                                 |
| **`import * as z from 'zod'`**  | **75.48 kB** | **18.98 kB** | **+17.4 kB**                             |
| `import { z } from 'zod/mini'`  | —            | —            | +57.0 kB (mini is _not_ self-protecting) |
| `import * as z from 'zod/mini'` | 16.34 kB     | 5.57 kB      | +4.03 kB                                 |

`import * as z from "zod"` is the form [Zod's own docs](https://zod.dev/basics) use, and [eslint-plugin-import-zod](https://github.com/samchungy/eslint-plugin-import-zod) exists to enforce it. So classic-vs-mini is a **~13.4 kB gzip** decision, not ~50 kB. And [Zod's mini page](https://zod.dev/packages/mini) argues against the migration: _"In general you should probably use regular Zod unless you have uncommonly strict constraints around bundle size."_

**And `zod/mini` has a live footgun in this repo:** a mini schema's `.parse()` throws core `$ZodError`, which is **not** `instanceof` the classic `ZodError` that `libs/bff/core/src/lib/plugins/error-handler.plugin.ts:57` guards on. Every hand-rolled parse failure would become a 500 INTERNAL_ERROR instead of a 400 VALIDATION_ERROR, and `tsc` still exits 0.

### Options

| Option                                                       | Trade-off                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Namespace-import codemod only**                         | 14 one-line edits, no dialect split, no API churn, captures ~70% of the bundle win. Nothing else changes.                                                                                                                              |
| **B. A + httpResource read layer on 21.2.14, upgrade later** | Delivers ergonomics first, decouples from the Spartan/v22 risk — but knowingly commits code against an API tagged `@experimental 19.2` in the installed version, in a POC whose stated rule is that even primitives must be idiomatic. |
| **C. Upgrade first, then the data layer**                    | Nothing `@experimental` is ever committed; the refactor is written once in the v22 idiom. Carries the unvalidated Spartan/template risk at the front, where it blocks.                                                                 |
| **D. Both in one PR**                                        | Shortest calendar time, worst bisectability — when the build breaks you cannot tell whether it is Nx 23, TS 6, ngtsc template diagnostics, Spartan's linker output, or your new resource code.                                         |
| **E. `zod/mini` migration**                                  | Buys ~13.4 kB gzip over namespace-imported classic, costs a dialect split across three contracts libs plus a mandatory widening of the `error-handler` guard to `$ZodError`.                                                           |

### Recommendation

**Do A immediately. Then C, sequenced, with a build gate in front of it. Reject E.**

1. **Codemod every `import { z } from 'zod'` → `import * as z from 'zod'`** (14 files) and add `eslint-plugin-import-zod` to enforce it. This is a one-line-per-file change that removes 36 kB gzip from the dealer route with zero API churn and no mini/classic split. It is the single highest value-per-risk change in this entire review.
2. **Skip `zod/mini`.** The remaining ~13.4 kB does not justify a second authoring dialect in a POC that markets itself as demonstrating canonical Zod — and Zod's own docs say so. Revisit only if a real budget forces it, and widen the `error-handler` `instanceof` guard to `$ZodType`'s `$ZodError` _first_ if you ever do.
3. **Before any v22 work: add `build` to `.githooks/pre-push`.** Right now the hook deliberately skips `build`, no Angular app has a `typecheck` target, and there is no CI — so no Angular template or type error is caught by anything automated. This is a couple of hours and it is the prerequisite for everything below.
4. **Rehearse the upgrade on a throwaway branch and measure it, don't estimate it.** Nx 23.1 + TypeScript 6 + Angular 22 + `angular-eslint` 22 + `jest-preset-angular` 17 move together — they are _not_ independently sequenceable (see topic 4). Gate merge on `nx run-many -t build` plus a **manual Spartan pass over overlay/dialog/select/combobox**, not just green CI.
5. **Then the httpResource read layer**, in one shared `apiResource` factory. Four things must be in it, all verified by test:
   - **Idle gate via a `requested` signal, not `reload()`.** `reload()` returns `false` while idle in _both_ versions — a naive `(click)="policies.reload()"` silently does nothing on first press.
   - **Templates become `@if (res.hasValue())`.** All three current templates use `@if (policies(); as rows)`, which is safe against `null` but becomes a view-time throw on any 401 once ported. This is invisible in the diff and no happy-path test catches it.
   - **Refetch uses `reload()`, not a bumped request** — bumping blanks the table (`'loading'`), `reload()` preserves it (`'reloading'`).
   - **Error branch discriminates**: `statusCode() === 401` → session copy; `ZodError` _with_ `statusCode() === 200` → "this build can't read the server's response"; else generic.
6. **Scope it: httpResource for reads, `HttpClient` for writes.** `reload(): boolean` is not awaitable, and [Angular's httpResource docs](https://angular.dev/api/common/http/httpResource) advise against it for mutations. `AuthService.refresh/logout` and the OTP flow stay on `firstValueFrom`.

Be honest in the ADR about what FE validation buys: the BFF already projects field-by-field and `fastify-type-provider-zod` serializes against the same schema, so `parse` is not defending against a lying server. Its value is catching **FE/BFF deploy skew** between independently-built artifacts, and turning a shape mismatch into a loud typed failure instead of a silent `undefined`.

### Risks

- **The template question is open.** Nobody has compiled this repo's 8 `.html` + 14 inline templates under ngtsc on v22. `strictTemplates: true` is set in all six Angular tsconfigs. Budget for diagnostics churn on the `auth.user()?.x` sites.
- **The v21 subscription leak is unfixable in place** — not backported to 21.2.22. Another argument against sitting on 21 with a resource-based data layer.
- **Node floor.** `@angular/core@22.1.4` engines are `^22.22.3 || ^24.15.0 || >=26.0.0`; the repo declares `>=24.0.0`, permitting Node 24.0–24.14 which Angular 22 refuses. CI would pass on a Node the framework rejects.
- **TypeScript version trap.** npm `latest` is 7.0.2; `@angular/compiler-cli@22.1.4` peers `>=6.0 <6.1`. Pin `~6.0.0`. Nx 23.1's "TypeScript 6" messaging is about Nx, not Angular.
- **Spartan is the one unvalidated dependency.** `@spartan-ng/brain@1.3.3` ships `fesm2022` stamped `version: "21.2.16"` — identical declaration markers to the installed 1.0.2 — and `spartan-ng/spartan` main is still on `@angular/core` 21.2.16. Its `<23.0.0` peer is a forward-compat _assertion_ resting on the partial-compile linker, not v22 CI. Bumping 1.0.2 → 1.3.3 buys nothing for this.

---

## 2. An AIC style flavour for generated helm files

### What the research established

**A custom style flavour is not supported and fails hard.** On `@spartan-ng/cli` main and every published version, [`supported-styles.ts`](https://raw.githubusercontent.com/spartan-ng/spartan/main/libs/cli/src/utils/supported-styles.ts) is verbatim `export const STYLES = ['nova', 'vega', 'lyra', 'maia', 'mira', 'luma'] as const;`, and `config.ts` declares `style: z.enum(STYLES).optional().default(FALLBACK_STYLE)` in **both** the Angular-CLI and Nx schemas. Verified by execution against the installed 1.0.2: setting `"style": "aic"` in `components.json` makes `nx g @spartan-ng/cli:healthcheck` and `migrate-hlm` both die with `Config validation failed. Please fix the issues above.` The [docs](https://www.spartan.ng/documentation/styles) confirm the closed set and document no custom mechanism.

**[CORRECTED] There _is_ a live `--style` flag — and it fails silently, which is worse.** `ui/schema.json` omits `style`, but Nx does not reject undeclared options (no `additionalProperties: false`), and `ui/generator.ts` reads `style: options.style ?? config.style`. Running the real generator with `--style=aic` **succeeds** and emits helm with every style class stripped, because `getStyleMap` resolves `path.join(__dirname, '..', 'ui', 'style-${style}.css')` inside `try { … } catch { return {}; }`. So the enum guards the config-read path but not the generation path. A real flavour would require patching _two_ files inside `node_modules/@spartan-ng/cli` — re-broken by every upgrade.

**[CORRECTED] The token layer's reach is the opposite of what was reported, and this inverts the whole argument.** Density is the _most_ surgical axis, not the least: [Tailwind v4](https://tailwindcss.com/docs/padding) drives the entire spacing scale from one variable — _"The `p-<number>`, `px-<number>`, `py-<number>`… utilities are driven by the `--spacing` theme variable, which can be customized in your own theme."_ Compiling this repo's Tailwind 4.3.2 confirms `p-4`, `gap-2`, `size-8`, `w-64`, and even vega's `text-[length:--spacing(4)]` icon sizes all emit `calc(var(--spacing) * N)` — **one runtime variable, 100 % coverage**.

Radius, by contrast, is _leaky_: `rounded-full` compiles to `calc(infinity * 1px)` and bare/directional `rounded`/`rounded-t` compile to a literal `0.25rem`, because Tailwind's bare `--radius` sits in a `@theme default inline reference` block that is never emitted. That is **34 usages in `style-vega.css` immune to any `--radius` change**. And `--radius-*` is [Tailwind's own public namespace](https://tailwindcss.com/docs/theme), not a Spartan-private indirection — every hand-written `rounded-md` in all four apps already rides it.

**"Blast radius across all four apps" is a placement choice, not a namespace property.** `--spacing`, `--text-*` and `--radius-*` all emit as `:root` custom properties consumed via `var()` at use-site, so an override inside a `.theme-<app>` block scopes to one app — the mechanism this repo _already uses_ at `apps/{agent,broker,client,dealer}/src/styles.css:23`.

**And AIC does have a density requirement.** `docs/architecture-decisions.md:124` — _"agent app reads as dense and utilitarian… Both use the same components, just different Tailwind tokens"_; `:128` — _"brand colours and density are app-local."_ That is precisely the falsifier the original claim named.

**The one axis with no root knob is type scale**: 13 `--text-*` values plus 13 `--text-*--line-height` companions.

**The drift in the library runs the opposite way to the premise.** `hlm-button.ts` is unmodified vega output that renders crimson purely because `theme.css` sets `--primary: var(--aic-brand)`. Meanwhile `hlm-input.directive.ts` is hand-authored (`git log --follow` shows it was born with the legacy pre-Tailwind-v4 shadcn string — it never _drifted_, it was never vega) and ships a visibly different focus ring: `focus-visible:ring-2 ring-offset-2 ring-offset-background` against vega's `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3`. **Two focus-ring designs ship side by side in one shared UI library.**

Two corrections to that finding: `libs/shared/ui/src/lib/utils/` is _also_ generated CLI output (byte-identical to the templates modulo prettier), so the generated set is button + table + utils. And "generated helm already carries AIC brand" holds only for the re-pointed shadcn tokens — the generated button's `destructive` variant resolves stock `oklch(0.577 0.245 27.325)` (theme.css itself says _"Deliberately NOT the brand error colour"_), and the AIC element tier (info/success/warning/error, step indicator) maps to no shadcn token at all, so a future generated `alert` or `badge` will come out shadcn-slate.

### Options

| Option                                                                    | Trade-off                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Token-first, no flavour**                                            | Zero new maintenance surface; the sanctioned mechanism; survives every CLI upgrade. Now covers colour, radius _and_ density (per-app via `.theme-<app>`). Only type scale needs 26 declarations.                                                                                                                  |
| **B. Thin overlay CSS fed to `createStyleMap` in `tools/spartan-add.js`** | ~2 lines in a script AIC owns, inherits upstream fixes for non-overridden keys. But ordering is counterintuitive and failure is a silent _hybrid_, not an error (overlay-last produced `rounded-full bg-primary…` — radius override survived, every colour reverted). Sits outside the enforced theming contract. |
| **C. Fork `style-vega.css`**                                              | 334 rules / ~59 KB re-diffed on every CLI bump with no test to detect divergence. Upstream [RFC #1713](https://github.com/spartan-ng/spartan/issues/1713) measured this exact failure: _"Six styles maintained by hand diverge from upstream within months."_                                                     |
| **D. `"style": "aic"` in components.json**                                | Throws before any file is generated, and kills healthcheck/migrate-hlm. Do not.                                                                                                                                                                                                                                   |
| **E. `--style=aic` flag**                                                 | Accepted, and silently emits unstyled components. Actively dangerous.                                                                                                                                                                                                                                             |

### Recommendation

**Take A. The corrected token-reach findings make this a stronger call than the research concluded, not a weaker one.**

The original argument for A was "there is no geometry requirement, and density isn't surgical anyway." Both halves were wrong — there _is_ a density requirement, and density is a _single variable_. Which means: **the requirement that was supposed to justify a flavour is exactly the one the token layer expresses best.** Put `--spacing` (and, if type scale is ever specified, the 13 `--text-*` pairs) in each app's `.theme-<app>` block, amend `theming-contract.ts` to admit them as tier-2, and you are done.

Concretely, in order:

1. **Upgrade `@spartan-ng/{cli,brain}` 1.0.2 → 1.3.3.** Verified safe: peer ranges semantically identical, exports 41 → 42 (`./date-picker` added, none removed), the only `### BREAKING CHANGE` block in the 2706-line CHANGELOG sits under `## 1.0.0`. And verified _empirically_ — replaying `tools/spartan-add.js` against 1.3.3 produced **byte-identical output** for button, card and table. Do not run it the week it shipped without soak time (1.3.3 published 2026-08-26T14:06:48Z; 1.3.4-beta.1 followed 25 minutes later). Follow the [update guide's](https://www.spartan.ng/documentation/update-guide) procedure — `healthcheck` handles brain automatically, **helm is manual**, and the automated helm migration _"will be overwritten. Only use this if you haven't modified the components."_
2. **Add `--spacing` to the tier-2 token list** and set it per app in `.theme-<app>`, with a comment recording that `rounded-full` and bare `rounded` are immune to `--radius`.
3. **Put `form-field` through `tools/spartan-add.js`** (`input`, `label`, `field`) and re-apply the Signal Forms `FormField` wiring _on top of_ vega output rather than beside it. This is the highest-value change on the list — it is what makes the library look like one library. Treat it as a port, not a regeneration: budget a day.
4. **Assert `@theme inline` in `theming-contract.spec.ts`.** The contract says "THIS CONTRACT IS ENFORCED" but the spec never mentions `@theme` or `inline`, and dropping the keyword fails _silently_ — the app renders, with the wrong accent.
5. **Write the overlay into the ADR as pre-authorised and empty**, with the trigger stated (whole component family, not colour/radius/density, has failed the token gate; capped at 20 rules) and the ordering rule (overlay text **first**) plus a unit test asserting an override survives `transformStyle`. Costing it once now is what makes it a one-hour change later instead of an argument.
6. **Fix `tools/spartan-add.js`'s header comment.** The `angularCli ?? true` justification is true of 1.0.2 and false on main. The durable reason is `singleLibName = 'ui-helm'`: the CLI creates a new Nx library at every version, so the wrapper is a layout decision, not a bug workaround.

### Risks

- **Regenerating `form-field` is the riskiest step here.** `hlm-input.directive.ts` carries AIC-specific Signal Forms wiring, and vega's `.spartan-input` uses a different invalid mechanism (`data-[matches-spartan-invalid=true]`). Do it on a branch against `docs/form-field-requirements.md`.
- **`tools/spartan-add.js` depends on five undocumented CLI internals by deep path with no version guard.** Intact at 1.3.3 and byte-identical — but no semver guarantee. Add a smoke test that regenerates one primitive on every CLI bump.
- **Nobody has run `healthcheck` against AIC's flat single-barrel layout.** Neither 1.0.2 nor 1.3.3 ships a `migrations.json`, so `nx migrate` will not touch Spartan at all — these are manual invocations. Trial on a throwaway branch.
- **`docs/spartan-ui-architecture.md:151-153` claims byte-for-byte regeneration as the correctness gate, and nothing enforces it.** Either add a test that regenerates into a temp dir and diffs, or downgrade the prose from a guarantee to a habit.
- **Never set `style: "aic"` (throws) or pass `--style` (silently strips styling).** Write both into the ADR so nobody discovers them the hard way.

---

## 3. Nx libs directory structure

### What the research established

**The terse names are generator fallout, not design.** `@nx/devkit`'s `project-name-and-root-utils` derives the name from the last path segment when `--name` is omitted, so `libs/shared/ui` → `ui`. `libs/bff/contracts` was generated first and took the bare name `contracts`; the per-audience libs then had to be hand-named `agent-contracts` etc.

**[CORRECTED] There is no collision guard in the installed version.** `validateUniqueName` is absent from `@nx/devkit` 22.7.4 (installed), 22.7.8 (last 22.x — never backported), 23.0.0 and 23.1.0. It first shipped in **23.1.1 (2026-07-30)**. Under 22.7.4 a colliding generation _succeeds_ and the workspace breaks later at graph construction with `MultipleProjectsWithSameNameError` — a state you can commit. Also, folder moves _can_ change derived names (de-nesting `libs/bff/contracts` → `libs/bff-contracts` yields `bff-contracts`; an `@scope/` directory segment yields a fully-qualified name).

**But the conclusion survives for a stronger reason:** at _runtime_ in 22.7.4 there is no folder derivation at all. `buildProjectFromProjectJson` passes `json.name` straight through with no fallback, and `validateProject` falls back only to a sibling `package.json` name, else throws `ProjectsWithNoNameError`. No lib here has a `package.json`, so **`"name"` in `project.json` is mandatory, not advisory.**

**[CORRECTED] `scope-type-identifier` is not published Nx convention.** It appears zero times in the 3.4 MB Nx docs corpus — it lives only in one Feb 2025 blog post. The current [folder-structure KB](https://nx.dev/docs/kb/folder-structure) teaches the opposite shape: nested grouping folders with short type-named leaves (`libs/shared/seatmap/data-access`).

**The one-slash rule is real** — [switch-to-workspaces-project-references](https://nx.dev/docs/kb/switch-to-workspaces-project-references): _"A `package.json` name can only have one `/` (the scope separator), so a name like `@myorg/shared/ui` is invalid… you'll need to flatten any nested aliases."_ Confirmed against npm's own validator regex. It is an npm spec rule, so it binds pnpm/yarn/bun and no Nx release will relax it.

**[CORRECTED] But `@aic/shared-ui` is not Nx's recommended flattening.** Same page, verbatim: _"1. **Drop the original scope:** `@myorg/shared/ui` becomes `@shared/ui` 2. **Combine scope segments with a dash:** `@myorg/shared/ui` becomes `@myorg-shared/ui`."_ Nx moves the dash **into the scope** and preserves the leaf. The blog and the KB genuinely disagree; the KB is current.

**[CORRECTED] `libs/bff/contracts` is a convention deviation, not a correctness defect.** The premises hold — the Nx project graph shows static edges from `apps/client` and `libs/shared/auth`; `index.ts` says _"Every BFF and every frontend really does share these"_; `project.json` tags it `scope:shared`. But the cited page disclaims normativity: _"Nx works with any folder structure you choose, and the structures below are conventions that have held up in large workspaces, not requirements"_ and _"Tooling doesn't factor into the decision."_ Enforcement is assigned to **tags**, and this repo gets that right at lint-error severity — `type:app` may only depend on `['type:ui','type:auth','type:contracts']`. Both browser imports are `import type`, so zero runtime bytes cross. And the deviation is not specific to `contracts`: **all four** libs under `libs/bff/` are tagged `scope:shared`, so the whole grouping folder is the technical-type grouping Nx warns about.

**Also relevant:** [tsconfig `paths` is deprecated guidance](https://nx.dev/docs/getting-started/tutorials/crafting-your-workspace) — _"This works but is not recommended for new workspaces."_ And Nx treats [server-vs-client as a tag dimension](https://nx.dev/docs/guides/enforce-module-boundaries/tag-multiple-dimensions), not a folder one. A `platform:` axis works, but a `{sourceTag:'platform:browser', onlyDependOnLibsWithTags:['platform:browser']}` rule will **block a browser project from importing any lib lacking a `platform:` tag** — so contracts must be dual-tagged.

Blast radius, measured: `@aic/shared/ui` → 17 source files + `components.json` + `tsconfig.base.json` + 3 docs; `@aic/bff/*` → 17 source files + 3 docs. ~40 mechanical edits. `@nx/workspace:move` takes `newProjectName` + `importPath` and does folder + name + alias + tsconfig in one command.

### Options

| Option                                                  | Trade-off                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Names only**                                       | ~5 lines, zero import churn. Directly answers the stated complaint. Leaves a technical-type grouping folder whose four occupants are all `scope:shared`.                                                                                                                                     |
| **B. Names + dissolve `libs/bff/`, keep slash aliases** | Folder tree becomes one grouping folder per scope tag. But you pay the 35-file sweep and still land on aliases that are illegal under workspaces linking, so you rename twice.                                                                                                               |
| **C. B + flatten aliases**                              | Alias == project name, forward-compatible with the workspaces migration. Costs ~26 extra files. **Use Nx's `@aic-shared/*` form, not `@aic/shared-*`.**                                                                                                                                      |
| **D. Full workspaces + TS project references**          | The genuinely canonical 2026 shape and the `create-nx-workspace` default. But `tsconfig.base.json` sets `"declaration": false` and project references need composite+declaration true — that re-tests four Angular builds, the Spartan CLI, four esbuild BFF builds and Jest simultaneously. |

### Recommendation

**Take C, with Nx's documented alias spelling — but do it as maintenance, not as a defect fix.**

The severity downgrade matters: nothing builds, lints or bundles wrongly today. So do not schedule this ahead of the build gate or the `zod` codemod. Do it when you next touch the workspace, and do it in one sweep because the second rename is the expensive one.

1. `nx g @nx/workspace:move --projectName contracts --destination shared/contracts --newProjectName shared-contracts --importPath @aic-shared/contracts` — **this one first**; it frees the bare `contracts` name and validates the approach on the lib with the most consumers. Repeat for `core` → `shared/bff-core`, `auth-sso` → `shared/bff-auth-sso`, `esl-client` → `shared/esl-client`.
2. Rename `ui` → `shared-ui` and `auth` → `shared-auth` with `--importPath @aic-shared/ui` / `@aic-shared/auth`. **Update `components.json`'s `importAlias` in the same commit** — the Spartan CLI reads it and will otherwise emit wrong imports days later, attributed to Spartan.
3. `rmdir libs/client` (empty, verified).
4. Set root `package.json` `"name"` to a scoped value. It is currently `"aic"` with no `@`, so `getNpmScope` returns `undefined` and every future `nx g` emits an unscoped alias someone hand-fixes. One line ends that drift class.
5. Fold `type:bff-core` + `type:bff-auth` → `type:bff-util` (8 type tags → 7) and add the `platform:browser`/`platform:node` axis, **dual-tagging all four contracts libs**. Sanity-check with `nx run-many -t lint` _immediately_ after the eslint edit, before the alias sweep — a missing `platform:` tag breaks lint everywhere at once.
6. **Document the tag vocabulary in `docs/architecture-decisions.md`.** Nx explicitly requires it: _"Keep the number of library types low / Clearly document what each type of library means."_ Seven undefined types is the actual violation right now, not the count.
7. **Add a local generator** wrapping `@nx/js:lib` that requires a scope and emits `<scope>-<name>` — otherwise the convention re-drifts on the next lib, because the default generator actively fights it.
8. **Write the rule of three into `docs/bff-contracts.md`**: a shape duplicated across two audience contracts stays duplicated; the third promotes to shared. The doc argues the principle but gives no trigger.

**Defer D** until after the Angular 22 / Nx 23 decision resolves. `pnpm-workspace.yaml`'s `libs/**` glob currently matches zero packages — leave it as the landing pad, but add a comment saying so rather than letting it read as working config.

### Risks

- **`components.json` `importAlias` drift** is the failure that shows up late and gets misattributed.
- **`$schema` relative depth** in each moved `project.json` — `libs/bff/*` → `libs/shared/*` is a no-op (both 3 deep), but spot-check rather than trusting the generator.
- **Nx contradicts itself on leaf-folder convention** across four Nx-authored sources (flat `packages/shared-ui`, nested `libs/shared/ui-components`, type-prefixed `packages/products/ui-product-card`, bare type leaves `libs/shared/product/ui`). Do not spend more than one meeting here — all four agree the _project name_ is scope-prefixed and hyphenated.
- **No public Nx repo demonstrates multiple Node BFFs paired 1:1 with multiple frontends plus per-pair contracts.** `nx-examples` has no backend. The recommended tree is an extrapolation on that axis.
- **If AIC stays one team forever**, a flat `libs/shared-ui/` (folder == project == alias) is defensible and simpler. Nested grouping folders are load-bearing only as CODEOWNERS boundaries.

---

## 4. Is the overall direction sound?

### What the research established

**Yes. Every structural choice is verifiably canonical.**

- **Copy-in helm.** `https://registry.npmjs.org/@spartan-ng/helm` → HTTP 404. README: _"The styled helm components aren't published as a package on purpose — the CLI copies them straight into your project so you own and customize every line."_
- **[CORRECTED] But it is stated _intent_, not stated permanent policy.** [Discussion #637](https://github.com/spartan-ng/spartan/discussions/637), maintainer answering whether `@spartan-ng/helm` will be published: _"So far there are no plans to do that."_ — an open thread with an explicit present-state hedge, and an invitation to submit a CLI PR. Corroborating: CLI templates in both 1.0.2 and 1.3.3 ship a JSDoc example importing from `@spartan-ng/helm/utils`, a path that 404s. Plan for copy-in as durable current intent, not a guarantee.
- **Tailwind v4 CSS-first is the only forward line.** npm dist-tags: `latest: 4.3.3`, `v3-lts: 3.4.19`. Zero published 5.x, zero v5 prereleases. `@theme inline`, `@utility` and `@custom-variant` are being extended in 4.3, not deprecated. Spartan's own preset uses `@theme inline`.
- **Zod-per-audience contracts** are the best-evidenced decision in the repo — schema, tags and `eslint.config.mjs` all agree (`type:contracts` → `onlyDependOnLibsWithTags: []`).
- **Spartan develops on AIC's exact stack**: Angular 21.2.16, Nx 22.7.5, TS 5.9.3, tailwindcss ^4.2.1.
- **The one visible upstream design change is non-threatening.** [RFC #1713](https://github.com/spartan-ng/spartan/issues/1713) (runtime-switchable styles, 2026-08-25, no maintainer reply) explicitly preserves the copy-in model, avoids CVA, adds no published package, and states single-style projects emit byte-identical output.

**Angular 21 is in LTS today.** [angular.dev/reference/releases](https://angular.dev/reference/releases): `^21.0.0 | LTS | LTS ends 2027-06`; `^22.0.0 | Active | 2028-06`. LTS means _"Only critical fixes and security patches are released."_ The `v21-lts` dist-tag is 21.2.22 — the repo is 8 patches behind inside its own LTS line.

**Signal Forms is `@experimental` in the pinned version.** `@angular/forms@21.2.14` carries 128 `@experimental` markers across its type files (2 in 22.1.4, both unrelated WebMCP). Angular CHANGELOG 22.0.0, commit `7745365910`: _"graduate signal forms APIs to public API."_ And Angular's release policy explicitly exempts experimental APIs: _"The policies and practices that are described in this document do not apply to APIs marked as experimental."_ So "Angular 21 is in LTS" buys nothing for Signal Forms specifically.

**But AIC's usage survives the hop — verified by AOT compile, not symbol diff.** The real `libs/shared/ui/src/lib/form-field/` sources plus a probe reproducing the demo's schema and templates compiled with `ngc` under Angular 22.1.4 + TypeScript 6.0.3, `strictTemplates` on: **exit 0, zero errors**. (Correction to the research: exposure is nine symbols, not just `FormField` — `apps/client/src/app/signal-forms-demo` imports `email, form, max, min, minLength, required, submit, validate` too. All nine survive.)

**[CORRECTED] The Nx hop cannot be taken "while staying on Angular 21" by default.** `@nx/angular@23.1.2`'s `migrations.json` contains `packageJsonUpdates["23.1.0"]` with `"requires": {"@angular/core": ">=21.2.0 <22.0.0"}` — matching this repo exactly — and `"@angular/core": {"version": "~22.0.0", "alwaysAddToPackageJson": true}` plus cli/build/devkit/schematics/cdk/material/ng-packagr all `~22.0.0` ([mirrored on nx.dev](https://nx.dev/docs/technologies/angular/migrations)). Unlike all 13 earlier Angular bumps in that file, the 23.1.0 entry has **no `x-prompt`**, and `migrate.js` reads `if (!packageUpdate['x-prompt']) { return Promise.resolve(true); }` — applied with no chance to decline. Staying on 21 requires `--include=required` (which is documented on [nx.dev](https://nx.dev/docs/features/automate-updating-dependencies) but **not listed in `nx migrate --help`** at 23.1.2, and defaults to `all` in any non-TTY/CI run) or an explicit `--to=`. Nx 23.1 will _run_ on Angular 21 — its five Angular-22 code migrations are each gated `requires @angular/core >=22.0.0` and no-op — but the default path takes you to 22.0.x.

Nx 23.0 is also a major: Node ≥22 minimum, ESLint v8 dropped, `@nx/angular:ngrx` / `:move` / the module-federation entry point removed, deep `@nx/angular/src/*` imports rewritten. And [Nx 23.1](https://nx.dev/blog/nx-23-1-release) _"ships support for Angular 22 and the matching angular-eslint"_ — `latest` is 23.1.2 (published 2026-08-26), `previous` is 22.7.8.

**Confirmed local drift, all re-verified:**

- `docs/spartan-ui-architecture.md:513-516` claims client=crimson, agent=blue, dealer=green, broker=orange. The code says `--aic-brand`, `--aic-step-selected`, `--aic-warning`, `--aic-info`. **Every row wrong**, and no app uses green.
- `docs/session-strategy.md:3,7` says _"No part of the current POC uses Redis"_ and links `secure-session.plugin.ts`, which does not exist. `libs/bff/core/src/lib/plugins/` contains `session.plugin.ts` + `redis-store.ts`. Still cross-linked as current from `handover.md:29`.
- `docs/angular-22-upgrade.md` has drifted **both ways**: it names Nx and TypeScript 6 as two gates (one now cleared, so "obsolete" overstates it), while ticking `jest-preset-angular` 17.0.0 as cleared when `package.json` still pins `~16.0.0`.
- `theme.css:276` attributes `(0,2,0)` specificity to `.dark` — that block is `(0,1,0)`; the `(0,2,0)` belongs to the generated `dark:` utility because Spartan ships `@custom-variant dark (&:is(.dark *))` rather than Tailwind's documented `:where(.dark, .dark *)`. Right conclusion, wrong mechanism.
- **`openid-client` v5.7.1 was published 2024-11-22 — 21 months stale.** v6.8.7 shipped 2026-08-20 and is ESM-only (confirming the esbuild `bundle:false` conflict). This is standing debt in the _authentication_ path.
- **No CI, and `.githooks/pre-push` deliberately skips `build`.** No Angular app has a `typecheck` target. Angular template and type errors are caught by nothing automated, and `--no-verify` bypasses even the local hook.

### Recommendation

**The direction is sound and needs no re-architecting. Fix the gate, close the premise gap, then take the version hops together as one rehearsed change.**

Two things reframe the "hold at 21" position. First, v21 is already LTS-only, and the repo is 8 patches behind within it. Second, `libs/shared/ui` — a _shared library_, not an app — is built on API Angular marks experimental and explicitly exempts from its own stability policy. Holding is not free.

But the counterweight is stronger than the research allowed: **the Nx hop is not the decoupled, low-risk move it was presented as.** `nx migrate latest` drags Angular 22 in unprompted. So there is no "do the mechanical part first on Angular 21" shortcut. It is one change: Nx 23.1 + TypeScript 6.0.3 + Angular 22.1.4 + `angular-eslint` 22 + `jest-preset-angular` 17, rehearsed on a throwaway branch, gated on an AOT build and a manual Spartan pass.

**The highest-value work has nothing to do with versions.** The repo contains exactly **one** `@spartan-ng/brain` import. The form-field layer — the part a business developer touches daily — is hand-rolled with its own `cva` and ships a visibly different focus ring from the canonical button beside it. For a POC whose stated standard is _"even primitives must be idiomatic, not hand-approximated,"_ that is the finding that matters most, and it is entirely within your control. Do it before anyone reviews this repo as an architecture reference.

### Risks

- **No CI and no `build` in the gate.** This is the prerequisite for everything, and it also means `docs/handover.md`'s "the full gate is green" overstates coverage.
- **OnPush-by-default is a silent behavioural break, not a compile error** — mitigated here (17/17 already OnPush) but only discoverable by running the apps.
- **Spartan is still on Angular 21 internally.** If AIC goes to 22 ahead of Spartan, AIC finds the integration bugs. There is no published Spartan roadmap.
- **Helm copied at 1.0.2 against brain 1.3.3** is outside what upstream ships (`libs/helm/package.json` pins brain exactly). Inside the documented same-major tolerance, but re-diff the copied components at the 1.3.3 tag rather than leaving them indefinitely.
- **The docs decay faster than they are maintained** — four separate stale documents, only `handover.md` tracking reality. Anyone assessing this repo from the docs alone reaches wrong conclusions about auth, styling and shape.
- **Tailwind 4.4 is plausibly due in the POC window** (~3-month minor cadence) and `[Unreleased]` shows heavy investment in an automated class-rewriting "Canonicalization" pass. If a future minor renames a utility, that codemod must be pointed at the copied helm source in `libs/shared/ui`, not just app templates. Nothing in `[Unreleased]` touches `@theme` semantics.

---

## What we could not establish

1. **Whether Angular 21.2.x accepts TypeScript 6.0 — the sources contradict each other.** [angular.dev/reference/versions](https://angular.dev/reference/versions) lists `21.0.x || 21.1.x || 21.2.x → >=5.9.0 <6.0.0` (disjoint from 22.0.x's `>=6.0.0 <6.1.0`), while two independent reads of `@angular/compiler-cli@21.2.14`'s own `peerDependencies` report `"typescript": ">=5.9 <6.1"`. If the peer range is right, TS 6 can land on Angular 21; if the docs table is right, it cannot. **Check the installed package's `peerDependencies` directly before planning around it.** Given the Nx migration bumps TS anyway, this may be moot.
2. **Template compatibility under Angular 22.** Structurally unverifiable by the method used, and nobody has run ngtsc against this repo on v22. The eight `.html` files plus fourteen inline templates under `strictTemplates: true` are an open question. `nx run-many -t build` on a v22 branch is the only answer.
3. **Runtime behaviour equivalence of Signal Forms 21 → 22.** Type-compatibility was proven by AOT compile, but v22 shipped `perf: lazily instantiate signal form fields`, `fix: split the touched model into an input and touch output`, and `fix: align FormField CVA selection priority with standard forms`. `HlmInputDirective.showError` keys its entire error UX off `state.touched()`. Nobody ran the app or `apps/client-e2e/src/signal-forms.spec.ts` against v22.
4. **An empirical anomaly with `nx migrate`.** Running `nx migrate 23.1.2` and `nx migrate latest` from the workspace's own nx 22.7.4 rewrote _only_ the `nx` version, touched no `@nx/*` or `@angular/*`, and created **no** `migrations.json`. A cross-major hop yielding zero migrations is an incomplete run, not a supported Angular-21-preserving path. Unexplained. **Rehearse before planning around it.**
5. **Whether Tailwind 4.3.2 exposes any theme variable behind `border`** (139 usages in `style-vega.css`). Do not assume border-weight groups with density.
6. **Whether vega's 15 unmapped template placeholders are intentional or upstream bugs** — including `spartan-card-action`, which would render unstyled with no error if AIC ever generates the `card` primitive.
7. **Nx docs contradict themselves on leaf-folder convention** across four Nx-authored sources; there is no single blessed answer on folder shape. The Feb-2025 blog (`@org/shared-ui-forms`) and the current KB (`@org-shared/ui-forms`) also disagree on alias flattening. The KB is current.
8. **Zod's own published bundle figures do not survive measurement.** [zod.dev/packages/mini](https://zod.dev/packages/mini) publishes "Zod Mini 2.12kb / Zod 5.91kb" for `z.boolean().parse(true)`; measured against zod 4.4.3 with esbuild it is 2.65 kB vs 64.6 kB — the docs' classic figures are 4–11× low. Even the primary source cannot be the basis for a sizing decision.
9. **`fastify-type-provider-zod`'s `zod/mini` support is de facto, not contractual.** It is genuinely typed against `zod/v4/core`, but its README compatibility table says only ">=5.x → zod v4" and its peer range is `zod: >=4.1.5`. Nothing promises mini; it could regress without a semver-major.
10. **`nx migrate --include` is documented on nx.dev but absent from `nx migrate --help` at 23.1.2.** Do not stake a plan on it without verifying it works on your branch.
11. **GitHub API rate limiting** blocked direct re-verification of Spartan issues #1274, #1708 and PR #1714 — those rest on two independent researchers agreeing plus corroborating evidence (main now reads `angularCli: options.angularCli ?? false`, so #1714 landed). #910, #1574, #1636 and #1713 were fetched and verified directly.

---

## Suggested sequence

**Do now, in this order:**

1. **Add `build` to `.githooks/pre-push`** (or add `typecheck` targets to the four Angular apps). ~2 hours. Nothing else on this list is safe without it, and it is the highest-leverage fix in the repo regardless of every other decision.
2. **Codemod `import { z } from 'zod'` → `import * as z from 'zod'`** across all 14 files, and add [eslint-plugin-import-zod](https://github.com/samchungy/eslint-plugin-import-zod). ~1 hour, −36 kB gzip on the dealer route, zero API churn.
3. **Fix the doc drift.** `docs/spartan-ui-architecture.md:513-516` (all four accent rows wrong), `docs/session-strategy.md` (Redis claim + dead file link), `docs/angular-22-upgrade.md` (jest-preset tick vs pinned `~16.0.0`), `theme.css:276` (specificity mechanism), and the `theme.css` `inline` comment (it is backwards — non-`inline` bakes in the resolved value). ~2 hours, and it stops the pattern.
4. **Assert `@theme inline` in `theming-contract.spec.ts`.** The contract claims enforcement and does not guard its own mechanism; the failure is silent.

**Then, one at a time:**

5. **Upgrade `@spartan-ng/{cli,brain}` 1.0.2 → 1.3.3** and re-diff button/table/utils at the 1.3.3 tag. Give 1.3.3 a couple of weeks' soak first. Follow the [update guide](https://www.spartan.ng/documentation/update-guide) procedure, not a bare bump.
6. **Phase 3 — put `form-field` through `tools/spartan-add.js`** (`input`, `label`, `field`) and re-apply the Signal Forms wiring on top of vega output. 2–4 days. This is the change that makes the correctness-POC claim true.
7. **Add `--spacing` to the tier-2 token list**, scoped per app in `.theme-<app>`, with the `rounded-full` / bare-`rounded` immunity documented next to it.
8. **The Nx libs sweep** (moves + `@aic-shared/*` aliases + `components.json` + tag axis + tag vocabulary doc + local generator). ~2–3 hours, as maintenance.

**Then, as one rehearsed change on a throwaway branch:**

9. **Nx 23.1.2 + TypeScript ~6.0.3 + Angular 22.1.4 + `angular-eslint` ^22.1.0 + `jest-preset-angular` ~17.0.0**, plus `engines.node` `>=24.15.0`. Gate merge on `nx run-many -t build` **and** a manual Spartan pass over overlay/dialog/select/combobox — not just green CI. Land on 22.1.4, not 22.0.x: 22.0.0 shipped runtime guard NG0992 (_"Cannot create a resource inside the `params` of another resource"_) which broke `validateStandardSchema` + `validateHttp` on the same field tree ([#69620](https://github.com/angular/angular/issues/69620), fixed in 22.1.x) — exactly the shape of the parked `/signal-forms` demo. Then rewrite `docs/angular-22-upgrade.md` as a completed record.
10. **The `apiResource` factory + three home pages**, in the v22 idiom. Ship the probe spec file — Angular documents the httpResource testing story by assertion only, with no worked example and an open docs gap. For a POC whose product _is_ the canonical pattern, that spec is arguably the most valuable artifact of the whole exercise; put a copy in `docs/`.

**Explicitly wait:**

- **`zod/mini`.** ~13.4 kB gzip does not justify a dialect split, and it silently converts 400s to 500s until `error-handler.plugin.ts:57` is widened to `$ZodError`.
- **A style flavour, an overlay, or a `style-vega.css` fork.** Pre-authorise the overlay in the ADR with its trigger and 20-rule cap; build nothing.
- **Full package-manager workspaces + TS project references (Option D).** After the Angular 22 / Nx 23 dust settles. Doing it in the same window gives you an unbisectable commit.
- **`openid-client` v5 → v6.** Real 21-month debt in the auth path, ESM-only, conflicts with esbuild `bundle:false`. Belongs on the **security** backlog with its own window, not bundled into any of the above.
- **Anything predicated on Spartan registry [#910](https://github.com/spartan-ng/spartan/issues/910) / PR #1574.** Eleven months open, unassigned, no maintainer reply; the implementation is a self-described POC untouched since 2026-06-25 with unresolved defects flagged in review.

**Worth reporting upstream to Spartan (minutes each, real leverage):**

- **Comment on [RFC #1713](https://github.com/spartan-ng/spartan/issues/1713), open question 2** — the "pure CSS" variant. If `.spartan-*` classes survive into consumer projects, an AIC sheet becomes nearly free. The RFC is days old with no maintainer reply; a real-workspace voice now is worth more than one later.
- **File the `--style` silent-failure bug.** `nx g @spartan-ng/cli:ui <primitive> --style=<unknown>` is accepted by Nx (no `additionalProperties: false`), read by `ui/generator.ts`, and degrades to fully unstyled output because `getStyleMap` swallows the read error with `catch { return {}; }`. That should throw, or `style` should be declared in `ui/schema.json`.
- **File the missing ask: a project-owned style file.** Nobody has requested one. Minimal shape: a `stylePath` field relaxing `style` to `enum | path`, resolved from the workspace root instead of `path.join(__dirname, '..', 'ui')` — roughly ten lines across `config.ts` and `base/generator.ts`, no component changes, no registry. Cross-link #1713 and #910.
- **Comment on [#1636](https://github.com/spartan-ng/spartan/issues/1636)** confirming 1.3.3 behaviour on a real Nx workspace with `generateAs: entrypoint`. It is still open though #1714 fixed it, and it is the only way to learn whether the fixed path still creates `ui-helm`.
