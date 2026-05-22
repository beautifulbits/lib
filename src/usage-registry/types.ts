/* ========================================================================== */
/*                          USAGE REGISTRY — SHARED TYPES                     */
/* ========================================================================== */

/**
 * Schema version — bumped on incompatible structural changes. The registry
 * loader rejects newer versions it doesn't understand.
 */
export const USAGE_SCHEMA_VERSION = 1;

export type TUsageLibraryEntry = {
  /** Pinned version this project is on. */
  version: string;
  /** ISO timestamp of when this version was first installed in this project. */
  installedAt: string;
};

export type TUsageProject = {
  /** Absolute path of this project's root on disk (informational; for `usage`). */
  path: string;
  /** ISO timestamp of the most recent registry-touching action (publish/install/sync). */
  lastSeen: string;
  /** Library name → version + when. */
  libraries: Record<string, TUsageLibraryEntry>;
};

export type TUsageLibrary = {
  /** Latest published version known to the registry. */
  currentVersion: string;
  /** Project names that have any version of this library installed. */
  consumers: string[];
};

export type TUsageRegistry = {
  schemaVersion: number;
  /** ISO timestamp of the last write. */
  updatedAt: string;
  /** Project name → project record. */
  projects: Record<string, TUsageProject>;
  /** Library name → library record (denormalized convenience view). */
  libraries: Record<string, TUsageLibrary>;
};

export function emptyRegistry(): TUsageRegistry {
  return {
    schemaVersion: USAGE_SCHEMA_VERSION,
    updatedAt: '',
    projects: {},
    libraries: {},
  };
}
