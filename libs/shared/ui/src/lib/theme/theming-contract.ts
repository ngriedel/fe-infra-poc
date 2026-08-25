/**
 * The theming contract, as data.
 *
 * Tier 1 is the Absa palette (`--aic-*`) and belongs to design — apps may not
 * redefine it, and may not introduce a colour of their own. Tier 2 is the small
 * set below that an app MAY override in its `.theme-<app>` block, and only with
 * a `var(--aic-*)` reference drawn from tier 1.
 *
 * This list is the single source of truth for tooling. `theme.css` marks each
 * of these at its declaration with `THEMEABLE (tier 2): <tokens>`, and
 * `theming-contract.spec.ts` parses those markers back out and asserts the two
 * agree — so adding a token here without marking it in the CSS (or the reverse)
 * fails the build rather than drifting quietly.
 *
 * Lives beside the theme rather than inside the spec so it is discoverable, and
 * so a lint rule or theme-builder can import it later.
 */
export const THEMEABLE_TOKENS = [
  '--app-accent',
  '--app-accent-foreground',
  '--primary',
  '--primary-foreground',
  '--radius',
] as const;

export type ThemeableToken = (typeof THEMEABLE_TOKENS)[number];
