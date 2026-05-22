import { promises as fs } from 'node:fs';
import { normalizeLibCfg } from '../../helpers/lib-cfg.js';
import { hasMarkerBlock, upsertMarkerBlock } from '../marker-block.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TPatcher,
} from '../types.js';

/* ========================================================================== */
/*                  PATCHER (per-library) — jest moduleNameMapper             */
/* ========================================================================== */

/**
 * Per-library patch: insert/maintain a marker block inside
 * `moduleNameMapper: { ... }` for this library's alias.
 *
 * Tool-wide concerns (the `testPathIgnorePatterns` block excluding
 * `src/lib/**` from default `yarn test`) are handled separately by
 * `patchJestDefaults` so they're applied once per sync, not once per library.
 */
export const patchJestConfig: TPatcher = async (ctx, host) => {
  if (!host.jest) return noopResult('no jest.config');

  const cfg = normalizeLibCfg(ctx.manifest);
  if (!cfg.alias || !cfg.libRoot) return noopResult('no alias declared');

  const text = await fs.readFile(host.jest.path, 'utf8');
  const mapperContent =
    `'^${cfg.alias}/(.*)$': '<rootDir>/${cfg.libRoot}/$1',\n` +
    `'^${cfg.alias}$': '<rootDir>/${cfg.libRoot}',`;

  const next = upsertMarkerBlock({
    text,
    libName: cfg.name,
    scope: 'mapper',
    content: mapperContent,
    anchor: /moduleNameMapper\s*:\s*\{/,
    indent: '    ',
  });

  const changes: TChangeEntry[] = [];

  if (next === null) {
    changes.push({
      kind: 'warn',
      message:
        `could not find a \`moduleNameMapper\` block in ${host.jest.name} ` +
        `— add an empty one (\`moduleNameMapper: {}\`) and re-run sync`,
    });
    return buildResult(host.jest.path, changes);
  }

  if (next === text) {
    changes.push({
      kind: 'skip',
      message: hasMarkerBlock(text, cfg.name, 'mapper')
        ? 'moduleNameMapper block already up to date'
        : 'no mapper change needed',
    });
    return buildResult(host.jest.path, changes);
  }

  if (!ctx.dryRun) await fs.writeFile(host.jest.path, next);
  changes.push({
    kind: 'add',
    message: `moduleNameMapper for '${cfg.alias}'`,
  });
  return buildResult(host.jest.path, changes);
};
