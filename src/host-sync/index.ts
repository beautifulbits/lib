/* ========================================================================== */
/*                          HOST-SYNC — PUBLIC SURFACE                        */
/* ========================================================================== */

export { detectHost } from './detect-host.js';
export {
  hasMarkerBlock,
  markerNames,
  removeMarkerBlock,
  upsertMarkerBlock,
} from './marker-block.js';

export type {
  THostDetection,
  THostFile,
  THostKind,
  TChangeEntry,
  TChangeKind,
  TDefaultPatchContext,
  TDefaultPatcher,
  TPatchContext,
  TPatcher,
  TPatchResult,
} from './types.js';
export { buildResult, noopResult } from './types.js';

/* per-library patchers */
export { patchPackageJson } from './patchers/package-json.js';
export { patchTsconfig } from './patchers/tsconfig.js';
export { patchNextConfig } from './patchers/next-config.js';
export { patchJestConfig } from './patchers/jest-config.js';
export { patchClaudeMd } from './patchers/claude-md.js';

/* tool-wide default patchers */
export { patchJestDefaults } from './patchers/jest-defaults.js';
export { patchStorybookDefaults } from './patchers/storybook-defaults.js';

/* orchestrator + report printer */
export {
  runSync,
  LIBRARY_PATCHERS,
  DEFAULT_PATCHERS,
} from './orchestrator.js';
export type {
  TSyncRunOptions,
  TSyncReport,
  TLibraryRunReport,
  TDefaultRunReport,
} from './orchestrator.js';
export { printSyncReport } from './print-report.js';
