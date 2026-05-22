/* ========================================================================== */
/*                  PUBLISHED LIBRARY-CONTRIBUTION TYPES                      */
/* ========================================================================== */

/**
 * Public types each shared library imports to type its i18n contribution.
 * These shapes are bytes-for-bytes identical to the placeholder declarations
 * each library currently keeps under its own `i18n/types.ts` (see e.g.
 * `src/lib/schematic/i18n/types.ts` in any host repo). The `lib
 * migrate-contribution-types` command collapses each library's local
 * placeholder into a single re-export from this module — the swap is a
 * semantic no-op.
 *
 * Re-exported from the package root (`@beautifulbits/lib`) so libraries can:
 *
 * ```ts
 * import type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';
 * ```
 *
 * @stability  stable — any breaking change here cascades into every library.
 */

/**
 * Shape of a library's i18n contribution for one locale.
 *
 * A library MUST namespace its translations under exactly one top-level key
 * matching its `lib.cfg.name`, so multiple libs can be merged into the
 * generated registry without colliding.
 *
 * @example
 * ```ts
 * export const schematicTranslationsEn: TLibraryI18nMessages<'schematic'> = {
 *   schematic: { 'some-feature': { 'some-key': 'Hello' } },
 * };
 * ```
 */
export type TLibraryI18nMessages<NS extends string = string> = {
  readonly [K in NS]: TLibraryI18nNode;
};

/** Recursive node — either a leaf string or another nested namespace. */
export type TLibraryI18nNode = {
  readonly [key: string]: string | TLibraryI18nNode;
};
