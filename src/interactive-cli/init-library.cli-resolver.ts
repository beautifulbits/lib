import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runLibInit } from '../init/lib-init.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Input, Confirm } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — INIT LIBRARY                           */
/* ========================================================================== */

export class InitLibraryCliResolver {
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
      const name = await new Input({
        name: 'name',
        message: 'Library name (kebab-case, e.g. "schematic"):',
      }).run();

      const description = await new Input({
        name: 'description',
        message: 'One-line description (or leave blank):',
      }).run();

      const aliasInitial = name ? `@${name}` : '';
      const alias = await new Input({
        name: 'alias',
        message: 'Path-alias prefix:',
        initial: aliasInitial,
      }).run();

      const library = await new Input({
        name: 'library',
        message: 'Library grouping:',
        initial: 'frameworks',
      }).run();

      const collection = await new Input({
        name: 'collection',
        message: 'Collection grouping:',
        initial: 'general',
      }).run();

      const withClaudeMd = await new Confirm({
        name: 'with-claude-md',
        message: 'Also scaffold a CLAUDE.md placeholder (if absent)?',
        initial: false,
      }).run();

      const result = await runLibInit({
        hostRoot: process.cwd(),
        localLibraryPath: sharedCfg.localLibraryPath,
        name,
        description: description || undefined,
        alias: alias || undefined,
        library,
        collection,
        withClaudeMd,
      });

      console.log();
      if (!result.ok) {
        consola.error(result.error);
      } else {
        const verb = result.dirExisted ? 'Wired up existing' : 'Created';
        consola.success(
          `${verb} ${result.libRoot} (alias ${result.alias})`,
        );
        const cwd = process.cwd();
        for (const f of result.filesWritten ?? []) {
          console.log('  + ' + path.relative(cwd, f));
        }
        for (const f of result.filesSkipped ?? []) {
          console.log('  · ' + path.relative(cwd, f) + ' (left alone, already existed)');
        }
      }
      console.log();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
