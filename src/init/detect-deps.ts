import { promises as fs } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import { listFiles, listSubdirectories, readJsonIfExists } from '../helpers/fs.js';
import { parseLibCfg } from '../helpers/lib-cfg.js';
import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*                          DETECT-DEPS — SHARED LOGIC                        */
/* ========================================================================== */

/**
 * Scans a library's `.ts`/`.tsx` files, classifies every import, and
 * proposes additions to `lib.cfg.dependencies`, `devDependencies`, and
 * `libraryDependencies`. Strictly additive — never overwrites a
 * manually-curated entry, never deletes anything.
 *
 * Classification, per import specifier:
 *   - relative (`./x`, `../y`)         → ignored unless it escapes the
 *                                        library dir (then surfaced as
 *                                        an app-coupling warning)
 *   - Node builtin (`fs`, `node:path`) → ignored
 *   - matches a known library alias    → libraryDependencies
 *   - matches a host-level alias       → app-coupling warning (NOT added)
 *   - otherwise                        → npm package
 *
 * Npm packages are categorized by file kind:
 *   - only in `*.spec`/`*.test`/`*.stories` files → devDependencies
 *   - appears in any production source            → dependencies
 *
 * Versions for npm packages are looked up in the host's `package.json`
 * (dependencies / devDependencies / peerDependencies). Missing → `*`
 * with a warning.
 */

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type TDetectDepsOptions = {
  hostRoot: string;
  /** Project-relative path where libraries live (e.g. `/src/lib`). */
  localLibraryPath: string;
  /** Restrict to a single library by directory name. */
  name?: string;
  /** When true, don't write — just compute the report. */
  dryRun: boolean;
};

export type TDetectedNpmDep = {
  pkg: string;
  /** Resolved version (from host package.json) or `*` if unknown. */
  version: string;
  /** Whether the version had to be defaulted to `*`. */
  versionMissing: boolean;
  /** Whether the cfg already has this key (in deps OR devDeps). */
  alreadyPresent: boolean;
  /** A few example files that triggered this match. */
  examples: string[];
};

export type TAppCoupling = {
  /** Raw import specifier as written. */
  specifier: string;
  /** File the import was found in (host-relative). */
  file: string;
  /** 1-based line number where the import statement starts. */
  line: number;
  /** Short reason: 'host-alias' (e.g. `@/foo`) or 'escapes-lib' (relative ../../app). */
  reason: 'host-alias' | 'escapes-lib';
  /**
   * Suggested replacement, when one can be derived (e.g.
   * `@/lib/<known-library>/foo` → `@<known-library>/foo`). Undefined
   * when the user has to make a real decoupling decision.
   */
  suggestedFix?: string;
};

export type TDetectDepsLibraryReport = {
  /** Library name (from lib.cfg.name). */
  name: string;
  /** Path to the lib.cfg. */
  cfgPath: string;
  /** Whether anything would change. */
  changed: boolean;
  /** A human-readable error if scan failed. */
  error?: string;
  /** Number of `.ts`/`.tsx` files scanned. */
  filesScanned: number;
  /** New runtime deps that would be added. */
  addedDependencies: TDetectedNpmDep[];
  /** New dev deps that would be added. */
  addedDevDependencies: TDetectedNpmDep[];
  /** New library dependencies (other libraries this one imports from). */
  addedLibraryDependencies: string[];
  /** Existing library dependencies that were preserved (informational). */
  existingLibraryDependencies: string[];
  /** App-coupling violations — never auto-fixed, only reported. */
  appCouplings: TAppCoupling[];
};

export type TDetectDepsResult = {
  ok: boolean;
  error?: string;
  reports: TDetectDepsLibraryReport[];
};

