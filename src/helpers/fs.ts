import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type { TReaddirFile } from '../@types/readdir-file.js';

/* ========================================================================== */
/*                              FILESYSTEM HELPERS                            */
/* ========================================================================== */

/**
 * Directories that should never be descended into during scans.
 * Applied universally — every glob in this codebase passes these as `ignore`.
 */
export const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/__gen__/**',
];

/* -------------------------------------------------------------------------- */
/* listFiles — fast-glob wrapper that returns TReaddirFile shapes             */
/* -------------------------------------------------------------------------- */

export type ListFilesOptions = {
  cwd: string;
  patterns: string[];
  readContent?: boolean;
  ignore?: string[];
};

/**
 * Drop-in replacement for `recursive-readdir-async.list(...)`.
 * Returns absolute paths in the same shape downstream code expects.
 *
 * Always merges DEFAULT_IGNORES with caller-supplied ignores.
 */
export async function listFiles({
  cwd,
  patterns,
  readContent = false,
  ignore = [],
}: ListFilesOptions): Promise<TReaddirFile[]> {
  const matches = await fg(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: [...DEFAULT_IGNORES, ...ignore],
  });

  return Promise.all(
    matches.map(async (fullname) => {
      const ext = path.extname(fullname);
      const name = path.basename(fullname);
      const title = ext ? name.slice(0, -ext.length) : name;
      const dir = path.dirname(fullname);
      const data = readContent ? await fs.readFile(fullname, 'utf8') : '';

      const entry: TReaddirFile = {
        name,
        title,
        path: dir,
        fullname,
        extension: ext.replace(/^\./, ''),
        isDirectory: false,
        data,
      };
      return entry;
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* listSubdirectories — top-level only, no recursion                          */
/* -------------------------------------------------------------------------- */

/**
 * Returns absolute paths of immediate subdirectories of `dir`.
 * Used for O(N libraries) scans where each library is one top-level folder.
 */
export async function listSubdirectories(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => path.join(dir, e.name));
}

/* -------------------------------------------------------------------------- */
/* readJsonIfExists — utility for optional config files                       */
/* -------------------------------------------------------------------------- */

export async function readJsonIfExists<T = unknown>(
  filePath: string,
): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
}
