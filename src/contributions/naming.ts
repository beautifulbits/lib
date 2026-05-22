import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*              CONTRIBUTION NAMING — single source of truth                  */
/* ========================================================================== */

/**
 * The naming convention that ties library names to their contribution
 * exports and import paths. Every contribution-related command consults
 * these helpers — there is no other place where the convention is
 * encoded. Changing a rule here changes the whole tool consistently.
 *
 * Rules:
 *   - i18n exports follow `<name>TranslationsEn` / `<name>TranslationsEs`
 *   - tailwind factory follows `create<PascalCase(name)>Plugin`
 *   - import paths use the library's `cfg.alias` + the contribution `path`
 *
 * `name` is the camelCase form of `cfg.name` — dashes and underscores are
 * dropped so e.g. `react-test-utils` → `reactTestUtils` for the i18n export
 * (and `ReactTestUtils` for the tailwind factory).
 */

/* -------------------------------------------------------------------------- */
/* PascalCase / camelCase                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dash- and underscore-aware PascalCase. Empty segments are dropped.
 *   `tectonic`           → `Tectonic`
 *   `data-pipeline`      → `DataPipeline`
 *   `react_test_utils`   → `ReactTestUtils`
 *   `weird--name__here`  → `WeirdNameHere`
 */
export function pascalCase(name: string): string {
  return name
    .split(/[-_]+/g)
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * camelCase variant of {@link pascalCase}. First segment kept lowercase.
 *   `tectonic`           → `tectonic`
 *   `data-pipeline`      → `dataPipeline`
 *   `react-test-utils`   → `reactTestUtils`
 */
export function camelCase(name: string): string {
  const pascal = pascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Export names                                                               */
/* -------------------------------------------------------------------------- */

/** The two i18n export names for a given library. */
export type TI18nExportNames = {
  /** e.g. `tectonicTranslationsEn` */
  en: string;
  /** e.g. `tectonicTranslationsEs` */
  es: string;
};

export function i18nExportNames(name: string): TI18nExportNames {
  const base = camelCase(name);
  return {
    en: `${base}TranslationsEn`,
    es: `${base}TranslationsEs`,
  };
}

/** The single tailwind plugin factory name for a given library. */
export function tailwindFactoryName(name: string): string {
  return `create${pascalCase(name)}Plugin`;
}

/**
 * The Tailwind plugin options interface name for a given library, used
 * when scaffolding `tailwind-plugin/index.ts`. Returns e.g.
 * `TTectonicPluginOptions`.
 */
export function tailwindOptionsTypeName(name: string): string {
  return `T${pascalCase(name)}PluginOptions`;
}

/* -------------------------------------------------------------------------- */
/* Import paths                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The import path the registry uses to pull a library's i18n barrel.
 * Requires `cfg.alias` and `cfg.contributions.i18n.path` to be present —
 * caller validates that before calling.
 */
export function i18nImportPath(cfg: TPackageConfig): string {
  if (!cfg.alias) {
    throw new Error(
      `Library "${cfg.name}" declares contributions.i18n but has no alias — set cfg.alias and re-run.`,
    );
  }
  if (!cfg.contributions?.i18n?.path) {
    throw new Error(
      `Library "${cfg.name}" has no contributions.i18n.path declared.`,
    );
  }
  return joinAliasPath(cfg.alias, cfg.contributions.i18n.path);
}

/**
 * The import path the registry uses to pull a library's tailwind plugin.
 * Requires `cfg.alias` and `cfg.contributions.tailwindPlugin.path` to be
 * present — caller validates that before calling.
 */
export function tailwindImportPath(cfg: TPackageConfig): string {
  if (!cfg.alias) {
    throw new Error(
      `Library "${cfg.name}" declares contributions.tailwindPlugin but has no alias — set cfg.alias and re-run.`,
    );
  }
  if (!cfg.contributions?.tailwindPlugin?.path) {
    throw new Error(
      `Library "${cfg.name}" has no contributions.tailwindPlugin.path declared.`,
    );
  }
  return joinAliasPath(cfg.alias, cfg.contributions.tailwindPlugin.path);
}

function joinAliasPath(alias: string, subPath: string): string {
  // strip leading/trailing slashes from subPath; alias is left as-is
  const trimmed = subPath.replace(/^[/\\]+|[/\\]+$/g, '').replace(/\\/g, '/');
  return trimmed ? `${alias}/${trimmed}` : alias;
}
