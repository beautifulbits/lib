import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runCouplings } from '../init/couplings.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — COUPLINGS                              */
/* ========================================================================== */

export class CouplingsCliResolver {
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
    let outDir = '__gen__/lib-couplings';
    let dryRun = false;
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Generate report for just one library? (No = all libraries)',
        initial: false,
      }).run();

      if (single) {
        const entered = await new Input({
          name: 'name',
          message: 'Library name:',
        }).run();
        name = entered || undefined;
      }

      const useDefaultOut = await new Confirm({
        name: 'default-out',
        message: 'Write reports to default location (__gen__/lib-couplings/)?',
        initial: true,
      }).run();
      if (!useDefaultOut) {
        const entered = await new Input({
          name: 'out',
          message: 'Output directory (host-relative):',
          initial: '__gen__/lib-couplings',
        }).run();
        outDir = entered || outDir;
      }

      dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run? (compute without writing)',
        initial: false,
      }).run();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    const result = await runCouplings({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name,
      outDir,
      dryRun,
    });

    console.log();
    if (!result.ok) {
      consola.error(result.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    const cwd = process.cwd();
    console.log(`output: ${path.relative(cwd, result.outDir) || '.'}`);
    if (dryRun) console.log('(dry-run, nothing written)');
    console.log();

    const sorted = [...result.reports].sort(
      (a, b) =>
        b.totalCouplings - a.totalCouplings || a.name.localeCompare(b.name),
    );
    for (const r of sorted) {
      const status = dryRun ? 'would write' : r.written ? 'wrote' : 'unchanged';
      console.log(
        `  ${status.padEnd(11)} @${r.name.padEnd(24)} ` +
          `(${r.totalCouplings} couplings, ${r.fixableCouplings} fixable)`,
      );
    }

    const totalCouplings = result.reports.reduce(
      (n, r) => n + r.totalCouplings,
      0,
    );
    const totalFixable = result.reports.reduce(
      (n, r) => n + r.fixableCouplings,
      0,
    );
    const totalWritten = result.reports.filter((r) => r.written).length;

    console.log();
    consola.success(
      `${result.reports.length} librar${result.reports.length === 1 ? 'y' : 'ies'} processed — ` +
        `${totalCouplings} coupling${totalCouplings === 1 ? '' : 's'} ` +
        `(${totalFixable} fixable), ${dryRun ? 0 : totalWritten} written`,
    );
    if (!dryRun && totalWritten > 0) {
      console.log(
        `see ${path.relative(cwd, result.outDir).replace(/\\/g, '/') || '.'}/README.md for the index`,
      );
    }

    console.log();
    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
