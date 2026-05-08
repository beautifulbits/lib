import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { THostDetection, THostFile, THostKind } from './types.js';

/* ========================================================================== */
/*                              HOST DETECTION                                */
/* ========================================================================== */

/**
 * Inspects `root` and reports which host configuration files exist.
 * Patchers consume this and skip themselves when their target is null.
 */
export async function detectHost(root: string): Promise<THostDetection> {
  const tryFiles = async (names: string[]): Promise<THostFile | null> => {
    for (const name of names) {
      const p = path.join(root, name);
      if (await exists(p)) return { name, path: p };
    }
    return null;
  };

  const packageJson = await tryFiles(['package.json']);
  const tsconfig = await tryFiles(['tsconfig.json']);
  const next = await tryFiles([
    'next.config.mjs',
    'next.config.js',
    'next.config.ts',
    'next.config.cjs',
  ]);
  const jest = await tryFiles([
    'jest.config.cjs',
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
  ]);
  const storybook = await tryFiles([
    '.storybook/main.ts',
    '.storybook/main.tsx',
    '.storybook/main.js',
    '.storybook/main.mjs',
    '.storybook/main.cjs',
  ]);
  const claudeMd = await tryFiles(['CLAUDE.md']);
  const nestCli = await tryFiles(['nest-cli.json']);

  const kind: THostKind = next ? 'next' : nestCli ? 'nest' : 'generic';

  return {
    root,
    kind,
    packageJson,
    tsconfig,
    next,
    jest,
    storybook,
    claudeMd,
    nestCli,
  };
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