export async function runDetectDeps(
  opts: TDetectDepsOptions,
): Promise<TDetectDepsResult> {
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

  /* ---------- discover all libraries (we always need the full registry) -- */
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
      // unparseable lib.cfg — skip from the alias registry, but it'll
      // surface as an error below if it was the target.
    }
  }

  /* ---------- alias registry: alias → library name --------------------- */
  const aliasRegistry = new Map<string, string>();
  for (const { cfg } of allLibs) {
    if (cfg.alias) aliasRegistry.set(cfg.alias, cfg.name);
  }

  /* ---------- host package.json for version lookup --------------------- */
  const hostPkgJsonPath = path.join(hostRoot, 'package.json');
  const hostPkg = await readJsonIfExists<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }>(hostPkgJsonPath);
  const hostVersions: Record<string, string> = {
    ...(hostPkg?.peerDependencies ?? {}),
    ...(hostPkg?.devDependencies ?? {}),
    ...(hostPkg?.dependencies ?? {}),
  };

  /* ---------- host tsconfig paths (best-effort host-alias detection) --- */
  const hostAliasPrefixes = await loadHostAliasPrefixes(hostRoot, aliasRegistry);

  /* ---------- choose targets ------------------------------------------- */
  let targets = allLibs;
  if (name) {
    targets = allLibs.filter((l) => path.basename(l.dir) === name);
    if (targets.length === 0) {
      return {
        ok: false,
        error: `No library named "${name}" with a lib.cfg found under ${localLibBase}.`,
        reports: [],
      };
    }
  }

  /* ---------- per-library scan ----------------------------------------- */
  const reports: TDetectDepsLibraryReport[] = [];
  for (const target of targets) {
    const report = await scanLibrary({
      target,
      hostRoot,
      aliasRegistry,
      hostVersions,
      hostAliasPrefixes,
    });

    /* write back additive merge if anything new */
    const anyAdditions =
      report.addedDependencies.length > 0 ||
      report.addedDevDependencies.length > 0 ||
      report.addedLibraryDependencies.length > 0;

    if (anyAdditions && !dryRun && !report.error) {
      await applyAdditive(target.cfgPath, target.cfg, report);
    }

    reports.push(report);
  }

  return { ok: true, reports };
}

/* -------------------------------------------------------------------------- */
/* Internal types                                                             */
/* -------------------------------------------------------------------------- */

type TDiscoveredLib = {
  dir: string;
  cfgPath: string;
  cfg: TPackageConfig;
};

type TScanArgs = {
  target: TDiscoveredLib;
  hostRoot: string;
  aliasRegistry: Map<string, string>;
  hostVersions: Record<string, string>;
  hostAliasPrefixes: string[];
};

/* -------------------------------------------------------------------------- */
/* Scan one library                                                           */
/* -------------------------------------------------------------------------- */

