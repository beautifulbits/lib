import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import { listSubdirectories, readJsonIfExists } from '../helpers/fs.js';
import { parseLibCfg } from '../helpers/lib-cfg.js';
import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*                          INSTALL-DEPS — SHARED LOGIC                       */
/* ========================================================================== */

/**
 * Diffs each library's `lib.cfg` against the host's `package.json` and
 * (optionally) installs the gap. Three pieces of work per library:
 *
 *   1. npm `dependencies`     — entries in lib.cfg.dependencies that
 *                               aren't already in host package.json
 *                               (deps OR devDeps).
 *   2. npm `devDependencies`  — same, into host devDeps.
 *   3. `libraryDependencies`  — sibling libraries declared but not yet
 *                               present under `localLibraryPath`. Never
 *                               auto-installed (cross-library install is
 *                               an architectural decision, not a
 *                               mechanical one). Surfaces a suggested
 *                               `lib install <name>` command per missing
 *                               sibling.
 *
 * Strictly additive: never overwrites a host version, never downgrades,
 * never removes anything. Re-running with no drift is a no-op.
 */

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export type TPackageManager = 'yarn' | 'npm' | 'pnpm';

export type TInstallDepsOptions = {
  hostRoot: string;
  /** Project-relative path where libraries live (e.g. `/src/lib`). */
  localLibraryPath: string;
  /** Restrict to a single library by directory name. */
  name?: string;
  /** When true, actually run install commands. Otherwise report-only. */
  apply: boolean;
  /**
   * Force a specific package manager. When omitted, auto-detected from
   * the host's lockfile (`yarn.lock` → yarn, `package-lock.json` → npm,
   * `pnpm-lock.yaml` → pnpm; default `npm` if none found).
   */
  manager?: TPackageManager;
};

export type TMissingNpmDep = {
  pkg: string;
  /** Version string from `lib.cfg`. May be `'*'` if no version was known. */
  version: string;
  /** Whether this lands in dev or prod section. */
  kind: 'dep' | 'dev';
};

export type TMissingLibrarySibling = {
  /** Sibling library name (the `lib.cfg.name` value). */
  name: string;
  /**
   * The remote-library install command we'd suggest. The actual remote
   * collection/path is unknown without the remote registry, so this
   * is just a stub the user runs interactively.
   */
  suggestion: string;
};

export type TInstallDepsLibraryReport = {
  name: string;
  cfgPath: string;
  /** Truthy when at least one piece of work is needed. */
  changed: boolean;
  missingNpmDeps: TMissingNpmDep[];
  missingLibrarySiblings: TMissingLibrarySibling[];
  /** Human-readable error if the lib.cfg couldn't be parsed/read. */
  error?: string;
  /**
   * Captured stdout/stderr from the install command, when --apply runs
   * one. Empty when no install was needed or when in report-only mode.
   */
  installLog?: string;
  /** Exit code from the install process. Undefined when no install ran. */
  installExitCode?: number;
};

export type TInstallDepsResult = {
  ok: boolean;
  error?: string;
  manager: TPackageManager;
  reports: TInstallDepsLibraryReport[];
};

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export async function runInstallDeps(
  opts: TInstallDepsOptions,
): Promise<TInstallDepsResult> {
  const { hostRoot, localLibraryPath, name, apply } = opts;

  const localLibBase = path.join(
    hostRoot,
    localLibraryPath.replace(/^[/\\]+/, ''),
  );

  const manager = opts.manager ?? (await detectPackageManager(hostRoot));

  if (!(await isDirectory(localLibBase))) {
    return {
      ok: false,
      error: `Local library directory not found at ${localLibBase}.`,
      manager,
      reports: [],
    };
  }

  /* ---------- discover libraries ---------- */
  const subdirs = await listSubdirectories(localLibBase);
  const allLibs: TDiscoveredLib[] = [];
  for (const dir of subdirs) {
    const cfgPath = path.join(dir, LIB_CONFIG_FILENAME);
    if (!(await exists(cfgPath))) continue;
    try {
      const raw = await fs.readFile(cfgPath, 'utf8');
      const cfg = parseLibCfg(raw);
      allLibs.push({ dir, cfgPath, cfg });
    } catch {
      // skip — bad cfg surfaces as an error if it's the target.
    }
  }

  const knownLibraryNames = new Set(allLibs.map((l) => l.cfg.name));

  /* ---------- targets ---------- */
  let targets = allLibs;
  if (name) {
    targets = allLibs.filter((l) => path.basename(l.dir) === name);
    if (targets.length === 0) {
      return {
        ok: false,
        error: `No library named "${name}" with a lib.cfg found under ${localLibBase}.`,
        manager,
        reports: [],
      };
    }
  }

  /* ---------- host package.json ---------- */
  const hostPkgJsonPath = path.join(hostRoot, 'package.json');
  const hostPkg = await readJsonIfExists<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }>(hostPkgJsonPath);

  if (!hostPkg) {
    return {
      ok: false,
      error: `Host has no package.json at ${hostPkgJsonPath}.`,
      manager,
      reports: [],
    };
  }

  const hostDeclared = new Set([
    ...Object.keys(hostPkg.dependencies ?? {}),
    ...Object.keys(hostPkg.devDependencies ?? {}),
    ...Object.keys(hostPkg.peerDependencies ?? {}),
  ]);

  /* ---------- per-library work ---------- */
  const reports: TInstallDepsLibraryReport[] = [];
  for (const target of targets) {
    const report = analyzeLibrary(target, hostDeclared, knownLibraryNames);

    if (apply && report.changed && report.missingNpmDeps.length > 0) {
      const result = await runInstall(
        hostRoot,
        manager,
        report.missingNpmDeps,
      );
      report.installLog = result.log;
      report.installExitCode = result.exitCode;
    }

    reports.push(report);
  }

  return { ok: true, manager, reports };
}

