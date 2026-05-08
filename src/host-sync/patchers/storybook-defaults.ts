import { promises as fs } from 'node:fs';
import { upsertMarkerBlock } from '../marker-block.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TDefaultPatcher,
} from '../types.js';

/* ========================================================================== */
/*             PATCHER (tool-wide) — storybook default exclusions             */
/* ========================================================================== */

/**
 * Tool-wide patch: insert/maintain a `default:stories-ignore` marker block
 * inside the host's `stories: [ ... ]` array, adding a negative glob that
 * excludes `src/lib/**` from the default Storybook. Per-library Storybooks
 * are launched via `storybook:<lib>` scripts pointing at each library's
 * own `.storybook/` config directory, so they don't go through the host
 * config.
 *
 * Run once per sync, not per library.
 */
export const patchStorybookDefaults: TDefaultPatcher = async (ctx, host) => {
  if (!host.storybook) return noopResult('no .storybook/main.*');

  const text = await fs.readFile(host.storybook.path, 'utf8');
  const ignoreContent = `'!../src/lib/**',`;

  const next = upsertMarkerBlock({
    text,
    libName: 'default',
    scope: 'stories-ignore',
    content: ignoreContent,
    anchor: /stories\s*:\s*\[/,
    indent: '    ',
  });

  const changes: TChangeEntry[] = [];

  if (next === null) {
    changes.push({
      kind: 'warn',
      message:
        `could not find a \`stories: [ ... ]\` array in ${host.storybook.name} ` +
        `— add one and re-run sync to exclude src/lib/** from default storybook`,
    });
    return buildResult(host.storybook.path, changes);
  }

  if (next === text) {
    changes.push({ kind: 'skip', message: 'stories-ignore block already present' });
    return buildResult(host.storybook.path, changes);
  }

  if (!ctx.dryRun) await fs.writeFile(host.storybook.path, next);
  changes.push({ kind: 'add', message: `default stories-ignore for src/lib/` });
  return buildResult(host.storybook.path, changes);
};