async function scanLibrary(args: TScanArgs): Promise<TDetectDepsLibraryReport> {
  const { target, hostRoot, aliasRegistry, hostVersions, hostAliasPrefixes } = args;
  const { dir, cfgPath, cfg } = target;

  const libName = cfg.name;
  const libDir = dir;

  /* gather files */
  const files = await listFiles({
    cwd: libDir,
    patterns: ['**/*.ts', '**/*.tsx'],
    readContent: true,
  });

  /* per-package occurrence map: pkg → { prod, dev, examples } */
  const npmOccurrences = new Map<
    string,
    { prod: boolean; dev: boolean; examples: Set<string> }
  >();
  const libraryHits = new Set<string>();
  const appCouplings: TAppCoupling[] = [];

  for (const file of files) {
    const isDevKind = isDevFile(file.fullname);
    const importRefs = extractImportSpecifiers(file.data);

    for (const ref of importRefs) {
      const { specifier, line } = ref;
      classifySpecifier({
        specifier,
        absImporter: file.fullname,
        libDir,
        hostRoot,
        aliasRegistry,
        hostAliasPrefixes,
        onLibrary: (libNameMatched) => {
          if (libNameMatched !== libName) libraryHits.add(libNameMatched);
        },
        onNpm: (pkg) => {
          let entry = npmOccurrences.get(pkg);
          if (!entry) {
            entry = { prod: false, dev: false, examples: new Set() };
            npmOccurrences.set(pkg, entry);
          }
          if (isDevKind) entry.dev = true;
          else entry.prod = true;
          if (entry.examples.size < 3) {
            entry.examples.add(
              path.relative(hostRoot, file.fullname).replace(/\\/g, '/'),
            );
          }
        },
        onAppCoupling: (reason) => {
          appCouplings.push({
            specifier,
            file: path
              .relative(hostRoot, file.fullname)
              .replace(/\\/g, '/'),
            line,
            reason,
            suggestedFix: deriveSuggestedFix(specifier, aliasRegistry),
          });
        },
      });
    }
  }

  /* dedupe app couplings (specifier+file is unique enough) */
  const dedupedCouplings = dedupeAppCouplings(appCouplings);

  /* additive merge — produce only ADDITIONS */
  const existingDeps = cfg.dependencies ?? {};
  const existingDevDeps = cfg.devDependencies ?? {};
  const existingLibDeps = cfg.libraryDependencies ?? [];
  const existingLibDepsSet = new Set(existingLibDeps);

  const addedDependencies: TDetectedNpmDep[] = [];
  const addedDevDependencies: TDetectedNpmDep[] = [];

  for (const [pkg, occ] of npmOccurrences) {
    const targetSection: 'dep' | 'dev' = occ.prod ? 'dep' : 'dev';
    const alreadyPresent =
      Object.prototype.hasOwnProperty.call(existingDeps, pkg) ||
      Object.prototype.hasOwnProperty.call(existingDevDeps, pkg);

    if (alreadyPresent) continue; // strictly additive

    const versionFromHost = hostVersions[pkg];
    const detected: TDetectedNpmDep = {
      pkg,
      version: versionFromHost ?? '*',
      versionMissing: !versionFromHost,
      alreadyPresent: false,
      examples: Array.from(occ.examples),
    };

    if (targetSection === 'dep') addedDependencies.push(detected);
    else addedDevDependencies.push(detected);
  }

  /* libraryDependencies — preserve existing order, append new */
  const addedLibraryDependencies: string[] = [];
  for (const hit of libraryHits) {
    if (!existingLibDepsSet.has(hit)) addedLibraryDependencies.push(hit);
  }
  addedLibraryDependencies.sort();

  /* deterministic sort for reporting */
  addedDependencies.sort((a, b) => a.pkg.localeCompare(b.pkg));
  addedDevDependencies.sort((a, b) => a.pkg.localeCompare(b.pkg));

  const changed =
    addedDependencies.length > 0 ||
    addedDevDependencies.length > 0 ||
    addedLibraryDependencies.length > 0;

  return {
    name: libName,
    cfgPath,
    changed,
    filesScanned: files.length,
    addedDependencies,
    addedDevDependencies,
    addedLibraryDependencies,
    existingLibraryDependencies: [...existingLibDeps],
    appCouplings: dedupedCouplings,
  };
}

/* -------------------------------------------------------------------------- */
/* Apply additive write to lib.cfg                                            */
/* -------------------------------------------------------------------------- */

