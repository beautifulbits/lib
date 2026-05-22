import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import {
  i18nExportNames,
  pascalCase,
  tailwindFactoryName,
  tailwindOptionsTypeName,
} from './naming.js';
import type { TPackageConfig } from '../@types/package-config.js';
import { parseLibCfg } from '../helpers/lib-cfg.js';

/* ========================================================================== */
/*                  CONTRIBUTION SCAFFOLDING — `lib add-contribution`         */
/* ========================================================================== */

/**
 * Idempotently scaffolds a library's contribution files (`i18n/`, optionally
 * `tailwind-plugin/`) and updates `lib.cfg` with the matching
 * `contributions` block.
 *
 * Strictly additive:
 *   - existing files are NOT overwritten — emit a `skip` report entry
 *   - existing cfg fields are NOT overwritten — only missing keys are added
 *
 * Output mirrors the schematic and tectonic reference shapes in workbench-ui.
 */

export type TScaffoldOptions = {
  /** Absolute path to the library directory (the dir containing lib.cfg). */
  libDir: string;
  /** Whether to scaffold the tailwind plugin entry as well. */
  withTailwindPlugin: boolean;
  /** Don't write — just report what would happen. */
  dryRun: boolean;
};

export type TScaffoldChange = {
  kind: 'add' | 'skip' | 'warn';
  /** Library-root-relative path. */
  file: string;
  message?: string;
};

export type TScaffoldResult = {
  ok: boolean;
  error?: string;
  /** Library name (from lib.cfg). */
  name: string;
  /** Per-file/per-cfg changes, in order. */
  changes: TScaffoldChange[];
};

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

export async function runAddContribution(
  opts: TScaffoldOptions,
): Promise<TScaffoldResult> {
  const cfgPath = path.join(opts.libDir, LIB_CONFIG_FILENAME);
  let raw: string;
  try {
    raw = await fs.readFile(cfgPath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      name: path.basename(opts.libDir),
      error: `Could not read ${cfgPath}: ${(err as Error).message}`,
      changes: [],
    };
  }

  let cfg: TPackageConfig;
  try {
    cfg = parseLibCfg(raw);
  } catch (err) {
    return {
      ok: false,
      name: path.basename(opts.libDir),
      error: `lib.cfg parse error: ${(err as Error).message}`,
      changes: [],
    };
  }

  const changes: TScaffoldChange[] = [];

  /* ---------- i18n scaffold ---------- */
  await scaffoldI18n(opts.libDir, cfg, opts.dryRun, changes);

  /* ---------- tailwind plugin scaffold (optional) ---------- */
  if (opts.withTailwindPlugin) {
    await scaffoldTailwindPlugin(opts.libDir, cfg, opts.dryRun, changes);
  }

  /* ---------- update lib.cfg ---------- */
  await updateLibCfg(
    cfgPath,
    raw,
    opts.withTailwindPlugin,
    opts.dryRun,
    changes,
  );

  return { ok: true, name: cfg.name, changes };
}

/* -------------------------------------------------------------------------- */
/* i18n templates                                                             */
/* -------------------------------------------------------------------------- */

async function scaffoldI18n(
  libDir: string,
  cfg: TPackageConfig,
  dryRun: boolean,
  changes: TScaffoldChange[],
): Promise<void> {
  const i18nDir = path.join(libDir, 'i18n');
  const files: Array<{ name: string; content: string }> = [
    { name: 'types.ts', content: i18nTypesTemplate(cfg.name) },
    { name: 'en.ts', content: i18nLocaleTemplate(cfg.name, 'En') },
    { name: 'es.ts', content: i18nLocaleTemplate(cfg.name, 'Es') },
    { name: 'index.ts', content: i18nBarrelTemplate(cfg.name) },
  ];

  if (!dryRun) await fs.mkdir(i18nDir, { recursive: true });

  for (const f of files) {
    const filePath = path.join(i18nDir, f.name);
    const rel = path.posix.join('i18n', f.name);
    if (await fileExists(filePath)) {
      changes.push({ kind: 'skip', file: rel, message: 'already exists' });
      continue;
    }
    if (!dryRun) await fs.writeFile(filePath, f.content);
    changes.push({ kind: 'add', file: rel });
  }
}

function i18nTypesTemplate(name: string): string {
  return `/* ========================================================================== */
/*                          @${name} — i18n types                             */
/* ========================================================================== */

/**
 * PLACEHOLDER — to be replaced by an import from \`@beautifulbits/lib\` once
 * the lib tool publishes the shared library-contribution types. When the
 * swap happens, every lib's \`i18n/types.ts\` collapses to a single re-export
 * line. Until then, each lib carries its own copy to preserve independence.
 *
 * @see lib.cfg \`contributions.i18n\` — declares this lib's i18n contribution
 *      so the registry codegen can pick it up.
 */

/**
 * Shape of a library's i18n contribution for one locale.
 *
 * A library MUST namespace its translations under exactly one top-level key
 * matching its \`lib.cfg.name\`, so multiple libs can be merged into the
 * generated registry without colliding.
 */
export type TLibraryI18nMessages<NS extends string = string> = {
  readonly [K in NS]: TLibraryI18nNode;
};

/** Recursive node — either a leaf string or another nested namespace. */
export type TLibraryI18nNode = {
  readonly [key: string]: string | TLibraryI18nNode;
};
`;
}

