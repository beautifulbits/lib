import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  discoverContributors,
  hasI18nContribution,
  hasTailwindPluginContribution,
  type TDiscoveredLib,
} from './discover.js';
import {
  i18nExportNames,
  i18nImportPath,
  tailwindFactoryName,
  tailwindImportPath,
} from './naming.js';

/* ========================================================================== */
/*               REGISTRY CODEGEN — `lib generate-registry`                   */
/* ========================================================================== */

/**
 * Reads every contributing library's `lib.cfg` and emits a single
 * TypeScript module the host application imports. The generated file is
 * the only artifact this command writes; it never touches the host's i18n
 * or tailwind config — wiring the registry into those is a one-time
 * manual edit (documented in the command's `--help`).
 *
 * Output path: `<host>/<registryDir>/registry.ts` (default
 * `src/.lib-generated`).
 *
 * Output is deterministic: libraries sorted by `cfg.name`, imports and
 * spreads in the same order. Re-running with no contribution changes
 * produces a byte-identical file.
 */

/** Default location of the generated registry, relative to host root. */
export const DEFAULT_REGISTRY_DIR = 'src/.lib-generated';
/** Default basename for the generated registry file. */
export const DEFAULT_REGISTRY_FILENAME = 'registry.ts';

export type TGenerateRegistryOptions = {
  hostRoot: string;
  /** Absolute path to the local library directory. */
  localLibraryPath: string;
  /** Defaults to `DEFAULT_REGISTRY_DIR`. */
  registryDir?: string;
  /** Defaults to `DEFAULT_REGISTRY_FILENAME`. */
  registryFilename?: string;
  /** Don't write — just compute and report. */
  dryRun: boolean;
};

