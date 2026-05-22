/* ========================================================================== */
/*                          LIB.CFG — MANIFEST SCHEMA                         */
/* ========================================================================== */

/**
 * Stack kinds a library can target. `any` means the library applies to any
 * host. `next` / `nest` indicate the library only meaningfully integrates
 * with that host kind (e.g., a React-only library should not try to add a
 * turbopack alias to a NestJS host).
 */
export type TLibraryStack = 'next' | 'nest' | 'any';

/**
 * Per-library workflow declarations. Used by the `sync` command to generate
 * per-library npm scripts (`test:<lib>`, `storybook:<lib>`, `docs:<lib>`)
 * and to manage default-workflow exclusions.
 */
export type TLibraryWorkflows = {
  test?: {
    /** Glob/path pattern matching the library's spec files. */
    pattern: string;
  };
  storybook?: {
    /** Directory containing this library's `.storybook/main.ts`. */
    configDir: string;
    /** Port to launch this library's Storybook on. */
    port: number;
  };
  docs?: {
    /** Root of the library's Starlight project (folder with `astro.config.mjs`). */
    root: string;
    /** Port for `astro dev`. */
    port: number;
  };
};

/**
 * TypeScript configuration this library needs in the host's `tsconfig.json`.
 */
export type TLibraryTypeScriptConfig = {
  /**
   * If true, the host's tsconfig.json must have
   * `experimentalDecorators` and `emitDecoratorMetadata` enabled.
   */
  decorators?: boolean;
  /**
   * Additional compilerOptions the host must have. Merged into host
   * tsconfig.json's `compilerOptions`. Existing host values are not
   * overwritten — `sync` warns instead.
   */
  requiredCompilerOptions?: Record<string, unknown>;
};

/**
 * AI-agent documentation declarations.
 */
export type TLibraryAiConfig = {
  /**
   * Path to the library's `CLAUDE.md`, relative to the library root.
   * If present, `sync` registers it in the host's root `CLAUDE.md`.
   */
  claudeMd?: string;
};

/**
 * Library contribution declarations. A library opts in to the
 * registry-codegen pipeline (`lib generate-registry`) by populating one or
 * both sub-blocks. Both are independent — a library may declare i18n only,
 * a tailwind plugin only, both, or neither.
 *
 * Naming is convention-driven from `cfg.name`:
 *   - i18n exports: `<name>TranslationsEn` / `<name>TranslationsEs`
 *   - tailwind factory: `create<PascalCase(name)>Plugin`
 *
 * Import paths are derived from `cfg.alias`:
 *   - i18n:    `<alias>/<contributions.i18n.path>`           (e.g. `@tectonic/i18n`)
 *   - plugin:  `<alias>/<contributions.tailwindPlugin.path>` (e.g. `@tectonic/tailwind-plugin`)
 */
export type TLibraryContributions = {
  /**
   * Library i18n contribution. The barrel must live at
   * `<libRoot>/<path>/index.ts` and export both `<name>TranslationsEn`
   * and `<name>TranslationsEs`.
   */
  i18n?: {
    /** Directory relative to libRoot. Conventional value: `"i18n"`. */
    path: string;
  };
  /**
   * Library Tailwind plugin contribution. The entry must live at
   * `<libRoot>/<path>/index.ts` and export `create<PascalCase(name)>Plugin`.
   *
   * Note: this is the Tailwind 3 plugin contract (a factory returning the
   * value of `tailwindcss/plugin`'s default export). A Tailwind 4 variant
   * (CSS-first config with `@plugin` directives) may follow as a separate
   * field once the team adopts v4.
   */
  tailwindPlugin?: {
    /** Directory relative to libRoot. Conventional value: `"tailwind-plugin"`. */
    path: string;
  };
};

/**
 * Manifest at `<library-root>/lib.cfg`. Read by `@beautifulbits/lib`.
 *
 * Existing fields (`name`, `library`, `collection`, `version`, `path`,
 * `date`, `includeFromProjectRoot`) are written by the existing
 * publish/install flows and are not touched.
 *
 * New fields (`alias`, `libRoot`, `stacks`, `dependencies`,
 * `devDependencies`, `typescript`, `workflows`, `ai`) are read by the new
 * `sync` command. All optional — libraries opt in to host wiring by
 * populating them.
 */
export type TPackageConfig = {
  /* === existing fields — untouched, set by publish flow =================== */
  name: string;
  library: string;
  collection: string;
  version: string;
  path: string;
  date: string;
  includeFromProjectRoot?: string[];

  /* === new fields — host wiring (all optional, additive) ================== */

  /** Human-readable description of the library, shown in generated AI docs etc. */
  description?: string;

  /** Path-alias prefix the host uses to import this library, e.g. `'@schematic'`. */
  alias?: string;

  /**
   * Path to the library inside the host project, e.g. `'src/lib/schematic'`.
   * If omitted, derived from `path` (which is set by the publish flow).
   */
  libRoot?: string;

  /** Host stacks this library is meaningful for. Defaults to `['any']`. */
  stacks?: TLibraryStack[];

  /** Runtime npm dependencies the host must have for this library to function. */
  dependencies?: Record<string, string>;

  /** Dev-time npm dependencies the host must have (jest, storybook, astro, …). */
  devDependencies?: Record<string, string>;

  /**
   * Other libraries (by `name`) this library imports from. Surfaces
   * cross-library couplings the dependency graph would otherwise miss.
   * Populated automatically by `lib detect-deps` and validated by `lib sync`.
   */
  libraryDependencies?: string[];

  /** TypeScript compilerOptions this library requires in the host. */
  typescript?: TLibraryTypeScriptConfig;

  /** Per-library workflow ports/configs (test, storybook, docs). */
  workflows?: TLibraryWorkflows;

  /** AI-agent documentation registration. */
  ai?: TLibraryAiConfig;

  /**
   * Optional contributions a library projects into the host application via
   * codegen (`lib generate-registry`). Currently i18n translations and
   * Tailwind 3 plugins. Read-only from the CLI's perspective — populated
   * by hand or via `lib add-contribution`.
   */
  contributions?: TLibraryContributions;
};
