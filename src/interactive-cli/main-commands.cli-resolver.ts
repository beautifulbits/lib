import {
  INTERACTIVE_CLI_COMMANDS,
  UNPUBLISHED_VERSION,
} from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import { LocalPackagesListingCliResolver } from './local-packages-listing.cli-resolver.js';
import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { PackagePublishingCliResolver } from './package-publishing.cli-resolver.js';
import { RemotePackageLatestVersionCliResolver } from './remote-package-latest-version.cli-resolver.js';

/* ========================================================================== */
/*                         MAIN COMMANDS CLI RESOLVER                         */
/* ========================================================================== */
export class MainCommandsCliResolver {
  verbose: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  remotePackageLatestVersionCliResolver: RemotePackageLatestVersionCliResolver;
  packagePublishingCliResolver: PackagePublishingCliResolver;
  localPackagesListingCliResolver: LocalPackagesListingCliResolver;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    mainCommandsCliPrompt,
    remotePackageLatestVersionCliResolver,
    packagePublishingCliResolver,
    localPackagesListingCliResolver,
  }) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.remotePackageLatestVersionCliResolver =
      remotePackageLatestVersionCliResolver;
    this.packagePublishingCliResolver = packagePublishingCliResolver;
    this.localPackagesListingCliResolver = localPackagesListingCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveMainCommandsPrompt() {
    const selectPrompt =
      await this.mainCommandsCliPrompt.getMainCommandsPrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.listInstalledPackages:
            this.localPackagesListingCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.listRemotePackages:
            await this.remoteLibrary.showRemotePackagesAsTable();
            this.resolveMainCommandsPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.publishPackage:
            this.packagePublishingCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.getRemotePackageLatestVersion:
            this.remotePackageLatestVersionCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            process.exit();
        }
      })
      .catch(promptErrorHandler);
  }
}