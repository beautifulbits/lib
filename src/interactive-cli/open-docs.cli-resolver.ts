import enquirer from 'enquirer';
import consola from 'consola';

import { startDocsServer } from '../docs-server/index.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — OPEN DOCS                              */
/* ========================================================================== */

export class OpenDocsCliResolver {
  mainCommandsCliResolver?: MainCommandsCliResolver;

  init({
    mainCommandsCliResolver,
  }: {
    mainCommandsCliResolver: MainCommandsCliResolver;
  }) {
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  async resolve(): Promise<void> {
    let openInBrowser = true;
    try {
      openInBrowser = await new Confirm({
        name: 'open',
        message: 'Open in default browser when ready?',
        initial: true,
      }).run();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    let handle;
    try {
      handle = await startDocsServer({ open: openInBrowser });
    } catch (err) {
      consola.error((err as Error).message);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    console.log();
    consola.success(`Docs serving at ${handle.url}`);
    console.log('  Press Ctrl+C to stop and return to the menu.');
    console.log();

    await new Promise<void>((resolve) => {
      const onSig = () => {
        process.off('SIGINT', onSig);
        resolve();
      };
      process.on('SIGINT', onSig);
    });

    await handle.close();
    console.log();
    consola.info('Docs server stopped.');

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
