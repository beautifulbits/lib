import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import { listSubdirectories } from '../helpers/fs.js';
import { parseLibCfg } from '../helpers/lib-cfg.js';
import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*                          UPGRADE-LIB-CFG — SHARED LOGIC                    */
/* ========================================================================== */

/**
 * Walks library directories under `localLibraryPath` and adds any
 * **missing** new-format fields to each library's `lib.cfg` while leaving
 * every existing field untouched. Used to bring older `lib.cfg` files —
 * the ones written by the legacy publish flow with only the original 7
 * fields — up to a state where `lib sync` can do useful host wiring.
 *
 * Strictly additive:
 *   - existing fields (name, library, collection, version, path, date,
 *     includeFromProjectRoot, …) are preserved verbatim
 *   - new fields are inserted ONLY where absent
 *   - never deletes anything
 *   - never rewrites a field that's already present (even if "wrong")
 */

export type TUpgradeLibCfgOptions = {
  hostRoot: string;
  localLibraryPath: string;
  /** Restrict to a single library by name. */
  name?: string;
  /** Don't write — just report what would be added. */
  dryRun: boolean;
};

export type TLibUpgradeReport = {
  /** Library name (from existing lib.cfg). */
  name: string;
  /** Path to the lib.cfg file. */
  cfgPath: string;
  /** Whether anything would change. False ⇒ already up to date. */
  changed: boolean;
  /** Fields that were/would be added (top-level keys), in the order applied. */
  fieldsAdded: string[];
  /** A human-readable error if the lib.cfg couldn't be parsed. */
  error?: string;
};

export type TUpgradeLibCfgResult = {
  ok: boolean;
  error?: string;
  reports: TLibUpgradeReport[];
};

export async function runUpgradeLibCfg(
  opts: TUpgradeLibCfgOptions,
): Promise<TUpgradeLibCfgResult> {
  const { hostRoot, localLibraryPath, name, dryRun } = opts;

  const localLibBase = path.join(
    hostRoot,
    localLibraryPath.replace(/^[/\\]+/, ''),
  );

  if (!(await isDirectory(localLibBase))) {
    return {
      ok: false,
      error: `Local library directory not found at ${localLibBase}.`,
      reports: [],
    };
  }

  /* ---------- discover libraries (top-level dirs containing lib.cfg) ----- */
  const subdirs = await listSubdirectories(localLibBase);
  const libDirs: string[] = [];
  for (const dir of subdirs) {
    const cfgPath = path.join(dir, LIB_CONFIG_FILENAME);
    if (await exists(cfgPath)) libDirs.push(dir);
  }

  let targetDirs = libDirs;
  if (name) {
    targetDirs = libDirs.filter((d) => path.basename(d) === name);
    if (targetDirs.length === 0) {
      return {
        ok: false,
        error: `No library named "${name}" with a lib.cfg found under ${localLibBase}.`,
        reports: [],
      };
    }
  }

  /* ---------- per-library upgrade ---------- */
  const reports: TLibUpgradeReport[] = [];
  for (const dir of targetDirs) {
    const cfgPath = path.join(dir, LIB_CONFIG_FILENAME);
    const dirName = path.basename(dir);

    let raw: string;
    try {
      raw = await fs.readFile(cfgPath, 'utf8');
    } catch (err) {
      reports.push({
        name: dirName,
        cfgPath,
        changed: false,
        fieldsAdded: [],
        error: `Could not read lib.cfg: ${(err as Error).message}`,
      });
      continue;
    }

    let cfg: TPackageConfig;
    try {
      cfg = parseLibCfg(raw);
    } catch (err) {
      reports.push({
        name: dirName,
        cfgPath,
        changed: false,
        fieldsAdded: [],
        error: `lib.cfg parse error: ${(err as Error).message}`,
      });
      continue;
    }

    const { upgraded, fieldsAdded } = upgradeManifest(cfg, hostRoot, dir);

    if (fieldsAdded.length > 0 && !dryRun) {
      await fs.writeFile(cfgPath, JSON.stringify(upgraded, null, 2) + '\n');
    }

    reports.push({
      name: cfg.name,
      cfgPath,
      changed: fieldsAdded.length > 0,
      fieldsAdded,
    });
  }

  return { ok: true, reports };
}

/* -------------------------------------------------------------------------- */
/* Pure upgrade fn — testable in isolation                                    */
/* -------------------------------------------------------------------------- */

function upgradeManifest(
  cfg: TPackageConfig,
  hostRoot: string,
  libDir: string,
): { upgraded: TPackageConfig; fieldsAdded: string[] } {
  const fieldsAdded: string[] = [];
  const out: TPackageConfig = { ...cfg };

  // libRoot — derived from absolute lib dir relative to host root
  if (out.libRoot === undefined) {
    out.libRoot = path.relative(hostRoot, libDir).replace(/\\/g, '/');
    fieldsAdded.push('libRoot');
  }

  // alias — @<name>
  if (out.alias === undefined) {
    out.alias = `@${out.name}`;
    fieldsAdded.push('alias');
  }

  // description — placeholder so docs / CLAUDE.md refs aren't blank
  if (out.description === undefined) {
    out.description = `${capitalize(out.name)} — TODO describe this library.`;
    fieldsAdded.push('description');
  }

  // stacks — default to ['any']
  if (out.stacks === undefined) {
    out.stacks = ['any'];
    fieldsAdded.push('stacks');
  }

  // dependencies / devDependencies — empty objects so the user can fill them in
  if (out.dependencies === undefined) {
    out.dependencies = {};
    fieldsAdded.push('dependencies');
  }
  if (out.devDependencies === undefined) {
    out.devDependencies = {};
    fieldsAdded.push('devDependencies');
  }

  // typescript — { decorators: false } skeleton
  if (out.typescript === undefined) {
    out.typescript = { decorators: false };
    fieldsAdded.push('typescript');
  }

  // workflows / ai — left absent. They imply tooling decisions (ports, dirs)
  // the user should make explicitly. Adding empty stubs would be misleading.

  return { upgraded: out, fieldsAdded };
}

/* -------------------------------------------------------------------------- */

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
