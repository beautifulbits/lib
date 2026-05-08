import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { runProjectInit } from '../init/project-init.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore — enquirer's typings don't expose Input/Confirm by default
const { Input, Confirm } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — INIT PROJECT                           */
/* ========================================================================== */

export class InitProjectCliResolver {
  mainCommandsCliResolver?: MainCommandsCliResolver;

  init({
    mainCommandsCliResolver,
  }: {
    mainCommandsCliResolver: MainCommandsCliResolver;
  }) {
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  async resolve(): Promise<void> {
    try {
      const remote = await new Input({
        name: 'remote',
        message: 'Path to the centralized remote library (must already exist):',
      }).run();

      const local = await new Input({
        name: 'local',
        message: 'Project-relative path for synced libraries:',
        initial: '/src/lib',
      }).run();

      const force = await new Confirm({
        name: 'force',
        message: 'Overwrite an existing sharedlib.cfg if present?',
        initial: false,
      }).run();

      const result = await runProjectInit({
        hostRoot: process.cwd(),
        remoteLibraryPath: remote,
        localLibraryPath: local,
        force,
      });

      console.log();
      if (!result.ok) {
        consola.error(result.error);
      } else {
        consola.success(
          `${result.sharedCfgExisted ? 'Updated' : 'Created'} ${path.relative(process.cwd(), result.sharedCfgPath ?? '')} ` +
            `and ${result.localLibExisted ? 'verified' : 'created'} ${path.relative(process.cwd(), result.localLibAbsPath ?? '')}.`,
        );
      }
      console.log();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
