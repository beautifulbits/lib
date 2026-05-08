import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteJson } from '../usage-registry/atomic-write.js';

/* ========================================================================== */
/*                          PROJECT INIT — SHARED LOGIC                       */
/* ========================================================================== */

/**
 * Shared implementation of `lib project-init`. Used by the clipanion command
 * and by the interactive CLI resolver. Returns a structured result so each
 * caller can format output as it likes.
 */

export type TProjectInitOptions = {
  hostRoot: string;
  remoteLibraryPath: string;
  localLibraryPath: string; // e.g. '/src/lib'
  force: boolean;
};

export type TProjectInitResult = {
  ok: boolean;
  /** Human-readable error if `ok === false`. */
  error?: string;
  /** Path written, when ok. */
  sharedCfgPath?: string;
  /** Whether sharedlib.cfg was new or overwritten. */
  sharedCfgExisted?: boolean;
  /** Resolved absolute path to the local library directory. */
  localLibAbsPath?: string;
  /** Whether the local library directory already existed. */
  localLibExisted?: boolean;
};

export async function runProjectInit(
  opts: TProjectInitOptions,
): Promise<TProjectInitResult> {
  const { hostRoot, remoteLibraryPath, localLibraryPath, force } = opts;

  /* validate package.json */
  if (!(await exists(path.join(hostRoot, 'package.json')))) {
    return {
      ok: false,
      error: `No package.json at ${hostRoot} — project-init must run from a project root.`,
    };
  }

  /* validate remote */
  if (!(await isDirectory(remoteLibraryPath))) {
    return {
      ok: false,
      error:
        `Remote library path "${remoteLibraryPath}" doesn't exist or isn't a directory. ` +
        `Create the folder first, then re-run.`,
    };
  }

  /* sharedlib.cfg */
  const sharedCfgPath = path.join(hostRoot, 'sharedlib.cfg');
  const sharedCfgExisted = await exists(sharedCfgPath);
  if (sharedCfgExisted && !force) {
    return {
      ok: false,
      error: `sharedlib.cfg already exists at ${sharedCfgPath}. Pass force to overwrite.`,
    };
  }
  await atomicWriteJson(sharedCfgPath, {
    remoteLibraryPath,
    localLibraryPath,
  });

  /* local lib directory */
  const localLibAbsPath = path.join(
    hostRoot,
    localLibraryPath.replace(/^[/\\]+/, ''),
  );
  const localLibExisted = await isDirectory(localLibAbsPath);
  if (!localLibExisted) {
    await fs.mkdir(localLibAbsPath, { recursive: true });
  }

  return {
    ok: true,
    sharedCfgPath,
    sharedCfgExisted,
    localLibAbsPath,
    localLibExisted,
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

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
