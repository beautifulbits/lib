import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runAddContribution } from '../contributions/scaffold.js';
import { discoverAllLibraries } from '../contributions/discover.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Select } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — ADD-CONTRIBUTION                       */
/* ========================================================================== */

export class AddContributionCliResolver {
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

    const hostRoot = process.cwd();
    const localLibraryPath = path.join(hostRoot, sharedCfg.localLibraryPath);

    let libs;
    try {
      libs = await discoverAllLibraries(localLibraryPath);
    } catch (err) {
      consola.error((err as Error).message);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    if (libs.length === 0) {
      consola.warn('No libraries found under ' + localLibraryPath);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    try {
      const libname = await new Select({
        name: 'libname',
        message: 'Select library to scaffold:',
        choices: libs.map((l) => l.cfg.name),
      }).run();

      const withTailwindPlugin = await new Confirm({
        name: 'tw',
        message: 'Also scaffold a tailwind plugin entry?',
        initial: false,
      }).run();

      const dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run first? (preview without writing)',
        initial: true,
      }).run();

      const target = libs.find((l) => l.cfg.name === libname);
      if (!target) {
        consola.error(`Library "${libname}" not found.`);
        await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
        return;
      }

      const result = await runAddContribution({
        libDir: target.libDir,
        withTailwindPlugin,
        dryRun,
      });

      console.log();
      if (!result.ok) {
        consola.error(result.error);
        await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
        return;
      }

      console.log(`@${result.name}`);
      for (const c of result.changes) {
        const sigil = c.kind === 'add' ? '+' : c.kind === 'skip' ? '·' : '!';
        console.log(`  ${sigil} ${c.file}${c.message ? ' — ' + c.message : ''}`);
      }
      console.log();

      if (dryRun && result.changes.some((c) => c.kind === 'add')) {
        const applyNow = await new Confirm({
          name: 'apply',
          message: 'Apply these changes now?',
          initial: false,
        }).run();
        if (applyNow) {
          await runAddContribution({
            libDir: target.libDir,
            withTailwindPlugin,
            dryRun: false,
          });
          consola.success('Applied.');
        }
      }
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
