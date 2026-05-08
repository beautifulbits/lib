import { promises as fs } from 'node:fs';
import { libAppliesTo, normalizeLibCfg } from '../../helpers/lib-cfg.js';
import { hasMarkerBlock, upsertMarkerBlock } from '../marker-block.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TPatcher,
} from '../types.js';

/* ========================================================================== */
/*                          PATCHER — next.config.*                           */
/* ========================================================================== */

/**
 * Patches host `next.config.*`:
 *   - Inserts/maintains a per-library marker block inside
 *     `turbopack.resolveAlias: { ... }`.
 *
 * Skipped when:
 *   - Host has no `next.config.*` (likely a NestJS / generic project).
 *   - Library doesn't apply to `next` stack.
 *   - Library declares no `alias` / `libRoot`.
 *
 * If the host has no `turbopack.resolveAlias` block at all, the patcher
 * issues a `warn` change and returns; the user adds an empty
 * `turbopack: { resolveAlias: {} }` once and re-runs sync.
 */
export const patchNextConfig: TPatcher = async (ctx, host) => {
  if (!host.next) return noopResult('no next.config');

  const cfg = normalizeLibCfg(ctx.manifest);
  if (!libAppliesTo(cfg, 'next')) return noopResult('library not for next stack');
  if (!cfg.alias || !cfg.libRoot) return noopResult('no alias declared');

  const text = await fs.readFile(host.next.path, 'utf8');
  const aliasContent = `'${cfg.alias}': './${cfg.libRoot}',`;
  const indent = '      ';

  const next = upsertMarkerBlock({
    text,
    libName: cfg.name,
    scope: 'alias',
    content: aliasContent,
    anchor: /resolveAlias\s*:\s*\{/,
    indent,
  });

  const changes: TChangeEntry[] = [];

  if (next === null) {
    changes.push({
      kind: 'warn',
      message:
        `could not find a \`turbopack.resolveAlias\` block in ${host.next.name} ` +
        `— add an empty one (\`turbopack: { resolveAlias: {} }\`) and re-run sync`,
    });
    return buildResult(host.next.path, changes);
  }

  if (next === text) {
    changes.push({
      kind: 'skip',
      message: hasMarkerBlock(text, cfg.name, 'alias')
        ? 'alias block already up to date'
        : 'no change needed',
    });
    return buildResult(host.next.path, changes);
  }

  if (!ctx.dryRun) await fs.writeFile(host.next.path, next);
  changes.push({
    kind: 'add',
    message: `alias '${cfg.alias}' → ./${cfg.libRoot}`,
  });
  return buildResult(host.next.path, changes);
};