/* -------------------------------------------------------------------------- */
/* Internal types                                                             */
/* -------------------------------------------------------------------------- */

type TDiscoveredLib = {
  dir: string;
  cfgPath: string;
  cfg: TPackageConfig;
};

/* -------------------------------------------------------------------------- */
/* Per-library analysis                                                       */
/* -------------------------------------------------------------------------- */

function analyzeLibrary(
  target: TDiscoveredLib,
  hostDeclared: Set<string>,
  knownLibraryNames: Set<string>,
): TInstallDepsLibraryReport {
  const { cfg, cfgPath } = target;

  const missingNpmDeps: TMissingNpmDep[] = [];
  for (const [pkg, version] of Object.entries(cfg.dependencies ?? {})) {
    if (!hostDeclared.has(pkg)) {
      missingNpmDeps.push({ pkg, version, kind: 'dep' });
    }
  }
  for (const [pkg, version] of Object.entries(cfg.devDependencies ?? {})) {
    if (!hostDeclared.has(pkg)) {
      missingNpmDeps.push({ pkg, version, kind: 'dev' });
    }
  }
  missingNpmDeps.sort((a, b) => a.pkg.localeCompare(b.pkg));

  const missingLibrarySiblings: TMissingLibrarySibling[] = [];
  for (const sibling of cfg.libraryDependencies ?? []) {
    if (!knownLibraryNames.has(sibling)) {
      missingLibrarySiblings.push({
        name: sibling,
        suggestion: `lib install ${sibling}`,
      });
    }
  }

  const changed =
    missingNpmDeps.length > 0 || missingLibrarySiblings.length > 0;

  return {
    name: cfg.name,
    cfgPath,
    changed,
    missingNpmDeps,
    missingLibrarySiblings,
  };
}

/* -------------------------------------------------------------------------- */
/* Package manager detection + install runner                                 */
/* -------------------------------------------------------------------------- */

export async function detectPackageManager(
  hostRoot: string,
): Promise<TPackageManager> {
  if (await exists(path.join(hostRoot, 'yarn.lock'))) return 'yarn';
  if (await exists(path.join(hostRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await exists(path.join(hostRoot, 'package-lock.json'))) return 'npm';
  return 'npm';
}

type TInstallRunResult = {
  log: string;
  exitCode: number;
};

async function runInstall(
  hostRoot: string,
  manager: TPackageManager,
  missing: TMissingNpmDep[],
): Promise<TInstallRunResult> {
  const prod = missing.filter((m) => m.kind === 'dep');
  const dev = missing.filter((m) => m.kind === 'dev');

  let combinedLog = '';
  let lastExitCode = 0;

  if (prod.length > 0) {
    const args = buildAddArgs(manager, prod, false);
    const result = await spawnCmd(hostRoot, args.cmd, args.args);
    combinedLog += result.log;
    lastExitCode = result.exitCode;
    if (result.exitCode !== 0) return { log: combinedLog, exitCode: result.exitCode };
  }

  if (dev.length > 0) {
    const args = buildAddArgs(manager, dev, true);
    const result = await spawnCmd(hostRoot, args.cmd, args.args);
    combinedLog += result.log;
    lastExitCode = result.exitCode;
  }

  return { log: combinedLog, exitCode: lastExitCode };
}

function buildAddArgs(
  manager: TPackageManager,
  pkgs: TMissingNpmDep[],
  dev: boolean,
): { cmd: string; args: string[] } {
  /**
   * Pin to the version string from lib.cfg by appending `@<version>` to
   * each package name. `*` becomes the literal `<pkg>@*` which yarn/npm/
   * pnpm interpret as "latest matching anything" — close enough.
   */
  const pinned = pkgs.map(({ pkg, version }) => `${pkg}@${version}`);

  switch (manager) {
    case 'yarn':
      return { cmd: 'yarn', args: ['add', ...(dev ? ['-D'] : []), ...pinned] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['add', ...(dev ? ['-D'] : []), ...pinned] };
    case 'npm':
    default:
      return {
        cmd: 'npm',
        args: ['install', dev ? '--save-dev' : '--save', ...pinned],
      };
  }
}

function spawnCmd(
  cwd: string,
  cmd: string,
  args: string[],
): Promise<TInstallRunResult> {
  return new Promise((resolve) => {
    let log = `$ ${cmd} ${args.join(' ')}\n`;
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      log += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      log += chunk.toString();
    });
    child.on('error', (err) => {
      log += `\n[spawn error] ${err.message}\n`;
      resolve({ log, exitCode: 1 });
    });
    child.on('close', (code) => {
      resolve({ log, exitCode: code ?? 0 });
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
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
