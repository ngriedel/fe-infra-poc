# Angular 22 Upgrade — Holding (status: BLOCKED, decided 2026-06-05)

We are **staying on Angular 21.2** for now. Angular 22 released ~May 2026, but our
toolchain/UI deps don't support it yet. Revisit when the green-light checklist below passes.

## Why we're waiting (evidence as of 2026-06-05)

| Dependency | Needed for v22 | Status |
|---|---|---|
| **Nx (stable)** | Drives the Angular bump via `@nx/angular` migrations | ❌ Latest stable **22.7.5** tops out at Angular **21.2**. v22 support only in **Nx 23 pre-releases** (`23.0.0-canary.*`). |
| **@spartan-ng/brain** | Our UI primitives | ❌ Latest `alpha.705` peer: `@angular/core ">=20 <22"`, `@angular/cdk "<22"`. Long pole — pre-1.0, gates on CDK 22. |
| **jest-preset-angular** | Entire unit-test harness | ❌ Latest `16.1.5` peer: `@angular/core` & `@angular/compiler-cli ">=19 <22"`. |
| @angular/cdk | — | ✅ 22.0.0 exists, but Spartan pins `<22`, so unusable until Spartan moves. |

Also note: Angular 22 wants **TypeScript 6** (we're on 5.9) and Node 22+ (we're on 24 ✅).

## Green-light checklist (all must pass)

- [ ] **Nx 23 is stable** (`npm view nx version` is `23.x`, not a canary) and its
      [Angular version matrix](https://nx.dev/docs/technologies/angular/guides/angular-nx-version-matrix) lists Angular 22.
- [ ] **Spartan NG** publishes a release whose peer deps allow `@angular/core >=22` and `@angular/cdk >=22`.
- [ ] **jest-preset-angular** lifts its `<22` cap on `@angular/core` / `@angular/compiler-cli`.

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
