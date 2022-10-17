import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';
import { LocalPackagesListingCliResolver } from './local-packages-listing.cli-resolver.js';
import { PackagePublishingCliResolver } from './package-publishing.cli-resolver.js';
import { RemotePackageLatestVersionCliResolver } from './remote-package-latest-version.cli-resolver.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { InstallPackageCliResolver } from './install-package.cli-resolver.js';
import { PackageDiffingCliResolver } from './package-diffing.cli-resolver.js';
import { PackageDiffing } from '../package-diffing.js';

interface IInteractiveCli {
  verbose: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  packageDiffing: PackageDiffing;
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
    packageDiffing,
  }: IInteractiveCli) {
    // Instantiate prompts
    const mainCommandsCliPrompt = new MainCommandsCliPrompt();

    // Instantiate prompt resolvers
    const mainCommandsCliResolver = new MainCommandsCliResolver();
    const localPackagesListingCliResolver =
      new LocalPackagesListingCliResolver();
    const packagePublishingCliResolver = new PackagePublishingCliResolver();
    const remotePackageLatestVersionCliResolver =
      new RemotePackageLatestVersionCliResolver();
    const installPackageCliResolver = new InstallPackageCliResolver();
    const packageDiffingCliResolver = new PackageDiffingCliResolver();

    // Init class singletons
    // Done this way since the classes have circular dependencies
    // with each other
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
      packageDiffingCliResolver,
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

    packageDiffingCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
      packageDiffing,
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
