import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runValidateContributions } from '../contributions/validate.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — VALIDATE-CONTRIBUTIONS                 */
/* ========================================================================== */

export class ValidateContributionsCliResolver {
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
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Validate just one library? (No = all libraries)',
        initial: false,
      }).run();

      if (single) {
        const entered = await new Input({
          name: 'name',
          message: 'Library name:',
        }).run();
        name = entered || undefined;
      }
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    const result = await runValidateContributions({
      hostRoot,
      localLibraryPath,
      name,
    });

    console.log();
    if (!result.ok) {
      consola.error(result.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    let totalErrors = 0;
    let totalWarnings = 0;
    let cleanLibs = 0;
    for (const r of result.reports) {
      const errors = r.issues.filter((i) => i.kind === 'error');
      const warnings = r.issues.filter((i) => i.kind === 'warn');
      totalErrors += errors.length;
      totalWarnings += warnings.length;
      if (errors.length === 0 && warnings.length === 0) {
        cleanLibs++;
        console.log(`  ✓ @${r.name} — ok`);
        continue;
      }
      console.log(`@${r.name}`);
      for (const i of r.issues) {
        const sigil = i.kind === 'error' ? '✗' : '!';
        const file = i.file ? `  (${i.file})` : '';
        console.log(`  ${sigil} ${i.message}${file}`);
      }
    }
    console.log();
    console.log(
      `${result.reports.length} processed; ${cleanLibs} clean; ` +
        `${totalErrors} error${totalErrors === 1 ? '' : 's'}; ` +
        `${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`,
    );
    console.log();

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
