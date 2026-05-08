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
import { InitProjectCliResolver } from './init-project.cli-resolver.js';
import { InitLibraryCliResolver } from './init-library.cli-resolver.js';
import { SyncHostCliResolver } from './sync-host.cli-resolver.js';
import { ShowUsageCliResolver } from './show-usage.cli-resolver.js';
import { OpenDocsCliResolver } from './open-docs.cli-resolver.js';
import { UpgradeCfgCliResolver } from './upgrade-cfg.cli-resolver.js';
import { DetectDepsCliResolver } from './detect-deps.cli-resolver.js';
import { InstallDepsCliResolver } from './install-deps.cli-resolver.js';
import { CouplingsCliResolver } from './couplings.cli-resolver.js';
import { BulkInstallCliResolver } from './bulk-install.cli-resolver.js';
import { BulkPublishCliResolver } from './bulk-publish.cli-resolver.js';

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
    const initProjectCliResolver = new InitProjectCliResolver();
    const initLibraryCliResolver = new InitLibraryCliResolver();
    const syncHostCliResolver = new SyncHostCliResolver();
    const showUsageCliResolver = new ShowUsageCliResolver();
    const openDocsCliResolver = new OpenDocsCliResolver();
    const upgradeCfgCliResolver = new UpgradeCfgCliResolver();
    const detectDepsCliResolver = new DetectDepsCliResolver();
    const installDepsCliResolver = new InstallDepsCliResolver();
    const couplingsCliResolver = new CouplingsCliResolver();
    const bulkInstallCliResolver = new BulkInstallCliResolver();
    const bulkPublishCliResolver = new BulkPublishCliResolver();

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
      initProjectCliResolver,
      initLibraryCliResolver,
      syncHostCliResolver,
      showUsageCliResolver,
      openDocsCliResolver,
      upgradeCfgCliResolver,
      detectDepsCliResolver,
      installDepsCliResolver,
      couplingsCliResolver,
      bulkInstallCliResolver,
      bulkPublishCliResolver,
    });

    initProjectCliResolver.init({ mainCommandsCliResolver });
    initLibraryCliResolver.init({ mainCommandsCliResolver });
    syncHostCliResolver.init({ mainCommandsCliResolver });
    showUsageCliResolver.init({ mainCommandsCliResolver });
    openDocsCliResolver.init({ mainCommandsCliResolver });
    upgradeCfgCliResolver.init({ mainCommandsCliResolver });
    detectDepsCliResolver.init({ mainCommandsCliResolver });
    installDepsCliResolver.init({ mainCommandsCliResolver });
    couplingsCliResolver.init({ mainCommandsCliResolver });

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

    bulkInstallCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      mainCommandsCliPrompt,
      mainCommandsCliResolver,
    });

    bulkPublishCliResolver.init({
      verbose,
      localLibrary,
      remoteLibrary,
      packageDiffing,
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
