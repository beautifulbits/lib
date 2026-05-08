import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runUpgradeLibCfg } from '../init/upgrade-lib-cfg.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — UPGRADE-CFG                            */
/* ========================================================================== */

export class UpgradeCfgCliResolver {
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

    let name: string | undefined;
    let dryRun = true;
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Upgrade just one library? (No = all libraries)',
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

    const result = await runUpgradeLibCfg({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name,
      dryRun,
    });

    console.log();
    if (!result.ok) {
      consola.error(result.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    const cwd = process.cwd();
    const changed = result.reports.filter((r) => r.changed);
    const errored = result.reports.filter((r) => r.error);
    const total = result.reports.length;

    if (dryRun) {
      console.log('mode: dry-run — no files were written');
      console.log();
    }

    for (const r of errored) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    if (errored.length > 0) console.log();

    for (const r of changed) {
      console.log(`@${r.name} — ${path.relative(cwd, r.cfgPath)}`);
      for (const field of r.fieldsAdded) {
        console.log(`  + ${field} ${dryRun ? '(would add)' : '(added)'}`);
      }
      console.log();
    }

    consola.success(
      `${total} librar${total === 1 ? 'y' : 'ies'} processed — ` +
        `${changed.length} ${dryRun ? 'would be updated' : 'updated'}`,
    );

    /* if dry-run produced changes, offer to apply */
    if (dryRun && changed.length > 0) {
      try {
        const applyNow = await new Confirm({
          name: 'apply',
          message: 'Apply these changes now?',
          initial: false,
        }).run();
        if (applyNow) {
          const applied = await runUpgradeLibCfg({
            hostRoot: process.cwd(),
            localLibraryPath: sharedCfg.localLibraryPath,
            name,
            dryRun: false,
          });
          console.log();
          consola.success(
            `Applied to ${applied.reports.filter((r) => r.changed).length} librar${changed.length === 1 ? 'y' : 'ies'}.`,
          );
        }
      } catch (err) {
        promptErrorHandler(err);
        return;
      }
    }

    console.log();
    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
