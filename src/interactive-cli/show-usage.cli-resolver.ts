import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { UsageRegistry } from '../usage-registry/index.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

/* ========================================================================== */
/*                       INTERACTIVE — SHOW USAGE                             */
/* ========================================================================== */

export class ShowUsageCliResolver {
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
      const registry = new UsageRegistry(sharedCfg.remoteLibraryPath);
      const data = await registry.load();

      console.log();
      console.log(bold('Usage registry') + dim(`  (updated ${data.updatedAt || 'never'})`));
      console.log();

      const projectCount = Object.keys(data.projects).length;
      const libraryCount = Object.keys(data.libraries).length;

      if (projectCount === 0 && libraryCount === 0) {
        console.log(dim('  (registry is empty)'));
        console.log();
      } else {
        console.log(bold(`Projects (${projectCount})`));
        for (const [name, project] of sortedEntries(data.projects)) {
          const libs = Object.keys(project.libraries).length;
          console.log(`  ${name} ${dim('— ' + libs + ' lib' + (libs === 1 ? '' : 's'))}`);
        }
        console.log();

        console.log(bold(`Libraries (${libraryCount})`));
        for (const [name, lib] of sortedEntries(data.libraries)) {
          const consumers = lib.consumers.length;
          console.log(
            `  ${name}@${lib.currentVersion} ${dim('— ' + consumers + ' consumer' + (consumers === 1 ? '' : 's'))}`,
          );
        }
        console.log();
      }
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);

function sortedEntries<T>(o: Record<string, T>): Array<[string, T]> {
  return Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
}