async function applyAdditive(
  cfgPath: string,
  cfg: TPackageConfig,
  report: TDetectDepsLibraryReport,
): Promise<void> {
  const out: TPackageConfig = { ...cfg };

  if (report.addedDependencies.length > 0) {
    const next = { ...(out.dependencies ?? {}) };
    for (const d of report.addedDependencies) {
      if (!Object.prototype.hasOwnProperty.call(next, d.pkg)) {
        next[d.pkg] = d.version;
      }
    }
    out.dependencies = sortKeys(next);
  } else if (out.dependencies === undefined) {
    out.dependencies = {};
  }

  if (report.addedDevDependencies.length > 0) {
    const next = { ...(out.devDependencies ?? {}) };
    for (const d of report.addedDevDependencies) {
      if (!Object.prototype.hasOwnProperty.call(next, d.pkg)) {
        next[d.pkg] = d.version;
      }
    }
    out.devDependencies = sortKeys(next);
  } else if (out.devDependencies === undefined) {
    out.devDependencies = {};
  }

  if (report.addedLibraryDependencies.length > 0) {
    const existing = out.libraryDependencies ?? [];
    const merged = [...existing];
    for (const entry of report.addedLibraryDependencies) {
      if (!merged.includes(entry)) merged.push(entry);
    }
    out.libraryDependencies = merged;
  } else if (out.libraryDependencies === undefined) {
    out.libraryDependencies = [];
  }

  await fs.writeFile(cfgPath, JSON.stringify(out, null, 2) + '\n');
}

/* -------------------------------------------------------------------------- */
/* Import-specifier extraction                                                */
/* -------------------------------------------------------------------------- */

/**
 * Imports/exports with a `from` clause. The body between the keyword and
 * `from` is constrained: NO statement-terminator (`;`), NO quote chars
 * (`'`, `"`, `` ` ``) — so the engine can't span across unrelated code
 * to find a stray `from "..."` inside a docstring/template literal.
 */
const STATIC_IMPORT_FROM_RE =
  /(?:^|[\n;])\s*import\s+(?:[^;'"`]*?\s+)?from\s+['"]([^'"]+)['"]/g;
const STATIC_EXPORT_FROM_RE =
  /(?:^|[\n;])\s*export\s+(?:[^;'"`]*?\s+)?from\s+['"]([^'"]+)['"]/g;
/** Side-effect import: `import 'foo';` (no from-clause). */
const SIDE_EFFECT_IMPORT_RE = /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export type TImportRef = {
  specifier: string;
  /** 1-based line number where the regex matched. */
  line: number;
};

export function extractImportSpecifiers(source: string): TImportRef[] {
  const cleaned = stripComments(source);
  const out: TImportRef[] = [];
  for (const re of [
    STATIC_IMPORT_FROM_RE,
    STATIC_EXPORT_FROM_RE,
    SIDE_EFFECT_IMPORT_RE,
    DYNAMIC_IMPORT_RE,
    REQUIRE_RE,
  ]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      out.push({ specifier: m[1], line: lineFromIndex(cleaned, m.index) });
    }
  }
  return out;
}

/**
 * Strip comments while preserving newlines so that downstream line-number
 * calculations stay accurate. Block comments are replaced with spaces (and
 * preserved newlines). Line comments are replaced with empty (the trailing
 * `\n` is left in place by the regex's negative match for `\n`).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function lineFromIndex(src: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) {
    if (src.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/* -------------------------------------------------------------------------- */
/* Classification                                                             */
/* -------------------------------------------------------------------------- */

const NODE_BUILTINS = new Set<string>(builtinModules);

type TClassifyArgs = {
  specifier: string;
  absImporter: string;
  libDir: string;
  hostRoot: string;
  aliasRegistry: Map<string, string>;
  hostAliasPrefixes: string[];
  onLibrary: (libName: string) => void;
  onNpm: (pkgName: string) => void;
  onAppCoupling: (reason: 'host-alias' | 'escapes-lib') => void;
};

function classifySpecifier(args: TClassifyArgs): void {
  const {
    specifier,
    absImporter,
    libDir,
    aliasRegistry,
    hostAliasPrefixes,
    onLibrary,
    onNpm,
    onAppCoupling,
  } = args;

  /* relative imports → check for app coupling (escaping library dir) */
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(absImporter), specifier);
    const insideLib =
      resolved === libDir || resolved.startsWith(libDir + path.sep);
    if (!insideLib) onAppCoupling('escapes-lib');
    return;
  }

  /* virtual modules: node:fs, astro:content, bun:test — ignore */
  if (/^[a-z][a-z0-9]*:/i.test(specifier)) return;
  const head = specifier.split('/')[0];
  if (NODE_BUILTINS.has(head)) return;

  /* known library alias */
  for (const [alias, libName] of aliasRegistry) {
    if (specifier === alias || specifier.startsWith(alias + '/')) {
      onLibrary(libName);
      return;
    }
  }

  /* host-level alias (e.g. `@/...`, `~/...`, or any tsconfig alias not a lib) */
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    onAppCoupling('host-alias');
    return;
  }
  for (const prefix of hostAliasPrefixes) {
    if (specifier === prefix || specifier.startsWith(prefix + '/')) {
      onAppCoupling('host-alias');
      return;
    }
  }

  /* otherwise → npm package */
  onNpm(normalizePackageName(specifier));
}

