#!/usr/bin/env node
/**
 * Add a Spartan helm primitive to `libs/shared/ui`.
 *
 *     pnpm spartan:add <primitive>        e.g. `pnpm spartan:add badge`
 *
 * Why this exists rather than `nx g @spartan-ng/cli:ui <primitive>`: the CLI does
 * two jobs, and we only want one of them. See docs/spartan-ui-architecture.md §2.
 *
 *   1. TRANSFORM — resolve the templates' `spartan-*` placeholder classes against
 *      our `style` flavour and write real Tailwind utilities. This is the job we
 *      want, and it is NOT optional: copying a template unresolved yields class
 *      names that are defined nowhere, so the component renders unstyled with no
 *      error anywhere in the build.
 *   2. SCAFFOLD — create an Nx project to hold the result. This is the job we do
 *      NOT want: it would nest a project inside `libs/shared/ui` (and, run
 *      plainly, silently ignores our `buildable`/`generateAs` settings because
 *      the CLI parses components.json with the Angular-CLI schema by default).
 *
 * So we call the CLI's own transform functions and place the output ourselves,
 * in our flat single-barrel layout.
 */
const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');

const REPO = path.resolve(__dirname, '..');
const CLI = path.join(REPO, 'node_modules/@spartan-ng/cli/src/generators');
const { createStyleMap } = require(path.join(CLI, 'base/lib/styles/create-style-map'));
const { transformStyle } = require(path.join(CLI, 'base/lib/styles/transform'));
const SUPPORTED = require(path.join(CLI, 'ui/supported-ui-libraries.json'));
const { primitiveDependencies } = require(path.join(CLI, 'ui/primitive-deps'));

const config = JSON.parse(fs.readFileSync(path.join(REPO, 'components.json'), 'utf8'));
const { style, importAlias } = config;
const LIB = path.join(REPO, 'libs/shared/ui/src/lib');

const name = process.argv[2];
if (!name || !SUPPORTED[name]) {
  console.error(name ? `Unknown primitive: ${name}\n` : 'Usage: pnpm spartan:add <primitive>\n');
  console.error('Available:\n  ' + Object.keys(SUPPORTED).sort().join(', '));
  process.exit(1);
}

const target = path.join(LIB, name);
if (fs.existsSync(target)) {
  console.error(`${path.relative(REPO, target)} already exists — delete it first to regenerate.`);
  process.exit(1);
}

/** Collect every *.template under the primitive's files/ dir. */
function templates(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return templates(full, base);
    return e.name.endsWith('.template') ? [path.relative(base, full)] : [];
  });
}

(async () => {
  const prettierConfig = await prettier.resolveConfig(path.join(REPO, '.prettierrc'));
  const styleMap = createStyleMap(fs.readFileSync(path.join(CLI, `ui/style-${style}.css`), 'utf8'));
  const filesDir = path.join(CLI, 'ui/libs', name, 'files');
  const written = [];

  fs.mkdirSync(target, { recursive: true });

  for (const rel of templates(filesDir)) {
    let src = fs.readFileSync(path.join(filesDir, rel), 'utf8');

    // 1. The EJS substitution `generateFiles()` does before the transform runs.
    src = src.replace(/<%-\s*importAlias\s*%>/g, importAlias);

    // 2. The transform itself — placeholder classes -> real utilities.
    src = await transformStyle(src, { styleMap });

    // 3. Repoint imports for our flat layout: there are no per-primitive
    //    entry points here, so `<alias>/utils` and `<alias>/<other>` become
    //    relative paths to sibling folders.
    //    The alias is a literal string, so plain splits beat regex escaping.
    src = src.split(`'${importAlias}/utils'`).join("'../utils/hlm'");
    src = src.split(`'${importAlias}/`).join("'../");

    // 4. index.ts sits beside its siblings here, not above a lib/ dir.
    const out = path.basename(rel).replace(/\.template$/, '');
    if (out === 'index.ts') src = src.replace(/'\.\/lib\//g, "'./");

    const dest = path.join(target, out);
    src = await prettier.format(src, { ...prettierConfig, filepath: dest });
    fs.writeFileSync(dest, src);
    written.push(out);
  }

  console.log(`\n✓ ${name} → libs/shared/ui/src/lib/${name}/`);
  written.sort().forEach((f) => console.log(`    ${f}`));

  // Primitives this one imports from, that we haven't added yet.
  const missing = (primitiveDependencies[name] ?? []).filter(
    (d) => !fs.existsSync(path.join(LIB, d)),
  );
  if (missing.length) {
    console.log(`\n⚠ depends on primitives not present yet: ${missing.join(', ')}`);
    console.log(`  add them first: ${missing.map((m) => `pnpm spartan:add ${m}`).join(' && ')}`);
  }

  // Peer deps the primitive needs that aren't in package.json.
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const installed = { ...pkg.dependencies, ...pkg.devDependencies };
  const needed = Object.keys(SUPPORTED[name].peerDependencies ?? {}).filter((d) => !installed[d]);
  if (needed.length) console.log(`\n⚠ install peer deps: pnpm add ${needed.join(' ')}`);

  // Wire it into the single barrel — the whole point of the flat layout, and the
  // one step there is no reason to leave to a human.
  //
  // `export *` rather than an enumerated list: the primitive's own `index.ts` is
  // already the curated public surface (Spartan authors it, exporting each
  // directive plus the `Hlm*Imports` const). Re-enumerating those names here
  // would silently go stale the first time upstream adds a directive.
  if (written.includes('index.ts')) {
    const barrel = path.join(REPO, 'libs/shared/ui/src/index.ts');
    const line = `export * from './lib/${name}';`;
    let barrelSrc = fs.readFileSync(barrel, 'utf8');

    if (barrelSrc.includes(line)) {
      console.log(`\n  barrel already exports ${name} — left unchanged`);
    } else {
      barrelSrc = `${barrelSrc.trimEnd()}\n\n// ${name} (canonical Spartan helm — generated)\n${line}\n`;
      barrelSrc = await prettier.format(barrelSrc, { ...prettierConfig, filepath: barrel });
      fs.writeFileSync(barrel, barrelSrc);
      console.log(`\n  barrel updated → import from '${importAlias}'`);
    }
  }
})();
