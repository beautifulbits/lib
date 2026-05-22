import { Command } from 'clipanion';
import consola from 'consola';

import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { InteractiveCli } from '../interactive-cli/interactive-cli.js';
import { PackageFileGenerator } from '../package-file-generator.js';
import { PackageDiffing } from '../package-diffing.js';
import { GetConfig } from '../get-config.js';
import { UsageRegistry } from '../usage-registry/index.js';

/* ========================================================================== */
/*                          INTERACTIVE — DEFAULT COMMAND                     */
/* ========================================================================== */

/**
 * Launches the interactive menu (existing behavior). This is the default
 * command — running `lib` with no arguments lands here.
 */
export class InteractiveCommand extends Command {
  static override paths = [Command.Default];

  static override usage = Command.Usage({
    description: 'Launch the interactive shared-library menu',
    details: `
      With no arguments, opens an interactive menu for browsing libraries,
      publishing, installing, diffing against the remote library, and so on.
      All sub-commands of @beautifulbits/lib are also available as direct
      flags — see \`lib --help\`.
    `,
  });

  async execute(): Promise<number> {
    const getConfig = new GetConfig();
    const config = await getConfig.load();

    if (!config) {
      consola.error(
        'No sharedlib.cfg found in current directory — cannot start.',
      );
      return 1;
    }

    const { remoteLibraryPath, localLibraryPath } = config;

    const packageFileGenerator = new PackageFileGenerator({ verbose: false });
    const remoteLibrary = new RemoteLibrary();
    const localLibrary = new LocalLibrary();
    const packageDiffing = new PackageDiffing();
    const usageRegistry = new UsageRegistry(remoteLibraryPath);

    remoteLibrary.init({
      path: remoteLibraryPath,
      packageFileGenerator,
      verbose: false,
      localLibrary,
    });

    localLibrary.init({
      localLibraryDirectory: localLibraryPath,
      verbose: false,
      packageFileGenerator,
      remoteLibrary,
      usageRegistry,
    });

    packageDiffing.init({
      localLibrary,
      remoteLibrary,
    });

    const interactiveCli = new InteractiveCli({
      verbose: false,
      localLibrary,
      remoteLibrary,
      packageDiffing,
    });

    interactiveCli.init();
    return 0;
  }
}