export function normalizePackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return parts[0];
  }
  return specifier.split('/')[0];
}

/* -------------------------------------------------------------------------- */
/* File-kind                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A file is "dev" — only relevant to test/storybook tooling — when its
 * basename uses a (.|_)(spec|test|stories) suffix, or it sits in a
 * `__tests__` / `__mocks__` directory. Both `.spec.tsx` and `_spec.tsx`
 * are common conventions in this codebase; we accept either.
 */
const DEV_FILE_RE =
  /([._](spec|test|stories)\.tsx?$|\.stories\.mdx$|[/\\]__tests__[/\\]|[/\\]__mocks__[/\\])/;

export function isDevFile(absPath: string): boolean {
  return DEV_FILE_RE.test(absPath);
}

/* -------------------------------------------------------------------------- */
/* Host-alias loading (best-effort tsconfig paths inspection)                 */
/* -------------------------------------------------------------------------- */

async function loadHostAliasPrefixes(
  hostRoot: string,
  libAliasRegistry: Map<string, string>,
): Promise<string[]> {
  const tsconfigPath = path.join(hostRoot, 'tsconfig.json');
  let raw: string;
  try {
    raw = await fs.readFile(tsconfigPath, 'utf8');
  } catch {
    return [];
  }

  let parsed: { compilerOptions?: { paths?: Record<string, unknown> } };
  try {
    // Strip JSON-with-comments — tsconfig allows // and /* */ comments.
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    parsed = JSON.parse(stripped);
  } catch {
    return [];
  }

  const paths = parsed.compilerOptions?.paths ?? {};
  const out: string[] = [];
  for (const key of Object.keys(paths)) {
    /* normalize the key: drop trailing /* — `@/*` → `@` */
    const normalized = key.replace(/\/\*$/, '');
    if (!normalized) continue;
    /* if it's a registered library alias, skip — that's a library import */
    if (libAliasRegistry.has(normalized)) continue;
    out.push(normalized);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function dedupeAppCouplings(items: TAppCoupling[]): TAppCoupling[] {
  const seen = new Set<string>();
  const out: TAppCoupling[] = [];
  for (const item of items) {
    const key = `${item.reason}::${item.specifier}::${item.file}::${item.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Derive a canonical-alias replacement when the host-style alias maps
 * onto a known library. e.g. `@/lib/schematic/types/foo` →
 * `@schematic/types/foo` if `@schematic` is a registered library alias.
 *
 * Returns undefined when no mechanical fix is obvious — the user has to
 * make a real decoupling decision.
 */
function deriveSuggestedFix(
  specifier: string,
  aliasRegistry: Map<string, string>,
): string | undefined {
  /* Match `@/lib/<libName>/<rest>` or `~/lib/<libName>/<rest>` */
  const m = specifier.match(/^[@~]\/lib\/([^/]+)(\/.*)?$/);
  if (!m) return undefined;
  const libName = m[1];
  const rest = m[2] ?? '';
  /* Find the registered alias whose name matches libName */
  for (const [alias, registeredName] of aliasRegistry) {
    if (registeredName === libName) {
      return `${alias}${rest}`;
    }
  }
  return undefined;
}

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, T> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

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
