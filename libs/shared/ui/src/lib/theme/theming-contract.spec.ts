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

/** Tier 2 — the only tokens an app's theme block may declare. */
const THEMEABLE = [
  '--app-accent',
  '--app-accent-foreground',
  '--primary',
  '--primary-foreground',
  '--radius',
] as const;

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
        .filter((prop) => !THEMEABLE.includes(prop as (typeof THEMEABLE)[number]));
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

  it('keeps the documented contract in step with this test', () => {
    const theme = readFileSync(join(ROOT, 'libs/shared/ui/src/theme.css'), 'utf8');
    // Every themeable token must be named in the contract note...
    for (const token of THEMEABLE) {
      expect(theme).toContain(token);
    }
    // ...and marked at its declaration, so a reader of the file sees it too.
    expect(theme).toContain('THEMEABLE (tier 2)');
  });
});
