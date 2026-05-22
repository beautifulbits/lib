import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runMigrateContributionTypes } from '../contributions/migrate-types.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input } = enquirer;

/* ========================================================================== */
/*                  INTERACTIVE — MIGRATE-CONTRIBUTION-TYPES                  */
/* ========================================================================== */

export class MigrateContributionTypesCliResolver {
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

    let name: string | undefined;
    let dryRun = true;
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Migrate just one library? (No = all contributors)',
        initial: false,
      }).run();
      if (single) {
        const entered = await new Input({
          name: 'name',
          message: 'Library name:',
        }).run();
        name = entered || undefined;
      }
      dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run first? (preview without writing)',
        initial: true,
      }).run();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    const result = await runMigrateContributionTypes({
      hostRoot,
      localLibraryPath,
      name,
      dryRun,
    });

    console.log();
    if (!result.ok) {
      consola.error(result.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let warned = 0;
    for (const c of result.changes) {
      let sigil = '·';
      if (c.kind === 'migrate') {
        sigil = '↻';
        migrated++;
      } else if (c.kind === 'skip-customized') {
        sigil = '!';
        warned++;
      } else {
        skipped++;
      }
      const file = c.file ? `  ${c.file}` : '';
      const msg = c.message ? `  — ${c.message}` : '';
      console.log(`  ${sigil} @${c.lib}${file}${msg}`);
    }
    console.log();
    const verb = dryRun ? 'would migrate' : 'migrated';
    console.log(
      `${migrated} ${verb}; ${skipped} skipped; ${warned} warning${warned === 1 ? '' : 's'}`,
    );
    console.log();

    if (dryRun && migrated > 0) {
      try {
        const applyNow = await new Confirm({
          name: 'apply',
          message: 'Apply the migration now?',
          initial: false,
        }).run();
        if (applyNow) {
          await runMigrateContributionTypes({
            hostRoot,
            localLibraryPath,
            name,
            dryRun: false,
          });
          consola.success('Migrated.');
        }
      } catch (err) {
        promptErrorHandler(err);
        return;
      }
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
