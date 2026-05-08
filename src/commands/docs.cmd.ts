import { Command, Option } from 'clipanion';
import consola from 'consola';

import { startDocsServer } from '../docs-server/index.js';

/* ========================================================================== */
/*                                DOCS COMMAND                                */
/* ========================================================================== */

/**
 * `lib docs [--port N] [--no-open]` — serve the pre-built @beautifulbits/lib
 * documentation locally and open it in the default browser. The site is
 * fully static; no Astro runtime is required.
 *
 * Stays in the foreground until Ctrl+C.
 */
export class DocsCommand extends Command {
  static override paths = [['docs']];

  static override usage = Command.Usage({
    description: 'Serve @beautifulbits/lib docs locally and open in browser',
    details: `
      Spins up a tiny HTTP server on localhost serving the pre-built
      Starlight site shipped with the package, then opens it in your default
      browser. No Astro/Node-runtime tooling needed beyond Node itself.

      The default port is 7301; if it's in use, the server tries the next
      19 ports automatically.
    `,
    examples: [
      ['Open the docs in the browser', '$0 docs'],
      ['Serve on a specific port', '$0 docs --port 8080'],
      ['Serve without opening a browser', '$0 docs --no-open'],
    ],
  });

  port = Option.String('--port', '7301', {
    description: 'Preferred port. Falls through to next available if busy.',
  });

  open = Option.Boolean('--open', true, {
    description:
      'Open the URL in the default browser. Use --no-open to skip.',
  });

  async execute(): Promise<number> {
    const portNum = Number.parseInt(this.port, 10);
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      consola.error(`Invalid port: ${this.port}`);
      return 1;
    }

    let handle;
    try {
      handle = await startDocsServer({ port: portNum, open: this.open });
    } catch (err) {
      consola.error((err as Error).message);
      return 1;
    }

    console.log();
    consola.success(`Docs serving at ${handle.url}`);
    console.log('  Press Ctrl+C to stop.');
    console.log();

    /* Wait for SIGINT, then close cleanly. */
    await new Promise<void>((resolve) => {
      const onSig = () => {
        process.off('SIGINT', onSig);
        process.off('SIGTERM', onSig);
        resolve();
      };
      process.on('SIGINT', onSig);
      process.on('SIGTERM', onSig);
    });

    await handle.close();
    console.log();
    consola.info('Docs server stopped.');
    return 0;
  }
}
