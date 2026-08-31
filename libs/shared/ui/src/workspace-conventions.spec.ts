import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Workspace naming conventions, enforced.
 *
 * The libs were renamed in one sweep (see docs/architecture-decisions.md). Left
 * alone, the convention re-drifts immediately: `@nx/js:lib` derives a project's
 * name from the last folder segment when `--name` is omitted, which is exactly
 * how `libs/bff/contracts` came to own the bare word `contracts` and force the
 * per-audience libs to be hand-named around it.
 *
 * Rather than wrap the generator, assert the invariants it violates. Two rules:
 *
 *   1. a lib's project name is `<scope>-<leaf>`;
 *   2. its import alias is `@aic-<scope>/<leaf>` — one slash, so it is a legal
 *      npm package name and survives a later move to package-manager workspaces.
 *      `@aic/shared/ui` had two and would have had to be renamed a second time.
 *
 * Lives in this project because it is the one with a test target that already
 * reaches outside itself (see theming-contract.spec.ts). It asserts nothing about
 * shared/ui specifically.
 */

const SCOPES = ['shared', 'agent', 'broker', 'dealer'] as const;

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

/** Every `project.json` under libs/, with its declared name. */
function libProjects(): Array<{ dir: string; name: string | undefined }> {
  const out: Array<{ dir: string; name: string | undefined }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'project.json') {
        const json = JSON.parse(readFileSync(full, 'utf8'));
        out.push({ dir: dirname(full).split(String.fromCharCode(92)).join('/'), name: json.name });
      }
    }
  };
  walk(join(ROOT, 'libs'));
  return out;
}

function aliases(): Record<string, string> {
  const raw = readFileSync(join(ROOT, 'tsconfig.base.json'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  return JSON.parse(raw).compilerOptions.paths as Record<string, string>;
}

describe('workspace conventions', () => {
  const projects = libProjects();
  const paths = aliases();

  it('finds the lib projects', () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  // Nx 22.7.4 has no folder-derived fallback at runtime: `buildProjectFromProjectJson`
  // passes `json.name` straight through, and with no sibling package.json a missing
  // name throws ProjectsWithNoNameError. So this is mandatory, not stylistic.
  it.each(projects.map((p) => [p.dir, p] as const))('%s declares a name', (_dir, project) => {
    expect(typeof project.name).toBe('string');
  });

  it.each(projects.map((p) => [p.dir, p] as const))(
    '%s is named <scope>-<leaf>',
    (_dir, project) => {
      expect(SCOPES.some((s) => project.name?.startsWith(`${s}-`))).toBe(true);
    },
  );

  it('gives every lib an alias derived from its name', () => {
    const expected = projects.map((p) => {
      // `shared-bff-core` -> `@aic-shared/bff-core`: the first dash becomes the slash.
      const [scope, ...leaf] = (p.name ?? '').split('-');
      return { dir: p.dir, alias: `@aic-${scope}/${leaf.join('-')}` };
    });

    const missing = expected.filter((e) => !(e.alias in paths));
    expect(missing).toEqual([]);
  });

  it('keeps every alias npm-legal — exactly one slash', () => {
    const offenders = Object.keys(paths).filter((a) => (a.match(/\//g) ?? []).length !== 1);
    expect(offenders).toEqual([]);
  });
});