export type TGenerateRegistryResult = {
  ok: boolean;
  /** Absolute path of the generated registry file. */
  registryPath: string;
  /** New file content (written or not, depending on dryRun). */
  content: string;
  /** Whether the file would change vs. what's currently on disk. */
  willChange: boolean;
  /** Whether the file did not previously exist. */
  isNew: boolean;
  /** Libraries that contributed to the registry, in emit order. */
  contributors: Array<{
    name: string;
    contributesI18n: boolean;
    contributesTailwindPlugin: boolean;
  }>;
  /** Human-readable error, if generation aborted. */
  error?: string;
};

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export async function runGenerateRegistry(
  opts: TGenerateRegistryOptions,
): Promise<TGenerateRegistryResult> {
  const registryDir = opts.registryDir ?? DEFAULT_REGISTRY_DIR;
  const registryFilename = opts.registryFilename ?? DEFAULT_REGISTRY_FILENAME;
  const registryPath = path.join(
    opts.hostRoot,
    registryDir.replace(/^[/\\]+/, ''),
    registryFilename,
  );

  let contributors: TDiscoveredLib[];
  try {
    contributors = await discoverContributors(opts.localLibraryPath);
  } catch (err) {
    return {
      ok: false,
      registryPath,
      content: '',
      willChange: false,
      isNew: false,
      contributors: [],
      error: (err as Error).message,
    };
  }

  /* ---------- collision check ---------- */
  const seen = new Map<string, string>();
  for (const c of contributors) {
    const prior = seen.get(c.cfg.name);
    if (prior) {
      return {
        ok: false,
        registryPath,
        content: '',
        willChange: false,
        isNew: false,
        contributors: [],
        error:
          `lib.cfg.name collision: '${c.cfg.name}' declared by ` +
          `${path.basename(prior)} and ${path.basename(c.libDir)}`,
      };
    }
    seen.set(c.cfg.name, c.libDir);
  }

  /* ---------- per-contribution path-on-disk validation ---------- */
  for (const { cfg, libDir } of contributors) {
    if (hasI18nContribution(cfg)) {
      const i18nDir = path.join(libDir, cfg.contributions!.i18n!.path);
      if (!(await isDirectory(i18nDir))) {
        return {
          ok: false,
          registryPath,
          content: '',
          willChange: false,
          isNew: false,
          contributors: [],
          error:
            `Library "${cfg.name}" declares contributions.i18n.path = ` +
            `"${cfg.contributions!.i18n!.path}" but ${path.relative(opts.hostRoot, i18nDir)} ` +
            `does not exist or is not a directory.`,
        };
      }
    }
    if (hasTailwindPluginContribution(cfg)) {
      const twDir = path.join(libDir, cfg.contributions!.tailwindPlugin!.path);
      if (!(await isDirectory(twDir))) {
        return {
          ok: false,
          registryPath,
          content: '',
          willChange: false,
          isNew: false,
          contributors: [],
          error:
            `Library "${cfg.name}" declares contributions.tailwindPlugin.path = ` +
            `"${cfg.contributions!.tailwindPlugin!.path}" but ${path.relative(opts.hostRoot, twDir)} ` +
            `does not exist or is not a directory.`,
        };
      }
    }
  }

  /* ---------- emit ---------- */
  const content = renderRegistry(contributors);

  let isNew = false;
  let prior: string | null = null;
  try {
    prior = await fs.readFile(registryPath, 'utf8');
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      isNew = true;
    } else {
      throw err;
    }
  }

  const willChange = isNew || prior !== content;

  if (willChange && !opts.dryRun) {
    await fs.mkdir(path.dirname(registryPath), { recursive: true });
    await fs.writeFile(registryPath, content);
  }

  return {
    ok: true,
    registryPath,
    content,
    willChange,
    isNew,
    contributors: contributors.map(({ cfg }) => ({
      name: cfg.name,
      contributesI18n: hasI18nContribution(cfg),
      contributesTailwindPlugin: hasTailwindPluginContribution(cfg),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Pure renderer                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Renders the registry source. Pure — testable in isolation.
 *
 * Output structure:
 *   1. Header comment (autogenerated marker)
 *   2. i18n imports (per-contributor, alphabetical)
 *   3. tailwind plugin imports (per-contributor, alphabetical)
 *   4. `libraryTranslationsEn` const (spread)
 *   5. `libraryTranslationsEs` const (spread)
 *   6. `libraryTailwindPlugins` const (array of factories)
 *
 * If a section has no contributors, it's emitted as an empty value with
 * the right type so the host's manual wiring continues to compile when
 * the last contributor is removed.
 */
export function renderRegistry(libs: TDiscoveredLib[]): string {
  const i18nLibs = libs.filter((l) => hasI18nContribution(l.cfg));
  const twLibs = libs.filter((l) => hasTailwindPluginContribution(l.cfg));

  const lines: string[] = [];
  lines.push('/* ========================================================================== */');
  lines.push('/*       AUTOGENERATED by `lib generate-registry` — do not edit by hand       */');
  lines.push('/* ========================================================================== */');
  lines.push('');
  lines.push('/**');
  lines.push(' * Aggregated library contributions for the host application. Re-run');
  lines.push(' * `lib generate-registry` whenever a library adds, removes, or changes its');
  lines.push(' * `contributions` block in `lib.cfg`. CI gates on `--check`.');
  lines.push(' *');
  lines.push(' * Host wiring (one-time manual edit):');
  lines.push(' *   src/i18n/<locale>/index.ts → spread `libraryTranslationsEn` / `Es` into messages');
  lines.push(' *   tailwind.config.ts        → `plugins: libraryTailwindPlugins.map((f) => f())`');
  lines.push(' */');
  lines.push('');

  /* ---------- i18n imports ---------- */
  for (const { cfg } of i18nLibs) {
    const { en, es } = i18nExportNames(cfg.name);
    lines.push(`import { ${en}, ${es} } from '${i18nImportPath(cfg)}';`);
  }
  if (i18nLibs.length > 0) lines.push('');

  /* ---------- tailwind imports ---------- */
  for (const { cfg } of twLibs) {
    const factory = tailwindFactoryName(cfg.name);
    lines.push(`import { ${factory} } from '${tailwindImportPath(cfg)}';`);
  }
  if (twLibs.length > 0) lines.push('');

  /* ---------- libraryTranslationsEn ---------- */
  lines.push('export const libraryTranslationsEn = {');
  for (const { cfg } of i18nLibs) {
    lines.push(`  ...${i18nExportNames(cfg.name).en},`);
  }
  lines.push('} as const;');
  lines.push('');

  /* ---------- libraryTranslationsEs ---------- */
  lines.push('export const libraryTranslationsEs = {');
  for (const { cfg } of i18nLibs) {
    lines.push(`  ...${i18nExportNames(cfg.name).es},`);
  }
  lines.push('} as const;');
  lines.push('');

  /* ---------- libraryTailwindPlugins ---------- */
  lines.push('export const libraryTailwindPlugins = [');
  for (const { cfg } of twLibs) {
    lines.push(`  ${tailwindFactoryName(cfg.name)},`);
  }
  lines.push('] as const;');
  lines.push('');

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
