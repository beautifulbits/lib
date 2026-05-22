import { promises as fs } from 'node:fs';
import path from 'node:path';
import { normalizeLibCfg } from '../../helpers/lib-cfg.js';
import { markerNames, upsertMarkerBlock } from '../marker-block.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TPatcher,
} from '../types.js';

/* ========================================================================== */
/*                          PATCHER — root CLAUDE.md                          */
/* ========================================================================== */

const SECTION_HEADER = '## Library AI Docs';

/**
 * Patches host root `CLAUDE.md`:
 *   - Ensures a `## Library AI Docs` section exists.
 *   - Inserts/maintains a per-library marker block referencing the
 *     library's own CLAUDE.md.
 *
 * If the host has no CLAUDE.md, one is created with the section. If the
 * library declares `ai.claudeMd` but the file doesn't exist on disk, the
 * patcher skips with a warn. (The library should ship its CLAUDE.md
 * alongside its code, synced into the host.)
 */
export const patchClaudeMd: TPatcher = async (ctx, host) => {
  const cfg = normalizeLibCfg(ctx.manifest);
  const claudeMdRel = cfg.ai?.claudeMd;
  if (!claudeMdRel) return noopResult('library declares no ai.claudeMd');

  const libClaudePath = path.join(ctx.hostRoot, cfg.libRoot, claudeMdRel);
  if (!(await exists(libClaudePath))) {
    return {
      file: null,
      changed: false,
      reason: `manifest references ${cfg.libRoot}/${claudeMdRel} but file is missing on disk`,
      changes: [
        {
          kind: 'warn',
          message: `library CLAUDE.md not found at ${libClaudePath}`,
        },
      ],
    };
  }

  const rootClaudePath = host.claudeMd?.path ?? path.join(ctx.hostRoot, 'CLAUDE.md');
  const existed = host.claudeMd !== null;
  let text = existed ? await fs.readFile(rootClaudePath, 'utf8') : '';
  const changes: TChangeEntry[] = [];

  /* ---------- ensure section ---------- */
  if (!text.includes(SECTION_HEADER)) {
    const sep = text.length === 0 || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
    text = text + sep + `${SECTION_HEADER}\n\n`;
    changes.push({ kind: 'add', message: `created "${SECTION_HEADER}" section` });
  }

  /* ---------- per-library reference line in a marker block ---------- */
  const refLine = `- [@${cfg.name}](./${cfg.libRoot}/${claudeMdRel}) — ${
    cfg.description ?? cfg.name
  }`;

  const next = upsertMarkerBlock({
    text,
    libName: cfg.name,
    scope: 'claudemd',
    content: refLine,
    anchor: new RegExp(escapeRegExp(SECTION_HEADER)),
    indent: '',
  });

  if (next === null) {
    changes.push({
      kind: 'warn',
      message: 'could not insert CLAUDE.md reference (no anchor)',
    });
    return buildResult(rootClaudePath, changes);
  }

  if (next !== text) {
    text = next;
    if (!hasReference(text, cfg.name)) {
      changes.push({ kind: 'add', message: `reference to @${cfg.name}` });
    } else {
      changes.push({ kind: 'update', message: `reference to @${cfg.name}` });
    }
  } else {
    changes.push({
      kind: 'skip',
      message: `CLAUDE.md reference for @${cfg.name} already up to date`,
    });
  }

  /* ---------- write ---------- */
  const willChange = changes.some((c) => c.kind === 'add' || c.kind === 'update');
  if (willChange && !ctx.dryRun) {
    await fs.writeFile(rootClaudePath, text);
  }

  return buildResult(rootClaudePath, changes);
};

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasReference(text: string, libName: string): boolean {
  const { start } = markerNames(libName, 'claudemd');
  return text.includes(start);
}
