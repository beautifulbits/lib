import path from 'node:path';
import { promises as fs } from 'node:fs';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import { listSubdirectories } from '../helpers/fs.js';
import {
  normalizeLibCfg,
  parseLibCfg,
  type TNormalizedLibCfg,
} from '../helpers/lib-cfg.js';
import { detectHost } from './detect-host.js';
import { patchClaudeMd } from './patchers/claude-md.js';
import { patchJestConfig } from './patchers/jest-config.js';
import { patchJestDefaults } from './patchers/jest-defaults.js';
import { patchNextConfig } from './patchers/next-config.js';
import { patchPackageJson } from './patchers/package-json.js';
import { patchStorybookDefaults } from './patchers/storybook-defaults.js';
import { patchTsconfig } from './patchers/tsconfig.js';
import { readProjectIdentity } from '../helpers/project-identity.js';
import type { UsageRegistry } from '../usage-registry/index.js';
import type {
  TChangeEntry,
  TDefaultPatcher,
  THostDetection,
  TPatchContext,
  TPatcher,
  TPatchResult,
} from './types.js';

/* ========================================================================== */
/*                            HOST-SYNC ORCHESTRATOR                          */
/* ========================================================================== */

/**
 * Composes all patchers and runs them per library against a host project.
 * Modes:
 *   - `apply`     — write changes
 *   - `dry-run`   — report what would change, write nothing
 *   - `check`     — dry-run + non-zero exit if anything would change
 *
 * Library discovery: top-level subdirectories of `localLibraryPath`, each
 * containing a `lib.cfg`. Libraries that don't have the new host-wiring
 * fields populated will produce mostly-empty results — they're not
 * skipped, just no-ops.
 */

/* -------------------------------------------------------------------------- */
/* Patcher registry                                                           */
/* -------------------------------------------------------------------------- */

export type TLibraryPatcherEntry = {
  /** Display name for the report (e.g. "package.json"). */
  name: string;
  /** Per-library patcher function. */
  fn: TPatcher;
};

export type TDefaultPatcherEntry = {
  name: string;
  fn: TDefaultPatcher;
};

export const LIBRARY_PATCHERS: readonly TLibraryPatcherEntry[] = [
  { name: 'package.json', fn: patchPackageJson },
  { name: 'tsconfig.json', fn: patchTsconfig },
  { name: 'next.config', fn: patchNextConfig },
  { name: 'jest.config', fn: patchJestConfig },
  { name: 'CLAUDE.md', fn: patchClaudeMd },
] as const;

export const DEFAULT_PATCHERS: readonly TDefaultPatcherEntry[] = [
  { name: 'jest defaults', fn: patchJestDefaults },
  { name: 'storybook defaults', fn: patchStorybookDefaults },
] as const;

/* -------------------------------------------------------------------------- */
/* Run options + report types                                                 */
/* -------------------------------------------------------------------------- */

export type TSyncRunOptions = {
  /** Absolute path to host project root. */
  hostRoot: string;
  /** Absolute path to the local library directory (e.g. `<host>/src/lib`). */
  localLibraryPath: string;
  /** Restrict to a single library by `cfg.name`. */
  libraryFilter?: string;
  /** Don't write anything. */
  dryRun: boolean;
  /**
   * Optional usage registry. If provided and not in dry-run, sync records
   * the host's currently-installed library set after a successful pass.
   */
  usageRegistry?: UsageRegistry;
};

export type TLibraryRunReport = {
  name: string;
  cfgPath: string;
  results: Array<TPatchResult & { patcher: string }>;
};

export type TDefaultRunReport = {
  results: Array<TPatchResult & { patcher: string }>;
};

export type TSyncReport = {
  hostRoot: string;
  host: THostDetection;
  dryRun: boolean;
  libraries: TLibraryRunReport[];
  defaults: TDefaultRunReport;
  totals: {
    librariesProcessed: number;
    librariesMissingCfg: number;
    changes: number;
    warnings: number;
    skips: number;
  };
};

