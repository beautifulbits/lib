import { promises as fs } from 'node:fs';
import { upsertMarkerBlock } from '../marker-block.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TDefaultPatcher,
} from '../types.js';

/* ========================================================================== */
/*               PATCHER (tool-wide) — jest default exclusions                */
/* ========================================================================== */

/**
 * Tool-wide patch: maintain a `default:test-ignore` marker block inside
 * the host's `testPathIgnorePatterns: [...]` so that `src/lib/**` is
 * excluded from the default `yarn test` run. Per-library tests are
 * launched via `test:<lib>` scripts which bypass this ignore.
 *
 * Run once per sync, not per library.
 */
export const patchJestDefaults: TDefaultPatcher = async (ctx, host) => {
  if (!host.jest) return noopResult('no jest.config');

  const text = await fs.readFile(host.jest.path, 'utf8');
  const ignoreContent = `'<rootDir>/src/lib/',`;

  const next = upsertMarkerBlock({
    text,
    libName: 'default',
    scope: 'test-ignore',
    content: ignoreContent,
    anchor: /testPathIgnorePatterns\s*:\s*\[/,
    indent: '    ',
  });

  const changes: TChangeEntry[] = [];

  if (next === null) {
    changes.push({
      kind: 'warn',
      message:
        `could not find a \`testPathIgnorePatterns\` array in ${host.jest.name} ` +
        `— add an empty one (\`testPathIgnorePatterns: []\`) and re-run sync ` +
        `to exclude src/lib/** from default \`yarn test\``,
    });
    return buildResult(host.jest.path, changes);
  }

  if (next === text) {
    changes.push({ kind: 'skip', message: 'test-ignore block already present' });
    return buildResult(host.jest.path, changes);
  }

  if (!ctx.dryRun) await fs.writeFile(host.jest.path, next);
  changes.push({ kind: 'add', message: `default test-ignore for src/lib/` });
  return buildResult(host.jest.path, changes);
};
