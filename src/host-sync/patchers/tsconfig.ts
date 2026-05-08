import { promises as fs } from 'node:fs';
import { normalizeLibCfg } from '../../helpers/lib-cfg.js';
import {
  buildResult,
  noopResult,
  type TChangeEntry,
  type TPatcher,
} from '../types.js';

/* ========================================================================== */
/*                            PATCHER — tsconfig.json                         */
/* ========================================================================== */

/**
 * Patches host `tsconfig.json`:
 *   - Adds `compilerOptions.paths` for `<alias>` and `<alias>/*`.
 *   - Sets `experimentalDecorators` + `emitDecoratorMetadata` if the
 *     manifest declares decorator usage.
 *   - Merges `requiredCompilerOptions` (only sets keys not already set).
 *
 * Direct JSON edit — keyed entries make per-library updates collision-free.
 */
export const patchTsconfig: TPatcher = async (ctx, host) => {
  if (!host.tsconfig) return noopResult('no tsconfig.json');

  const cfg = normalizeLibCfg(ctx.manifest);
  const text = await fs.readFile(host.tsconfig.path, 'utf8');

  let ts: {
    compilerOptions?: Record<string, unknown> & {
      paths?: Record<string, string[]>;
    };
  };
  try {
    ts = JSON.parse(text);
  } catch (err) {
    return {
      file: host.tsconfig.path,
      changed: false,
      reason: `parse failure (does tsconfig.json contain comments?): ${(err as Error).message}`,
      changes: [],
    };
  }

  ts.compilerOptions = ts.compilerOptions ?? {};
  ts.compilerOptions.paths = ts.compilerOptions.paths ?? {};
  const changes: TChangeEntry[] = [];

  /* ---------- paths ---------- */
  if (cfg.alias && cfg.libRoot) {
    const exact = cfg.alias;
    const wild = `${cfg.alias}/*`;
    const expectedExact = [`./${cfg.libRoot}`];
    const expectedWild = [`./${cfg.libRoot}/*`];

    if (eq(ts.compilerOptions.paths[exact], expectedExact)) {
      changes.push({ kind: 'skip', message: `path "${exact}" already set` });
    } else {
      ts.compilerOptions.paths[exact] = expectedExact;
      changes.push({ kind: 'add', message: `path "${exact}" → ${expectedExact[0]}` });
    }

    if (eq(ts.compilerOptions.paths[wild], expectedWild)) {
      changes.push({ kind: 'skip', message: `path "${wild}" already set` });
    } else {
      ts.compilerOptions.paths[wild] = expectedWild;
      changes.push({ kind: 'add', message: `path "${wild}" → ${expectedWild[0]}` });
    }
  }

  /* ---------- decorators ---------- */
  if (cfg.typescript?.decorators) {
    for (const k of ['experimentalDecorators', 'emitDecoratorMetadata'] as const) {
      if (ts.compilerOptions[k] === true) {
        changes.push({ kind: 'skip', message: `compilerOptions.${k} already true` });
      } else {
        ts.compilerOptions[k] = true;
        changes.push({ kind: 'add', message: `compilerOptions.${k} = true` });
      }
    }
  }

  /* ---------- requiredCompilerOptions ---------- */
  for (const [k, v] of Object.entries(cfg.typescript?.requiredCompilerOptions ?? {})) {
    const existing = ts.compilerOptions[k];
    if (existing === undefined) {
      ts.compilerOptions[k] = v;
      changes.push({ kind: 'add', message: `compilerOptions.${k} = ${JSON.stringify(v)}` });
    } else if (JSON.stringify(existing) === JSON.stringify(v)) {
      changes.push({
        kind: 'skip',
        message: `compilerOptions.${k} already ${JSON.stringify(v)}`,
      });
    } else {
      changes.push({
        kind: 'warn',
        message: `compilerOptions.${k} differs (host: ${JSON.stringify(existing)}; manifest: ${JSON.stringify(v)}) — leaving host value`,
      });
    }
  }

  /* ---------- write ---------- */
  const willChange = changes.some((c) => c.kind === 'add' || c.kind === 'update');
  if (willChange && !ctx.dryRun) {
    const trailingNewline = text.endsWith('\n') ? '\n' : '';
    await fs.writeFile(host.tsconfig.path, JSON.stringify(ts, null, 2) + trailingNewline);
  }

  return buildResult(host.tsconfig.path, changes);
};

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
