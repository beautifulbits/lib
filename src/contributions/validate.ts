import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  discoverAllLibraries,
  hasI18nContribution,
  hasTailwindPluginContribution,
  type TDiscoveredLib,
} from './discover.js';
import {
  i18nExportNames,
  tailwindFactoryName,
} from './naming.js';

/* ========================================================================== */
/*               CONTRIBUTION VALIDATION — `lib validate-contributions`       */
/* ========================================================================== */

/**
 * Walks each library and asserts the contribution shape on disk matches
 * what `lib.cfg` declares — and vice versa. Pure string-based checks
 * (regex on source); no runtime evaluation.
 *
 * Errors gate CI. Warnings (inverse drift: dir exists on disk but cfg
 * doesn't declare it) are reported but don't fail.
 */

export type TValidationIssue = {
  kind: 'error' | 'warn';
  /** Library name. */
  lib: string;
  /** What the issue is. Short, single-line. */
  message: string;
  /** File the issue is about, if any (host-root-relative). */
  file?: string;
};

export type TValidationLibReport = {
  name: string;
  cfgPath: string;
  issues: TValidationIssue[];
};

export type TValidationResult = {
  ok: boolean;
  /** Top-level error (couldn't even start validation). */
  error?: string;
  reports: TValidationLibReport[];
  /** True when at least one report has an `error`-kind issue. */
  hasErrors: boolean;
};

export type TValidationOptions = {
  hostRoot: string;
  localLibraryPath: string;
  /** Restrict to a single library by name. */
  name?: string;
};

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

export async function runValidateContributions(
  opts: TValidationOptions,
): Promise<TValidationResult> {
  let libs: TDiscoveredLib[];
  try {
    libs = await discoverAllLibraries(opts.localLibraryPath);
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message,
      reports: [],
      hasErrors: true,
    };
  }

  if (opts.name) {
    libs = libs.filter((l) => l.cfg.name === opts.name);
    if (libs.length === 0) {
      return {
        ok: false,
        error: `No library named "${opts.name}" found.`,
        reports: [],
        hasErrors: true,
      };
    }
  }

  const reports: TValidationLibReport[] = [];
  let hasErrors = false;
  for (const lib of libs) {
    const issues = await validateLibrary(opts.hostRoot, lib);
    if (issues.some((i) => i.kind === 'error')) hasErrors = true;
    reports.push({ name: lib.cfg.name, cfgPath: lib.cfgPath, issues });
  }

  return { ok: true, reports, hasErrors };
}

/* -------------------------------------------------------------------------- */
/* Per-library validation                                                     */
/* -------------------------------------------------------------------------- */

async function validateLibrary(
  hostRoot: string,
  lib: TDiscoveredLib,
): Promise<TValidationIssue[]> {
  const issues: TValidationIssue[] = [];

  /* ========== i18n ========== */
  const declaredI18n = hasI18nContribution(lib.cfg);
  const i18nDirGuess = path.join(lib.libDir, 'i18n');
  const i18nExistsByGuess = await isDirectory(i18nDirGuess);

  if (declaredI18n) {
    const i18nDir = path.join(lib.libDir, lib.cfg.contributions!.i18n!.path);
    if (!(await isDirectory(i18nDir))) {
      issues.push({
        kind: 'error',
        lib: lib.cfg.name,
        message:
          `contributions.i18n.path "${lib.cfg.contributions!.i18n!.path}" ` +
          `does not exist on disk`,
        file: path.relative(hostRoot, i18nDir),
      });
    } else {
      await checkI18nBarrel(hostRoot, lib, i18nDir, issues);
      await checkI18nLocale(hostRoot, lib, i18nDir, 'en', issues);
      await checkI18nLocale(hostRoot, lib, i18nDir, 'es', issues);
    }
  } else if (i18nExistsByGuess) {
    issues.push({
      kind: 'warn',
      lib: lib.cfg.name,
      message:
        `i18n/ directory exists on disk but lib.cfg has no contributions.i18n ` +
        `block — run \`lib add-contribution ${lib.cfg.name}\` or remove the dir`,
      file: path.relative(hostRoot, i18nDirGuess),
    });
  }

  /* ========== tailwind plugin ========== */
  const declaredTw = hasTailwindPluginContribution(lib.cfg);
  const twDirGuess = path.join(lib.libDir, 'tailwind-plugin');
  const twExistsByGuess = await isDirectory(twDirGuess);

  if (declaredTw) {
    const twDir = path.join(
      lib.libDir,
      lib.cfg.contributions!.tailwindPlugin!.path,
    );
    if (!(await isDirectory(twDir))) {
      issues.push({
        kind: 'error',
        lib: lib.cfg.name,
        message:
          `contributions.tailwindPlugin.path "${lib.cfg.contributions!.tailwindPlugin!.path}" ` +
          `does not exist on disk`,
        file: path.relative(hostRoot, twDir),
      });
    } else {
      await checkTailwindPluginEntry(hostRoot, lib, twDir, issues);
    }
  } else if (twExistsByGuess) {
    issues.push({
      kind: 'warn',
      lib: lib.cfg.name,
      message:
        `tailwind-plugin/ directory exists on disk but lib.cfg has no ` +
        `contributions.tailwindPlugin block`,
      file: path.relative(hostRoot, twDirGuess),
    });
  }

  return issues;
}

