import { promises as fs } from 'node:fs';
import path from 'node:path';

/* ========================================================================== */
/*                              ATOMIC JSON WRITE                             */
/* ========================================================================== */

/**
 * Write JSON to `filePath` atomically: writes to a sibling temp file first,
 * then renames over the destination. `rename` is atomic on the same
 * filesystem, so readers either see the old file or the new file — never a
 * truncated half-written file.
 *
 * Creates parent directories as needed. Trailing newline appended for
 * editor friendliness.
 */
export async function atomicWriteJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const text = JSON.stringify(data, null, 2) + '\n';

  try {
    await fs.writeFile(tmp, text);
    await fs.rename(tmp, filePath);
  } catch (err) {
    // Best-effort cleanup of the tmp file if rename failed.
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}
