import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer, listenOnAvailablePort } from './static-server.js';
import { openBrowser } from './open-browser.js';

/* ========================================================================== */
/*                             DOCS SERVER ENTRY                              */
/* ========================================================================== */

/**
 * Locates the pre-built Starlight site shipped inside this package and
 * serves it on localhost. Used by both the `lib docs` clipanion command
 * and the interactive CLI resolver.
 *
 * The build output lives at `<package-root>/docs/dist/`. Resolution is
 * relative to this module's `import.meta.url` so it works regardless of
 * how the package is installed (yarn add / yarn link / direct invocation).
 */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
// build/docs-server/index.js → ../../docs/dist
const DOCS_DIST = path.resolve(SCRIPT_DIR, '../../docs/dist');

export type TDocsServerOptions = {
  /** Preferred port. Falls through up to +20 if taken. */
  port?: number;
  /** Open the URL in the default browser. */
  open?: boolean;
};

export type TDocsServerHandle = {
  url: string;
  /** Stop the server. */
  close: () => Promise<void>;
};

export async function startDocsServer(
  opts: TDocsServerOptions = {},
): Promise<TDocsServerHandle> {
  const preferredPort = opts.port ?? 7301;

  if (!(await isDirectory(DOCS_DIST))) {
    throw new Error(
      `Docs not built. Expected pre-built site at ${DOCS_DIST}.\n` +
        `If you're developing @beautifulbits/lib itself, run \`yarn docs:build\` from the package root.`,
    );
  }

  const server = createStaticServer(DOCS_DIST);
  const actualPort = await listenOnAvailablePort(server, preferredPort);
  const url = `http://localhost:${actualPort}/`;

  if (opts.open !== false) openBrowser(url);

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