/* -------------------------------------------------------------------------- */
/* Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

export async function runSync(opts: TSyncRunOptions): Promise<TSyncReport> {
  const host = await detectHost(opts.hostRoot);

  if (!host.packageJson) {
    throw new Error(
      `Host has no package.json at ${opts.hostRoot} — refusing to sync.`,
    );
  }

  const libraries = await discoverLibraries(opts.localLibraryPath);

  const filtered = opts.libraryFilter
    ? libraries.filter((l) => l.cfg.name === opts.libraryFilter)
    : libraries;

  if (opts.libraryFilter && filtered.length === 0) {
    throw new Error(
      `No library named "${opts.libraryFilter}" found under ${opts.localLibraryPath}.`,
    );
  }

  const report: TSyncReport = {
    hostRoot: opts.hostRoot,
    host,
    dryRun: opts.dryRun,
    libraries: [],
    defaults: { results: [] },
    totals: {
      librariesProcessed: 0,
      librariesMissingCfg: 0,
      changes: 0,
      warnings: 0,
      skips: 0,
    },
  };

  /* ---------- Build set of known library names for libraryDependencies check */
  const knownLibraryNames = new Set(libraries.map((l) => l.cfg.name));

  /* ---------- Per-library patchers ---------- */
  for (const { cfg, cfgPath } of filtered) {
    const ctx: TPatchContext = {
      hostRoot: opts.hostRoot,
      manifest: cfg,
      dryRun: opts.dryRun,
    };

    const libReport: TLibraryRunReport = {
      name: cfg.name,
      cfgPath,
      results: [],
    };

    for (const { name, fn } of LIBRARY_PATCHERS) {
      const result = await fn(ctx, host);
      libReport.results.push({ patcher: name, ...result });
      if (result.changed) report.totals.changes++;
      for (const c of result.changes) {
        if (c.kind === 'warn') report.totals.warnings++;
        if (c.kind === 'skip') report.totals.skips++;
      }
    }

    /* libraryDependencies sanity check — warn (don't fail) on any missing entry */
    const libDepsResult = checkLibraryDependencies(cfg, knownLibraryNames);
    libReport.results.push({ patcher: 'library-deps', ...libDepsResult });
    for (const c of libDepsResult.changes) {
      if (c.kind === 'warn') report.totals.warnings++;
      if (c.kind === 'skip') report.totals.skips++;
    }

    report.libraries.push(libReport);
    report.totals.librariesProcessed++;
  }

  /* ---------- Tool-wide default patchers (once per sync) ---------- */
  // Skip when filtering to a single library — the defaults aren't owned by
  // any single library and would feel weird being re-applied for one of them.
  // Run only on a full sync.
  if (!opts.libraryFilter) {
    const defaultCtx = {
      hostRoot: opts.hostRoot,
      dryRun: opts.dryRun,
    };
    for (const { name, fn } of DEFAULT_PATCHERS) {
      const result = await fn(defaultCtx, host);
      report.defaults.results.push({ patcher: name, ...result });
      if (result.changed) report.totals.changes++;
      for (const c of result.changes) {
        if (c.kind === 'warn') report.totals.warnings++;
        if (c.kind === 'skip') report.totals.skips++;
      }
    }
  }

  /* ---------- Usage registry (only on apply, never in dry-run) ---------- */
  if (opts.usageRegistry && !opts.dryRun) {
    try {
      const identity = await readProjectIdentity(opts.hostRoot);
      await opts.usageRegistry.recordSync({
        projectName: identity.name,
        projectPath: identity.path,
        libraries: filtered.map(({ cfg }) => ({
          name: cfg.name,
          version: cfg.version,
        })),
      });
    } catch (err) {
      // Registry update is best-effort — never fail the sync because of it.
      // Print a one-line warning so the user knows.
      console.warn(
        `usage registry update skipped: ${(err as Error).message}`,
      );
    }
  }

  return report;
}

/* -------------------------------------------------------------------------- */
/* libraryDependencies check                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Validates each entry in `cfg.libraryDependencies` against the set of
 * library names actually present under `localLibraryPath`. Missing
 * entries surface as warnings — sync never fails on this, since the
 * host might be partially set up.
 */
function checkLibraryDependencies(
  cfg: TNormalizedLibCfg,
  knownLibraryNames: Set<string>,
): TPatchResult {
  const declared = cfg.libraryDependencies ?? [];
  if (declared.length === 0) {
    return { file: null, changed: false, changes: [] };
  }

  const changes: TChangeEntry[] = [];
  for (const dep of declared) {
    if (!knownLibraryNames.has(dep)) {
      changes.push({
        kind: 'warn',
        message:
          `libraryDependencies entry "${dep}" is not present under ` +
          `the local library path — the host may be partially set up.`,
      });
    }
  }
  return { file: null, changed: false, changes };
}

/* -------------------------------------------------------------------------- */
/* Library discovery                                                          */
/* -------------------------------------------------------------------------- */

type TDiscoveredLibrary = {
  cfg: TNormalizedLibCfg;
  cfgPath: string;
};

async function discoverLibraries(
  localLibraryPath: string,
): Promise<TDiscoveredLibrary[]> {
  const subdirs = await listSubdirectories(localLibraryPath);

  const all = await Promise.all(
    subdirs.map(async (dir): Promise<TDiscoveredLibrary | null> => {
      const cfgPath = path.join(dir, LIB_CONFIG_FILENAME);
      try {
        const text = await fs.readFile(cfgPath, 'utf8');
        const raw = parseLibCfg(text);
        return { cfg: normalizeLibCfg(raw), cfgPath };
      } catch (err: unknown) {
        // Quiet skip if cfg is absent; bubble actual parse errors with context.
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'ENOENT'
        ) {
          return null;
        }
        throw new Error(
          `Failed to parse ${cfgPath}: ${(err as Error).message}`,
        );
      }
    }),
  );

  return all
    .filter((x): x is TDiscoveredLibrary => x !== null)
    .sort((a, b) => a.cfg.name.localeCompare(b.cfg.name));
}
