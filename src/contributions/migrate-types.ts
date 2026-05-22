import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  discoverContributors,
  hasI18nContribution,
  type TDiscoveredLib,
} from './discover.js';

/* ========================================================================== */
/*               TYPES MIGRATION — `lib migrate-contribution-types`           */
/* ========================================================================== */

/**
 * One-shot migration: walks each contributing library's
 * `<libRoot>/<contributions.i18n.path>/types.ts` and, if the file matches
 * the placeholder shape, replaces its contents with a single re-export
 * line:
 *
 * ```ts
 * export type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';
 * ```
 *
 * A file is considered placeholder-shaped when it contains:
 *   - the literal `PLACEHOLDER` token (anchor — every reference scaffold
 *     ships with this comment)
 *   - both type definitions `TLibraryI18nMessages` and `TLibraryI18nNode`
 *
 * Files without the PLACEHOLDER anchor are skipped with a warning so any
 * library author who hand-customized their types isn't clobbered.
 *
 * Idempotent: a file that's already been migrated (one-line re-export, no
 * PLACEHOLDER comment) is skipped on subsequent runs.
 */

export type TMigrateOptions = {
  hostRoot: string;
  localLibraryPath: string;
  /** Restrict to a single library by name. */
  name?: string;
  /** Don't write — just report. */
  dryRun: boolean;
};

export type TMigrateChange = {
  kind: 'migrate' | 'skip-already-migrated' | 'skip-customized' | 'skip-no-types' | 'warn';
  /** Library name. */
  lib: string;
  /** Host-root-relative file path. */
  file?: string;
  message?: string;
};

export type TMigrateResult = {
  ok: boolean;
  error?: string;
  changes: TMigrateChange[];
};

const MIGRATED_BODY =
  `export type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';\n`;

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

export async function runMigrateContributionTypes(
  opts: TMigrateOptions,
): Promise<TMigrateResult> {
  let libs: TDiscoveredLib[];
  try {
    libs = await discoverContributors(opts.localLibraryPath);
  } catch (err) {
    return { ok: false, error: (err as Error).message, changes: [] };
  }
  if (opts.name) {
    libs = libs.filter((l) => l.cfg.name === opts.name);
    if (libs.length === 0) {
      return {
        ok: false,
        error: `No contributing library named "${opts.name}" found.`,
        changes: [],
      };
    }
  }

  const changes: TMigrateChange[] = [];

  for (const lib of libs) {
    if (!hasI18nContribution(lib.cfg)) continue;
    const i18nDir = path.join(lib.libDir, lib.cfg.contributions!.i18n!.path);
    const typesPath = path.join(i18nDir, 'types.ts');
    const rel = path.relative(opts.hostRoot, typesPath);

    const text = await readFileIfExists(typesPath);
    if (text === null) {
      changes.push({
        kind: 'skip-no-types',
        lib: lib.cfg.name,
        file: rel,
        message: 'no types.ts (already a single-file re-export, or not present)',
      });
      continue;
    }

    if (isAlreadyMigrated(text)) {
      changes.push({
        kind: 'skip-already-migrated',
        lib: lib.cfg.name,
        file: rel,
        message: 'already migrated',
      });
      continue;
    }

    if (!isPlaceholder(text)) {
      changes.push({
        kind: 'skip-customized',
        lib: lib.cfg.name,
        file: rel,
        message:
          'types.ts has user customizations (no PLACEHOLDER marker) — left untouched',
      });
      continue;
    }

    if (!opts.dryRun) {
      await fs.writeFile(typesPath, MIGRATED_BODY);
    }
    changes.push({
      kind: 'migrate',
      lib: lib.cfg.name,
      file: rel,
    });
  }

  return { ok: true, changes };
}

/* -------------------------------------------------------------------------- */
/* Detection                                                                  */
/* -------------------------------------------------------------------------- */

function isAlreadyMigrated(text: string): boolean {
  // Trim to handle trailing whitespace differences.
  const stripped = text.replace(/\s+/g, ' ').trim();
  return stripped.includes(
    `export type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';`,
  );
}

function isPlaceholder(text: string): boolean {
  if (!/PLACEHOLDER/i.test(text)) return false;
  if (!/\bTLibraryI18nMessages\b/.test(text)) return false;
  if (!/\bTLibraryI18nNode\b/.test(text)) return false;
  return true;
}

/* -------------------------------------------------------------------------- */

async function readFileIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
}
