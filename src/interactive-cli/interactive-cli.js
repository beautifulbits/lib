import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';
import { LocalPackagesListingCliResolver } from './local-packages-listing.cli-resolver.js';
import { PackagePublishingCliResolver } from './package-publishing.cli-resolver.js';
import { RemotePackageLatestVersionCliResolver } from './remote-package-latest-version.cli-resolver.js';

/* ========================================================================== */
/*                               INTERACTIVE CLI                              */
/* ========================================================================== */
export class InteractiveCli {
  /* ------------------------------------------------------------------------ */
  constructor({ verbose = true, localLibrary, remoteLibrary }) {
    const mainCommandsCliPrompt = new MainCommandsCliPrompt();
    const mainCommandsCliResolver = new MainCommandsCliResolver();
    const localPackagesListingCliResolver =
      new LocalPackagesListingCliResolver();
    const packagePublishingCliResolver = new PackagePublishingCliResolver();
    const remotePackageLatestVersionCliResolver =
      new RemotePackageLatestVersionCliResolver();

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
