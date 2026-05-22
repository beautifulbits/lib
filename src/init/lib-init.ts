import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LIB_CONFIG_FILENAME } from '../helpers/constants.js';
import type { TPackageConfig } from '../@types/package-config.js';

/* ========================================================================== */
/*                            LIB INIT — SHARED LOGIC                         */
/* ========================================================================== */

/**
 * Shared implementation of `lib lib-init`. Used by the clipanion command
 * and by the interactive CLI resolver.
 *
 * **Always additive.** This function never deletes files or directories.
 * Behavior across the three real scenarios:
 *
 *   1. Library directory doesn't exist
 *      → create it, write lib.cfg, write index.ts (and CLAUDE.md if asked).
 *
 *   2. Directory exists but has no lib.cfg
 *      → write lib.cfg only. Add index.ts and CLAUDE.md only if absent
 *        (so an existing entry point or doc file is never clobbered).
 *
 *   3. Directory exists and lib.cfg already there
 *      → refuse. Caller can delete the file manually to re-init.
 */

export type TLibInitOptions = {
  hostRoot: string;
  /** Project-relative path where libraries live. */
  localLibraryPath: string; // e.g. '/src/lib'
  /** Library name (kebab-case). */
  name: string;
  description?: string;
  alias?: string;
  library: string;
  collection: string;
  withClaudeMd: boolean;
};

export type TLibInitResult = {
  ok: boolean;
  error?: string;
  /** Absolute path to the library directory. */
  libDir?: string;
  /** Project-relative libRoot, e.g. 'src/lib/mylib'. */
  libRoot?: string;
  /** Resolved alias, e.g. '@mylib'. */
  alias?: string;
  /** Whether the directory pre-existed (informational; not destructive either way). */
  dirExisted?: boolean;
  /** Files that were written by this run. */
  filesWritten?: string[];
  /** Files that were skipped because they already existed. */
  filesSkipped?: string[];
};

export const LIB_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export async function runLibInit(
  opts: TLibInitOptions,
): Promise<TLibInitResult> {
  const {
    hostRoot,
    localLibraryPath,
    name,
    description,
    alias: aliasOpt,
    library,
    collection,
    withClaudeMd,
  } = opts;

  /* validate name */
  if (!LIB_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error:
        `Library name "${name}" must be lowercase, start with a letter, ` +
        `and contain only letters, digits, or dashes.`,
    };
  }

  const localLibBase = path.join(
    hostRoot,
    localLibraryPath.replace(/^[/\\]+/, ''),
  );
  const libDir = path.join(localLibBase, name);
  const libRoot = path.relative(hostRoot, libDir).replace(/\\/g, '/');
  const dirExisted = await exists(libDir);

  const cfgPath = path.join(libDir, LIB_CONFIG_FILENAME);
  if (await exists(cfgPath)) {
    return {
      ok: false,
      error:
        `${cfgPath} already exists — this directory is already a library.\n` +
        `  Edit lib.cfg by hand to change fields. ` +
        `If you really want to re-scaffold from scratch, delete the file first.`,
      libDir,
      libRoot,
      dirExisted,
    };
  }

  /* create dir if absent — never delete an existing one */
  if (!dirExisted) {
    await fs.mkdir(libDir, { recursive: true });
  }

  const alias = aliasOpt ?? `@${name}`;
  const finalDescription =
    description ?? `${capitalize(name)} — TODO describe this library.`;

  /* lib.cfg — always written (we already refused if it existed) */
  const cfg: TPackageConfig = {
    name,
    library,
    collection,
    version: '0.1.0',
    path: `/${libRoot}`,
    date: new Date().toUTCString(),
    includeFromProjectRoot: [],
    description: finalDescription,
    alias,
    libRoot,
    stacks: ['any'],
    dependencies: {},
    devDependencies: {},
    typescript: { decorators: false },
  };
  if (withClaudeMd) {
    cfg.ai = { claudeMd: 'CLAUDE.md' };
  }

  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];

  await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  filesWritten.push(cfgPath);

  /* index.ts — only if absent */
  const indexPath = path.join(libDir, 'index.ts');
  if (await exists(indexPath)) {
    filesSkipped.push(indexPath);
  } else {
    await fs.writeFile(
      indexPath,
      `/* ${alias} — public API entry point. */\n\nexport {};\n`,
    );
    filesWritten.push(indexPath);
  }

  /* CLAUDE.md — only when requested AND absent */
  if (withClaudeMd) {
    const claudePath = path.join(libDir, 'CLAUDE.md');
    if (await exists(claudePath)) {
      filesSkipped.push(claudePath);
    } else {
      const claudeContent =
        `# ${capitalize(name)}\n\n` +
        `${finalDescription}\n\n` +
        `## Working with this library\n\n` +
        `_TODO: describe conventions, patterns, gotchas for AI agents._\n`;
      await fs.writeFile(claudePath, claudeContent);
      filesWritten.push(claudePath);
    }
  }

  return {
    ok: true,
    libDir,
    libRoot,
    alias,
    dirExisted,
    filesWritten,
    filesSkipped,
  };
}

/* -------------------------------------------------------------------------- */

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
