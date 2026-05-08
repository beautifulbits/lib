/* ========================================================================== */
/*                          HOST-SYNC — SHARED TYPES                          */
/* ========================================================================== */

import type { TPackageConfig } from '../@types/package-config.js';

/**
 * The kinds of host projects we know how to patch. A host can match more
 * than one (e.g., a Next.js project may also have jest configured).
 */
export type THostKind = 'next' | 'nest' | 'generic';

/**
 * Detected host configuration files. Each is `null` if absent. Patchers
 * skip themselves when their target is null.
 */
export type THostDetection = {
  root: string;
  kind: THostKind;
  packageJson: THostFile | null;
  tsconfig: THostFile | null;
  next: THostFile | null;
  jest: THostFile | null;
  storybook: THostFile | null;
  claudeMd: THostFile | null;
  nestCli: THostFile | null;
};

export type THostFile = {
  /** Filename without directory, e.g., `next.config.mjs`. */
  name: string;
  /** Absolute path. */
  path: string;
};

/* -------------------------------------------------------------------------- */
/* Patch context + result                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Per-invocation context passed to every patcher. The library being applied
 * is identified by `manifest`; the orchestrator iterates manifests and
 * runs each patcher per library.
 */
export type TPatchContext = {
  hostRoot: string;
  manifest: TPackageConfig;
  dryRun: boolean;
};

export type TChangeKind = 'add' | 'update' | 'skip' | 'warn';

export type TChangeEntry = {
  kind: TChangeKind;
  message: string;
};

export type TPatchResult = {
  /** The file the patcher acted on (or would have acted on). */
  file: string | null;
  /** Whether any actual change was applied (or would be in dry-run). */
  changed: boolean;
  /**
   * If the patcher couldn't act for a structural reason (file absent,
   * stack mismatch, etc.), the reason. Not an error.
   */
  reason?: string;
  /** Per-change details, suitable for printing or for a check report. */
  changes: TChangeEntry[];
};

/* -------------------------------------------------------------------------- */
/* Patcher signature                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Every per-library patcher is an async function with this signature.
 * Run once per library by the orchestrator.
 */
export type TPatcher = (
  ctx: TPatchContext,
  host: THostDetection,
) => Promise<TPatchResult>;

/**
 * Tool-wide default patchers maintain configuration that doesn't belong to
 * any single library (e.g., the host's "ignore src/lib/** in default
 * tests/storybook" block). Run once per sync, regardless of library count.
 */
export type TDefaultPatchContext = {
  hostRoot: string;
  dryRun: boolean;
};

export type TDefaultPatcher = (
  ctx: TDefaultPatchContext,
  host: THostDetection,
) => Promise<TPatchResult>;

/* -------------------------------------------------------------------------- */
/* Constructors for results — small, used everywhere                          */
/* -------------------------------------------------------------------------- */

export function noopResult(reason: string, file: string | null = null): TPatchResult {
  return { file, changed: false, reason, changes: [] };
}

export function buildResult(
  file: string,
  changes: TChangeEntry[],
): TPatchResult {
  return {
    file,
    changed: changes.some((c) => c.kind === 'add' || c.kind === 'update'),
    changes,
  };
}
