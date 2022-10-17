import { INTERACTIVE_CLI_COMMANDS } from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { InstallPackageCliResolver } from './install-package.cli-resolver.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import { LocalPackagesListingCliResolver } from './local-packages-listing.cli-resolver.js';
import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { PackagePublishingCliResolver } from './package-publishing.cli-resolver.js';
import { RemotePackageLatestVersionCliResolver } from './remote-package-latest-version.cli-resolver.js';
import { PackageDiffingCliResolver } from './package-diffing.cli-resolver.js';

/* ================================ INTERFACE =============================== */
interface IMainCommandsCliResolverInitFn {
  verbose?: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  remotePackageLatestVersionCliResolver: RemotePackageLatestVersionCliResolver;
  packagePublishingCliResolver: PackagePublishingCliResolver;
  localPackagesListingCliResolver: LocalPackagesListingCliResolver;
  installPackageCliResolver: InstallPackageCliResolver;
  packageDiffingCliResolver: PackageDiffingCliResolver;
}

/* ========================================================================== */
/*                         MAIN COMMANDS CLI RESOLVER                         */
/* ========================================================================== */
export class MainCommandsCliResolver {
  verbose?: boolean;
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;
  mainCommandsCliPrompt?: MainCommandsCliPrompt;
  remotePackageLatestVersionCliResolver?: RemotePackageLatestVersionCliResolver;
  packagePublishingCliResolver?: PackagePublishingCliResolver;
  localPackagesListingCliResolver?: LocalPackagesListingCliResolver;
  installPackageCliResolver?: InstallPackageCliResolver;
  packageDiffingCliResolver?: PackageDiffingCliResolver;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    mainCommandsCliPrompt,
    remotePackageLatestVersionCliResolver,
    packagePublishingCliResolver,
    localPackagesListingCliResolver,
    installPackageCliResolver,
    packageDiffingCliResolver,
  }: IMainCommandsCliResolverInitFn) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.remotePackageLatestVersionCliResolver =
      remotePackageLatestVersionCliResolver;
    this.packagePublishingCliResolver = packagePublishingCliResolver;
    this.localPackagesListingCliResolver = localPackagesListingCliResolver;
    this.installPackageCliResolver = installPackageCliResolver;
    this.packageDiffingCliResolver = packageDiffingCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveMainCommandsPrompt() {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.getMainCommandsPrompt();

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliPrompt) return;
        if (!this.localPackagesListingCliResolver) return;
        if (!this.remoteLibrary) return;
        if (!this.packagePublishingCliResolver) return;
        if (!this.remotePackageLatestVersionCliResolver) return;
        if (!this.installPackageCliResolver) return;

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

          case INTERACTIVE_CLI_COMMANDS.installPackage:
            this.installPackageCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.compareInstalledPackageWithRemote:
            this.packageDiffingCliResolver?.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            process.exit();
        }
      })
      .catch(promptErrorHandler);
  }
}
