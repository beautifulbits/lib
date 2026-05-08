import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runSync } from '../host-sync/orchestrator.js';
import { printSyncReport } from '../host-sync/print-report.js';
import { UsageRegistry } from '../usage-registry/index.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm } = enquirer;

/* ========================================================================== */
/*                          INTERACTIVE — SYNC HOST                           */
/* ========================================================================== */

export class SyncHostCliResolver {
  mainCommandsCliResolver?: MainCommandsCliResolver;

  init({
    mainCommandsCliResolver,
  }: {
    mainCommandsCliResolver: MainCommandsCliResolver;
  }) {
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  async resolve(): Promise<void> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run "Init project" first.',
      );
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    try {
      const dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run? (preview changes; nothing will be written)',
        initial: true,
      }).run();

      const hostRoot = process.cwd();
      const localLibraryPath = path.join(hostRoot, sharedCfg.localLibraryPath);
      const usageRegistry = new UsageRegistry(sharedCfg.remoteLibraryPath);

      const report = await runSync({
        hostRoot,
        localLibraryPath,
        dryRun,
        usageRegistry,
      });

      printSyncReport(report);
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
