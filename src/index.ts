/* ========================================================================== */
/*                  @beautifulbits/lib — PUBLIC PACKAGE SURFACE               */
/* ========================================================================== */

/**
 * Type-only re-exports consumed by shared libraries (e.g. `@schematic`,
 * `@tectonic`) so each library can carry a `<libRoot>/i18n/types.ts` that
 * collapses to a single re-export line:
 *
 * ```ts
 * export type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';
 * ```
 *
 * Until a library runs `lib migrate-contribution-types`, it keeps its own
 * placeholder copy of these types — bytes-for-bytes identical — so the
 * eventual swap is a semantic no-op.
 */

export type {
  TLibraryI18nMessages,
  TLibraryI18nNode,
} from './contribution-types/index.js';
