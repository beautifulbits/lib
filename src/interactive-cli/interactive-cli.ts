import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';
import { LocalPackagesListingCliResolver } from './local-packages-listing.cli-resolver.js';
import { PackagePublishingCliResolver } from './package-publishing.cli-resolver.js';
import { RemotePackageLatestVersionCliResolver } from './remote-package-latest-version.cli-resolver.js';
import { LocalLibrary } from '../local-library';
import { RemoteLibrary } from '../remote-library';
import { InstallPackageCliResolver } from './install-package.cli-resolver.js';

interface IInteractiveCli {
  verbose: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
}

/* ========================================================================== */
/*                               INTERACTIVE CLI                              */
/* ========================================================================== */
export class InteractiveCli {
  mainCommandsCliResolver: MainCommandsCliResolver;

  /* ------------------------------------------------------------------------ */
  constructor({
    verbose = true,
    localLibrary,
    remoteLibrary,
  }: IInteractiveCli) {
    const mainCommandsCliPrompt = new MainCommandsCliPrompt();
    const mainCommandsCliResolver = new MainCommandsCliResolver();
    const localPackagesListingCliResolver =
      new LocalPackagesListingCliResolver();
    const packagePublishingCliResolver = new PackagePublishingCliResolver();
    const remotePackageLatestVersionCliResolver =
      new RemotePackageLatestVersionCliResolver();
    const installPackageCliResolver = new InstallPackageCliResolver();

    mainCommandsCliPrompt.init({
      verbose,
      localLibrary,
      remoteLibrary,
    });

    mainCommandsCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      localPackagesListingCliResolver,
      packagePublishingCliResolver,
      remotePackageLatestVersionCliResolver,
      installPackageCliResolver,
    });

    localPackagesListingCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
    });

    packagePublishingCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
    });

    installPackageCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
    });

    remotePackageLatestVersionCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
    });

    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async init() {
    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
  }
}
