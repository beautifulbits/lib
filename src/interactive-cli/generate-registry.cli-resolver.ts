import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runGenerateRegistry } from '../contributions/registry.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — GENERATE-REGISTRY                      */
/* ========================================================================== */

export class GenerateRegistryCliResolver {
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

    try {
      const dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run first? (preview without writing)',
        initial: true,
      }).run();

      const result = await runGenerateRegistry({
        hostRoot,
        localLibraryPath,
        dryRun,
      });

      console.log();
      if (!result.ok) {
        consola.error(result.error);
        await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
        return;
      }

      const relRegistry = path.relative(hostRoot, result.registryPath);
      console.log(
        `registry: ${relRegistry} — ` +
          (result.isNew
            ? dryRun
              ? 'would be created'
              : 'created'
            : result.willChange
              ? dryRun
                ? 'would be updated'
                : 'updated'
              : 'already up to date'),
      );
      console.log();
      console.log('contributors:');
      if (result.contributors.length === 0) {
        console.log('  (none — registry is empty)');
      } else {
        for (const c of result.contributors) {
          const tags = [
            c.contributesI18n ? 'i18n' : null,
            c.contributesTailwindPlugin ? 'tailwind' : null,
          ]
            .filter(Boolean)
            .join(', ');
          console.log(`  + @${c.name} (${tags})`);
        }
      }
      console.log();

      if (dryRun && result.willChange) {
        const applyNow = await new Confirm({
          name: 'apply',
          message: 'Write the registry now?',
          initial: false,
        }).run();
        if (applyNow) {
          await runGenerateRegistry({
            hostRoot,
            localLibraryPath,
            dryRun: false,
          });
          consola.success('Registry written.');
        }
      }
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