function i18nLocaleTemplate(name: string, suffix: 'En' | 'Es'): string {
  const exportName = suffix === 'En' ? i18nExportNames(name).en : i18nExportNames(name).es;
  return `/* ========================================================================== */
/*                          @${name} — i18n (${suffix.toLowerCase()})                              */
/* ========================================================================== */

/**
 * ${suffix === 'En' ? 'English' : 'Spanish'} translations contributed by \`@${name}\` to the host application's
 * i18n registry. The library currently surfaces no user-facing strings, so
 * the namespace ships empty. Reserving the \`${name}\` namespace now keeps
 * the contribution shape consistent with other libraries (see
 * \`lib.cfg.contributions.i18n\`) and lets future strings land here without
 * any host-side wiring changes.
 *
 * Convention: export name is \`${exportName}\`. The registry codegen
 * relies on this naming to import without per-lib aliases.
 */

import type { TLibraryI18nMessages } from './types';

export const ${exportName}: TLibraryI18nMessages<'${name}'> = {
  ${name}: {},
};
`;
}

function i18nBarrelTemplate(name: string): string {
  const { en, es } = i18nExportNames(name);
  return `/* ========================================================================== */
/*                          @${name} — i18n barrel                            */
/* ========================================================================== */

/**
 * Library i18n contribution barrel. The host application's registry imports
 * this barrel via \`@<libName>/<contributions.i18n.path>\` as declared in
 * \`lib.cfg\`. Export names follow the convention \`<libName>TranslationsEn\` /
 * \`<libName>TranslationsEs\` so the codegen can derive them from
 * \`lib.cfg.name\` without per-lib aliases.
 */

export { ${en} } from './en';
export { ${es} } from './es';
export type { TLibraryI18nMessages, TLibraryI18nNode } from './types';
`;
}

/* -------------------------------------------------------------------------- */
/* tailwind plugin template                                                   */
/* -------------------------------------------------------------------------- */

async function scaffoldTailwindPlugin(
  libDir: string,
  cfg: TPackageConfig,
  dryRun: boolean,
  changes: TScaffoldChange[],
): Promise<void> {
  const twDir = path.join(libDir, 'tailwind-plugin');
  const filePath = path.join(twDir, 'index.ts');
  const rel = path.posix.join('tailwind-plugin', 'index.ts');

  if (!dryRun) await fs.mkdir(twDir, { recursive: true });

  if (await fileExists(filePath)) {
    changes.push({ kind: 'skip', file: rel, message: 'already exists' });
    return;
  }
  if (!dryRun) {
    await fs.writeFile(filePath, tailwindPluginTemplate(cfg.name));
  }
  changes.push({ kind: 'add', file: rel });
}

function tailwindPluginTemplate(name: string): string {
  const factory = tailwindFactoryName(name);
  const optsType = tailwindOptionsTypeName(name);
  const pascal = pascalCase(name);
  return `/* ========================================================================== */
/*           @${name}/tailwind-plugin — Public Entry                           */
/* ========================================================================== */

/**
 * ${pascal} Tailwind plugin — public surface.
 *
 * The host application's \`tailwind.config.ts\` consumes this factory through
 * the generated registry (\`libraryTailwindPlugins\`). The factory must
 * accept zero arguments and return whatever \`tailwindcss/plugin\`'s default
 * export returns, so the registry can invoke each plugin uniformly with
 * \`libraryTailwindPlugins.map((f) => f())\`.
 */

import plugin from 'tailwindcss/plugin';
import type { PluginAPI } from 'tailwindcss/types/config';

/** Options accepted by ${factory}. Extend as the plugin grows. */
export interface ${optsType} {
  // TODO: add options as the plugin grows.
}

export function ${factory}(_options: ${optsType} = {}) {
  return plugin(
    function (_api: PluginAPI) {
      // TODO: register base styles, utilities, variants here.
    },
    {
      // TODO: theme extensions go here.
    },
  );
}
`;
}

/* -------------------------------------------------------------------------- */
/* lib.cfg update                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Adds the missing pieces of the `contributions` block to lib.cfg. Preserves
 * existing keys, ordering, and trailing-newline style. Never overwrites.
 */
async function updateLibCfg(
  cfgPath: string,
  raw: string,
  withTailwindPlugin: boolean,
  dryRun: boolean,
  changes: TScaffoldChange[],
): Promise<void> {
  const cfg = JSON.parse(raw) as TPackageConfig;
  const before = JSON.stringify(cfg);

  if (!cfg.contributions) cfg.contributions = {};
  let added = false;
  if (!cfg.contributions.i18n) {
    cfg.contributions.i18n = { path: 'i18n' };
    added = true;
    changes.push({ kind: 'add', file: 'lib.cfg', message: 'contributions.i18n.path = "i18n"' });
  } else {
    changes.push({ kind: 'skip', file: 'lib.cfg', message: 'contributions.i18n already declared' });
  }
  if (withTailwindPlugin) {
    if (!cfg.contributions.tailwindPlugin) {
      cfg.contributions.tailwindPlugin = { path: 'tailwind-plugin' };
      added = true;
      changes.push({
        kind: 'add',
        file: 'lib.cfg',
        message: 'contributions.tailwindPlugin.path = "tailwind-plugin"',
      });
    } else {
      changes.push({
        kind: 'skip',
        file: 'lib.cfg',
        message: 'contributions.tailwindPlugin already declared',
      });
    }
  }

  if (!added) return;
  if (JSON.stringify(cfg) === before) return; // belt-and-suspenders

  if (!dryRun) {
    const trailing = raw.endsWith('\n') ? '\n' : '';
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + trailing);
  }
}

/* -------------------------------------------------------------------------- */

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
