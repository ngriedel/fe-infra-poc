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

  it('tags every themeable token at a real declaration, not just in prose', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    for (const token of THEMEABLE) {
      // e.g. "--primary:" must appear as an actual CSS declaration.
      expect(theme).toMatch(new RegExp(`^\\s*${token}\\s*:`, 'm'));
    }
  });
});
