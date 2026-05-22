import { promises as fs } from 'node:fs';
import path from 'node:path';

/* ========================================================================== */
/*                          HOST PROJECT IDENTITY                             */
/* ========================================================================== */

export type TProjectIdentity = {
  /** From host's package.json `name` field. */
  name: string;
  /** Absolute path of the host project root. */
  path: string;
};

/**
 * Resolves a project's identity from its `package.json#name`. Throws if
 * the file is missing or has no `name` field, since downstream tracking
 * relies on a stable name.
 */
export async function readProjectIdentity(
  hostRoot: string,
): Promise<TProjectIdentity> {
  const pkgPath = path.join(hostRoot, 'package.json');
  let text: string;
  try {
    text = await fs.readFile(pkgPath, 'utf8');
  } catch {
    throw new Error(
      `Cannot read host package.json at ${pkgPath} — is this a project root?`,
    );
  }
  const pkg = JSON.parse(text) as { name?: unknown };
  if (typeof pkg.name !== 'string' || pkg.name.length === 0) {
    throw new Error(
      `Host package.json at ${pkgPath} has no "name" field — usage tracking requires one.`,
    );
  }
  return { name: pkg.name, path: hostRoot };
}
