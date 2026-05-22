import path from 'node:path';
import { promises as fs } from 'node:fs';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import { listSubdirectories } from '../helpers/fs.js';
import { parseLibCfg } from '../helpers/lib-cfg.js';
import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*                  CONTRIBUTING-LIBRARY DISCOVERY                            */
/* ========================================================================== */

/**
 * Scans `localLibraryPath` and returns the libraries that declare a
 * `contributions` block in their `lib.cfg`. Every contribution-related
 * command (generate-registry, validate-contributions) starts here.
 *
 * Mirrors the discovery pattern used by `host-sync/orchestrator.ts` —
 * top-level subdirectories, each with a `lib.cfg`. Libraries without a
 * `contributions` block are filtered out by `discoverContributors`; raw
 * discovery is exposed too (for `validate-contributions` to detect inverse
 * drift: an `i18n/` dir on disk with no cfg block).
 */

export type TDiscoveredLib = {
  cfg: TPackageConfig;
  cfgPath: string;
  /** Absolute path to the library directory (the dir containing lib.cfg). */
  libDir: string;
};

/**
 * All libraries with a parseable lib.cfg, sorted by name. No filtering on
 * `contributions` — caller decides.
 */
export async function discoverAllLibraries(
  localLibraryPath: string,
): Promise<TDiscoveredLib[]> {
  const subdirs = await listSubdirectories(localLibraryPath);

  const all = await Promise.all(
    subdirs.map(async (libDir): Promise<TDiscoveredLib | null> => {
      const cfgPath = path.join(libDir, LIB_CONFIG_FILENAME);
      try {
        const text = await fs.readFile(cfgPath, 'utf8');
        const cfg = parseLibCfg(text);
        return { cfg, cfgPath, libDir };
      } catch (err: unknown) {
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
    .filter((x): x is TDiscoveredLib => x !== null)
    .sort((a, b) => a.cfg.name.localeCompare(b.cfg.name));
}

/**
 * Subset of {@link discoverAllLibraries} restricted to libraries that
 * declare at least one `contributions.*` sub-block.
 */
export async function discoverContributors(
  localLibraryPath: string,
): Promise<TDiscoveredLib[]> {
  const all = await discoverAllLibraries(localLibraryPath);
  return all.filter((l) => hasAnyContribution(l.cfg));
}

export function hasAnyContribution(cfg: TPackageConfig): boolean {
  return Boolean(cfg.contributions?.i18n || cfg.contributions?.tailwindPlugin);
}

export function hasI18nContribution(cfg: TPackageConfig): boolean {
  return Boolean(cfg.contributions?.i18n);
}

export function hasTailwindPluginContribution(cfg: TPackageConfig): boolean {
  return Boolean(cfg.contributions?.tailwindPlugin);
}
