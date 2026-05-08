import type {
  TLibraryStack,
  TPackageConfig,
} from '../@types/package-config.js';

/* ========================================================================== */
/*                          LIB.CFG — PARSE + NORMALIZE                       */
/* ========================================================================== */

/**
 * A normalized manifest where derivable fields are filled in. Patchers
 * consume the normalized form so they don't each re-derive `libRoot`,
 * `stacks`, etc.
 */
export type TNormalizedLibCfg = TPackageConfig & {
  /** Resolved alias, e.g. `'@schematic'`. May still be undefined if not declared. */
  alias?: string;
  /**
   * Resolved library root, e.g. `'src/lib/schematic'` (no leading slash,
   * forward slashes). Always defined after normalization.
   */
  libRoot: string;
  /** Resolved stacks. Defaults to `['any']`. */
  stacks: TLibraryStack[];
  /** Resolved cross-library dependencies. Defaults to `[]`. */
  libraryDependencies: string[];
};

/**
 * Parse the contents of a `lib.cfg` file. Throws if the JSON is malformed.
 */
export function parseLibCfg(text: string): TPackageConfig {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('lib.cfg must be a JSON object');
  }
  // Minimal structural check — the type system handles the rest.
  const obj = parsed as Record<string, unknown>;
  for (const required of ['name', 'library', 'collection', 'version', 'path']) {
    if (typeof obj[required] !== 'string') {
      throw new Error(
        `lib.cfg is missing required string field "${required}"`,
      );
    }
  }
  return parsed as TPackageConfig;
}

/**
 * Fill in derived fields. Idempotent — passing an already-normalized config
 * back through is a no-op.
 *
 * Derivation rules:
 *   - `libRoot` defaults from `path` (strip leading slash, normalize separators)
 *   - `stacks` defaults to `['any']`
 *   - other fields pass through untouched
 */
export function normalizeLibCfg(cfg: TPackageConfig): TNormalizedLibCfg {
  const libRoot = cfg.libRoot ?? deriveLibRoot(cfg.path);
  const stacks: TLibraryStack[] = cfg.stacks?.length ? cfg.stacks : ['any'];
  const libraryDependencies = cfg.libraryDependencies ?? [];
  return { ...cfg, libRoot, stacks, libraryDependencies };
}

function deriveLibRoot(path: string): string {
  return path
    .replace(/^[/\\]+/, '') // strip leading slash(es)
    .replace(/\\/g, '/') // normalize separators
    .replace(/\/+$/, ''); // strip trailing slash
}

/**
 * Whether this library has anything to wire into a host of the given kind.
 * `any` always applies; `next` only applies to a Next host; `nest` to Nest.
 */
export function libAppliesTo(
  cfg: TNormalizedLibCfg,
  hostKind: 'next' | 'nest' | 'generic',
): boolean {
  if (cfg.stacks.includes('any')) return true;
  if (hostKind === 'next' && cfg.stacks.includes('next')) return true;
  if (hostKind === 'nest' && cfg.stacks.includes('nest')) return true;
  return false;
}
