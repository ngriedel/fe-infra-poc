# Angular 22 Upgrade — Holding on Nx (status: NEARLY READY, updated 2026-07-01)

We are **staying on Angular 21.2** for now. As of 2026-07-01 almost every blocker
from the original hold has cleared. The **only hard gate left is Nx**: Angular 22
support is in the **Nx 23.1 beta** (`23.1.0-beta.5`); **Nx 23.0.x stable still caps
at Angular 21**. Plus a required **TypeScript 6** bump. Revisit when Nx 23.1 ships stable.

## Status (evidence as of 2026-07-01)

| Dependency              | Needed for v22                                       | Status                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nx**                  | Drives the Angular bump via `@nx/angular` migrations | ❌ **Only remaining blocker.** `nx@latest` = **23.0.1**, but `@nx/angular@23.0.1` peers `@angular/build ">= 19 < 22"` → caps at Angular 21. Angular 22 support is in `@nx/angular@23.1.0-beta.5` (`@angular/build ">= 20 < 23"`) — **beta, not stable.** |
| **TypeScript**          | Angular 22 compiler                                  | ⚠️ **Bump required.** `@angular/compiler-cli@22.0.4` peers `typescript ">=6.0 <6.1"` — we're on **5.9.3**. Angular 22 needs **TS 6.0**.                                                                                                                  |
| **@spartan-ng/brain**   | UI primitives                                        | ✅ **Cleared.** `1.0.2` peers `@angular/core ">=21 <23"`, `@angular/cdk ">=21 <23"`.                                                                                                                                                                     |
| **jest-preset-angular** | Unit-test harness                                    | ✅ **Cleared.** `17.0.0` peers `@angular/core` & `@angular/compiler-cli ">=20 <23"`, `typescript ">=5.8"`.                                                                                                                                               |
| **angular-eslint**      | Lint                                                 | ✅ **Cleared.** `22.0.0` (peers `@angular/cli ">=22 <23"`) — bump from our 21.2.                                                                                                                                                                         |
| **@angular/cdk**        | Overlay/a11y                                         | ✅ `22.0.2` stable (Spartan now allows it).                                                                                                                                                                                                              |
| **@maskito/angular**    | Input masks                                          | ✅ `5.3.1` peers `@angular/core ">=19"` (no upper cap).                                                                                                                                                                                                  |

Node 24 ✅ (Angular 22 wants Node 22+).

> **Read the ticks as "available upstream", not "we are on it".** Nothing in this table
> has been installed. As of 2026-08-27 the repo is on `nx@^22.7.4`, `@nx/angular@22.7.4`,
> `typescript@^5.9.3`, `jest-preset-angular@~16.0.0`, `angular-eslint@^21.2.0`,
> `@angular/cdk@^21.2.12` and `@angular/core@~21.2.0`. So `jest-preset-angular` is ticked
> because **17.0.0 exists and lifts the cap**, not because we have taken it — the same
> goes for `angular-eslint`. Both are hard peer blocks that must move as part of the
> upgrade, not prerequisites already satisfied.
>
> The version facts below were captured when this file was written and have not been
> re-checked here. [docs/direction-review.md](direction-review.md) §1 carries a later,
> independently verified picture — including two peer blocks this table misses and the
> reason to land on Angular 22.1.x rather than 22.0.x.

## Green-light checklist

- [ ] **Nx 23.1 is stable** — `npm view nx dist-tags` shows `latest: 23.1.x` (today
      it's `23.0.1`, with `next: 23.1.0-beta.5`) **and** `@nx/angular@<that>` peers
      allow `@angular/build >=22`. This is the last domino.
- [ ] **Bump TypeScript to 6.0** — Angular 22's `@angular/compiler-cli` requires
      `typescript ">=6.0 <6.1"`. Check `typescript-eslint` supports TS 6 at that point.
- [x] **Spartan NG** allows `@angular/core >=22` / `@angular/cdk >=22` — done (`@spartan-ng/brain@1.0.2`).
- [x] **jest-preset-angular** lifted its `<22` cap — done (`17.0.0`).
- [x] **angular-eslint 22** available — done (`22.0.0`).

> Willing to run Nx on the **beta channel** (`nx@next` / `@nx/angular@23.1.0-beta.x`)?
> Then the upgrade is technically doable **now** — every other dep is ready and the
> TS 6 bump is mechanical. Waiting for Nx 23.1 stable is the conservative call.

## Readiness check (re-run anytime)

```bash
node -e "const g=async n=>{const v=await fetch('https://registry.npmjs.org/'+encodeURIComponent(n)+'/latest').then(r=>r.json());return v};(async()=>{const nx=await g('nx');const sp=await g('@spartan-ng/brain');const jpa=await g('jest-preset-angular');console.log('nx latest:',nx.version);console.log('spartan brain peer @angular/core:',sp.peerDependencies?.['@angular/core']);console.log('jest-preset-angular peer @angular/core:',jpa.peerDependencies?.['@angular/core']);})()"
```

Green light ≈ `nx latest: 23.x`, Spartan core peer allows `<23` (i.e. `>=22`), jest-preset core peer allows `>=22`.

## When ready — the Nx upgrade procedure (NOT `ng update`)

In an Nx workspace you use `nx migrate`, which wraps Angular's schematics:

```bash
nx migrate latest               # rewrites package.json + writes migrations.json
pnpm install
nx migrate --run-migrations     # runs Angular + Nx codemods
```

Then handle Angular 22's manual breaking changes (mostly auto-migrated): `ComponentFactoryResolver`
removal, stricter templates (duplicate input bindings now error), `data-*` no longer treated as
property bindings, `provideRoutes()` → `provideRouter()`. Run `nx run-many -t lint test build` after.

Do the whole thing on a throwaway branch.