/* -------------------------------------------------------------------------- */
/* i18n checks                                                                */
/* -------------------------------------------------------------------------- */

async function checkI18nBarrel(
  hostRoot: string,
  lib: TDiscoveredLib,
  i18nDir: string,
  issues: TValidationIssue[],
): Promise<void> {
  const barrel = await readFileIfExists(path.join(i18nDir, 'index.ts'));
  const rel = path.relative(hostRoot, path.join(i18nDir, 'index.ts'));
  if (barrel === null) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: 'i18n/index.ts barrel is missing',
      file: rel,
    });
    return;
  }
  const { en, es } = i18nExportNames(lib.cfg.name);
  if (!hasNamedExport(barrel, en)) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: `i18n/index.ts does not re-export ${en}`,
      file: rel,
    });
  }
  if (!hasNamedExport(barrel, es)) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: `i18n/index.ts does not re-export ${es}`,
      file: rel,
    });
  }
}

async function checkI18nLocale(
  hostRoot: string,
  lib: TDiscoveredLib,
  i18nDir: string,
  locale: 'en' | 'es',
  issues: TValidationIssue[],
): Promise<void> {
  const filePath = path.join(i18nDir, `${locale}.ts`);
  const rel = path.relative(hostRoot, filePath);
  const text = await readFileIfExists(filePath);
  if (text === null) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: `i18n/${locale}.ts is missing`,
      file: rel,
    });
    return;
  }
  const exportName = i18nExportNames(lib.cfg.name)[locale];
  if (!hasConstExport(text, exportName)) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: `i18n/${locale}.ts does not export const ${exportName}`,
      file: rel,
    });
  }
  // Top-level namespace key must equal cfg.name.
  if (!hasTopLevelNamespaceKey(text, lib.cfg.name)) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message:
        `i18n/${locale}.ts top-level key is not '${lib.cfg.name}' — ` +
        `every translation must be namespaced under the lib name`,
      file: rel,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* tailwind plugin checks                                                     */
/* -------------------------------------------------------------------------- */

async function checkTailwindPluginEntry(
  hostRoot: string,
  lib: TDiscoveredLib,
  twDir: string,
  issues: TValidationIssue[],
): Promise<void> {
  // Entry can be index.ts or index.js — check both.
  const tsPath = path.join(twDir, 'index.ts');
  const jsPath = path.join(twDir, 'index.js');
  let text = await readFileIfExists(tsPath);
  let entryRel = path.relative(hostRoot, tsPath);
  if (text === null) {
    text = await readFileIfExists(jsPath);
    entryRel = path.relative(hostRoot, jsPath);
  }
  if (text === null) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: 'tailwind-plugin/index.{ts,js} entry is missing',
      file: path.relative(hostRoot, twDir),
    });
    return;
  }
  const factory = tailwindFactoryName(lib.cfg.name);
  if (!hasNamedExport(text, factory) && !hasFunctionExport(text, factory)) {
    issues.push({
      kind: 'error',
      lib: lib.cfg.name,
      message: `tailwind-plugin entry does not export ${factory}`,
      file: entryRel,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Source regex helpers                                                       */
/* -------------------------------------------------------------------------- */

/** Matches `export { Foo, ... }` or `export { Foo as Bar, ... } from '...'`. */
function hasNamedExport(source: string, name: string): boolean {
  const re = new RegExp(
    `export\\s*(?:type\\s*)?\\{[^}]*\\b${escape(name)}\\b[^}]*\\}`,
    'm',
  );
  return re.test(source);
}

/** Matches `export const Foo` (with or without type annotation). */
function hasConstExport(source: string, name: string): boolean {
  const re = new RegExp(`export\\s+const\\s+${escape(name)}\\b`, 'm');
  return re.test(source);
}

/** Matches `export function Foo` (used by tailwind plugin entries). */
function hasFunctionExport(source: string, name: string): boolean {
  const re = new RegExp(`export\\s+function\\s+${escape(name)}\\b`, 'm');
  return re.test(source);
}

/**
 * Coarse check that a const literal's first object key matches `name`.
 * Looks for `export const <anything>: ... = { <name>: { ... } }` or the
 * equivalent without the type annotation. False positives possible if
 * libraries get creative with the literal — but for the convention as
 * written this catches the realistic bugs (typos, copy-paste mistakes
 * that leave the wrong namespace in place).
 */
function hasTopLevelNamespaceKey(source: string, name: string): boolean {
  // Strip block comments and line comments to avoid matching examples in jsdoc.
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const re = new RegExp(
    `export\\s+const\\s+\\w+(?:\\s*:[^=]+)?=\\s*\\{\\s*['"\`]?${escape(name)}['"\`]?\\s*:`,
    'm',
  );
  return re.test(stripped);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------------------- */
/* Filesystem helpers                                                         */
/* -------------------------------------------------------------------------- */

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

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
