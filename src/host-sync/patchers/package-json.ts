import { promises as fs } from 'node:fs';
import { normalizeLibCfg } from '../../helpers/lib-cfg.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TPatcher,
} from '../types.js';

/* ========================================================================== */
/*                          PATCHER — package.json                            */
/* ========================================================================== */

/**
 * Patches host `package.json`:
 *   - Adds dependencies + devDependencies declared in the manifest, only if
 *     not already present (does not overwrite host versions).
 *   - Adds per-library scripts: `test:<lib>`, `storybook:<lib>`, `docs:<lib>`,
 *     constructed from `manifest.workflows`. Library declares intent
 *     (port, configDir, pattern, root); patcher builds the script string.
 *
 * Pure JSON edit — no markers needed. Per-library script keys make
 * collisions impossible across libraries.
 */
export const patchPackageJson: TPatcher = async (ctx, host) => {
  if (!host.packageJson) return noopResult('no package.json');

  const cfg = normalizeLibCfg(ctx.manifest);
  const text = await fs.readFile(host.packageJson.path, 'utf8');
  const pkg = JSON.parse(text) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  const changes: TChangeEntry[] = [];

  /* ---------- dependencies ---------- */
  pkg.dependencies = pkg.dependencies ?? {};
  for (const [dep, version] of Object.entries(cfg.dependencies ?? {})) {
    if (pkg.dependencies[dep] || pkg.devDependencies?.[dep]) {
      changes.push({ kind: 'skip', message: `dep ${dep} already present` });
    } else {
      pkg.dependencies[dep] = version;
      changes.push({ kind: 'add', message: `dep ${dep}@${version}` });
    }
  }

  /* ---------- devDependencies ---------- */
  pkg.devDependencies = pkg.devDependencies ?? {};
  for (const [dep, version] of Object.entries(cfg.devDependencies ?? {})) {
    if (pkg.dependencies[dep] || pkg.devDependencies[dep]) {
      changes.push({ kind: 'skip', message: `devDep ${dep} already present` });
    } else {
      pkg.devDependencies[dep] = version;
      changes.push({ kind: 'add', message: `devDep ${dep}@${version}` });
    }
  }

  /* ---------- scripts ---------- */
  pkg.scripts = pkg.scripts ?? {};
  const scripts: Record<string, string> = {};

  if (cfg.workflows?.test?.pattern) {
    scripts[`test:${cfg.name}`] =
      `jest --testPathPattern=${cfg.workflows.test.pattern}`;
  }
  if (cfg.workflows?.storybook) {
    const { configDir, port } = cfg.workflows.storybook;
    scripts[`storybook:${cfg.name}`] =
      `storybook dev -p ${port} --config-dir ${configDir}`;
  }
  if (cfg.workflows?.docs) {
    const { root, port } = cfg.workflows.docs;
    scripts[`docs:${cfg.name}`] = `cd ${root} && astro dev --port ${port}`;
  }

  for (const [name, value] of Object.entries(scripts)) {
    const existing = pkg.scripts[name];
    if (existing === value) {
      changes.push({ kind: 'skip', message: `script "${name}" up to date` });
    } else if (existing && existing !== value) {
      changes.push({
        kind: 'warn',
        message: `script "${name}" differs from manifest (host: ${existing}; manifest: ${value}) — leaving host value`,
      });
    } else {
      pkg.scripts[name] = value;
      changes.push({ kind: 'add', message: `script "${name}"` });
    }
  }

  /* ---------- write ---------- */
  const willChange = changes.some((c) => c.kind === 'add' || c.kind === 'update');
  if (willChange && !ctx.dryRun) {
    const trailingNewline = text.endsWith('\n') ? '\n' : '';
    await fs.writeFile(
      host.packageJson.path,
      JSON.stringify(pkg, null, 2) + trailingNewline,
    );
  }

  return buildResult(host.packageJson.path, changes);
};
