import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Enforces the theming contract documented at the end of `theme.css`.
 *
 * Until now that contract was a comment, which is the weakest possible form of
 * governance — and it had already drifted (two of the three themeable tokens
 * were unmarked). Comments don't fail builds; this does.
 *
 * The rules, in one place:
 *   - an app may set ONLY the tier-2 tokens listed below;
 *   - it must assign a `var(--aic-*)` palette reference, never a raw colour;
 *   - it must not redefine the tier-1 palette itself.
 */

import { THEMEABLE_TOKENS } from './theming-contract';

const THEMEABLE: readonly string[] = THEMEABLE_TOKENS;

const APPS = ['client', 'agent', 'dealer', 'broker'] as const;

/** Walk up from this file until we find the workspace root. */
function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, 'nx.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('workspace root not found');
    dir = parent;
  }
  return dir;
}

const ROOT = repoRoot();
const readApp = (app: string) => readFileSync(join(ROOT, 'apps', app, 'src', 'styles.css'), 'utf8');

/** Pull the declarations out of an app's `.theme-<app> { … }` block. */
function themeBlock(css: string, app: string): Array<{ prop: string; value: string }> {
  const match = new RegExp(`\\.theme-${app}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) return [];
  return (match[1] ?? '')
    .split(';')
    .map((line) => line.replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter((line) => line.includes(':'))
    .map((line) => {
      const idx = line.indexOf(':');
      return { prop: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
}

describe('theming contract', () => {
  describe.each(APPS)('%s', (app) => {
    it('declares a theme block', () => {
      expect(themeBlock(readApp(app), app).length).toBeGreaterThan(0);
    });

    it('applies that theme class on <body>', () => {
      const html = readFileSync(join(ROOT, 'apps', app, 'src', 'index.html'), 'utf8');
      expect(html).toContain(`<body class="theme-${app}">`);
    });

    // Tier 2: an app may only touch the tokens the contract opens up.
    it('sets only themeable tokens', () => {
      const offenders = themeBlock(readApp(app), app)
        .map((d) => d.prop)
        .filter((prop) => !THEMEABLE.includes(prop));
      expect(offenders).toEqual([]);
    });

    /**
     * Values must come from the palette. A raw hex here would be a new brand
     * colour smuggled in through an app stylesheet, and it would also miss the
     * dark-mode variant, since `var(--aic-*)` re-points under `.dark` while a
     * literal cannot.
     */
    it('assigns palette references, never raw colours', () => {
      const offenders = themeBlock(readApp(app), app)
        .filter((d) => d.prop !== '--radius')
        .filter((d) => !/^var\(--aic-[a-z0-9-]+\)$/.test(d.value));
      expect(offenders).toEqual([]);
    });

    // Tier 1 is design's. An app must not redefine the palette itself.
    it('does not redefine the tier-1 palette', () => {
      const declared = [...readApp(app).matchAll(/(--aic-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
      expect(declared).toEqual([]);
    });
  });

  /**
   * The drift check, done properly.
   *
   * The previous version asserted only that each token name appeared SOMEWHERE
   * in theme.css — a substring match that a passing mention in a comment
   * satisfied, and which `--ring` would have satisfied on day one simply by
   * existing as a declaration. This parses the `THEMEABLE (tier 2): …` tags out
   * of the stylesheet and compares the two sets exactly, so a token added to the
   * constant without being tagged (or tagged without being added) fails.
   */
  it('keeps the CSS tags and the exported constant in exact agreement', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    const tagged = new Set<string>();
    for (const tag of theme.matchAll(/THEMEABLE \(tier 2\):([^*]*)/g)) {
      for (const token of (tag[1] ?? '').matchAll(/--[a-z0-9-]+/g)) tagged.add(token[0]);
    }

    expect([...tagged].sort()).toEqual([...THEMEABLE].sort());
  });

  /**
   * The `inline` keyword is load-bearing and fails silently without it.
   *
   * `@theme inline` substitutes each theme variable's VALUE into the utility.
   * Every value here is a `var(--aic-*)` reference, so what gets substituted is
   * the reference — `bg-app-accent` emits `var(--app-accent)` and resolves at the
   * element. Drop `inline` and the utility references `--color-app-accent`
   * instead, which CSS resolves where it was declared (`:root`) — so `.dark` and
   * every `.theme-<app>` override on a descendant is silently ignored. The app
   * still builds and renders; it just renders the wrong colours.
   */
  it('registers the AIC colour families with `@theme inline`, not a bare `@theme`', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    expect(theme).toMatch(/@theme\s+inline\s*\{/);
    expect(theme).not.toMatch(/@theme\s*\{/);
  });

  it('maps every registered --color-* to a var() reference, never a literal', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    const block = /@theme\s+inline\s*\{([\s\S]*?)\n\}/.exec(theme)?.[1] ?? '';
    expect(block.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const m of block.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      // A literal here would be baked in at build time, defeating the override.
      if (!/^var\(--[a-z0-9-]+\)$/.test((m[2] ?? '').trim())) offenders.push(m[1] as string);
    }
    expect(offenders).toEqual([]);
  });

  it('tags every themeable token at a real declaration, not just in prose', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    for (const token of THEMEABLE) {
      // e.g. "--primary:" must appear as an actual CSS declaration.
      expect(theme).toMatch(new RegExp(`^\\s*${token}\\s*:`, 'm'));
    }
  });
});

/**
 * Contrast, enforced rather than annotated.
 *
 * Every `--aic-*-foreground` in `theme.css` carried a hand-computed ratio in a
 * comment — except one. `.dark` lifted `--aic-brand` to #D64B7C and left
 * `--aic-brand-foreground` inheriting white from `:root`, giving 4.07:1 on every
 * default button in three portals. Nothing recomputed the comments when a value
 * moved, and the pair with no comment was the pair that broke.
 *
 * So: recompute all of them, and fail if a documented ratio drifts from reality
 * or any pair drops below AA. Note the dark lift is bounded at BOTH ends — too
 * light and white fails, too dark and graphite fails — so a future nudge to a
 * brand value is exactly the change this needs to catch.
 */
describe('palette contrast', () => {
  const AA_NORMAL = 4.5;

  /** WCAG 2.x relative luminance for a #rrggbb colour. */
  function luminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');

  /** Hex declarations inside one top-level block, with each line's trailing comment. */
  function paletteIn(selector: RegExp): Record<string, { hex: string; note: string }> {
    const body = selector.exec(theme)?.[1] ?? '';
    const out: Record<string, { hex: string; note: string }> = {};
    for (const m of body.matchAll(/(--aic-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;([^\n]*)/g)) {
      out[m[1] as string] = { hex: (m[2] as string).toLowerCase(), note: m[3] ?? '' };
    }
    return out;
  }

  const light = paletteIn(/:root\s*\{([\s\S]*?)\n\}/);
  const darkOverrides = paletteIn(/\.dark\s*\{([\s\S]*?)\n\}/);

  // Model the cascade, not the source text. `.dark` inherits every `:root`
  // value it does not redeclare — and the original bug was precisely a
  // redeclared BASE inheriting a stale FOREGROUND, which a check that only
  // looked at declarations present in the block could never see.
  const dark = { ...light, ...darkOverrides };

  /** Each foreground paired with its base colour, resolved the way the cascade does. */
  function pairs(scope: 'light' | 'dark') {
    const set = scope === 'light' ? light : dark;
    return Object.keys(set)
      .filter((token) => token.endsWith('-foreground'))
      .map((token) => {
        const baseToken = token.replace(/-foreground$/, '');
        const base = set[baseToken];
        return { token, baseToken, base, fg: set[token] as { hex: string; note: string } };
      })
      .filter((p): p is typeof p & { base: { hex: string; note: string } } => Boolean(p.base));
  }

  describe.each(['light', 'dark'] as const)('%s mode', (scope) => {
    const cases = pairs(scope);

    it('has pairs to check', () => {
      expect(cases.length).toBeGreaterThan(0);
    });

    it.each(cases.map((c) => [c.baseToken, c] as const))('%s meets AA', (_name, c) => {
      expect(contrast(c.base.hex, c.fg.hex)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(cases.map((c) => [c.baseToken, c] as const))(
      '%s matches its documented ratio',
      (_name, c) => {
        const documented = /([0-9]+\.[0-9]+):1/.exec(c.fg.note);
        if (!documented) return; // not every pair carries a comment
        const actual = contrast(c.base.hex, c.fg.hex);
        expect(actual).toBeCloseTo(Number(documented[1]), 2);
      },
    );
  });
});
