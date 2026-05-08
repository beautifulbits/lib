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
  initProjectCliResolver: InitProjectCliResolver;
  initLibraryCliResolver: InitLibraryCliResolver;
  syncHostCliResolver: SyncHostCliResolver;
  showUsageCliResolver: ShowUsageCliResolver;
  openDocsCliResolver: OpenDocsCliResolver;
  upgradeCfgCliResolver: UpgradeCfgCliResolver;
  detectDepsCliResolver: DetectDepsCliResolver;
  installDepsCliResolver: InstallDepsCliResolver;
  couplingsCliResolver: CouplingsCliResolver;
  bulkInstallCliResolver: BulkInstallCliResolver;
  bulkPublishCliResolver: BulkPublishCliResolver;
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
  initProjectCliResolver?: InitProjectCliResolver;
  initLibraryCliResolver?: InitLibraryCliResolver;
  syncHostCliResolver?: SyncHostCliResolver;
  showUsageCliResolver?: ShowUsageCliResolver;
  openDocsCliResolver?: OpenDocsCliResolver;
  upgradeCfgCliResolver?: UpgradeCfgCliResolver;
  detectDepsCliResolver?: DetectDepsCliResolver;
  installDepsCliResolver?: InstallDepsCliResolver;
  couplingsCliResolver?: CouplingsCliResolver;
  bulkInstallCliResolver?: BulkInstallCliResolver;
  bulkPublishCliResolver?: BulkPublishCliResolver;

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
    this.initProjectCliResolver = initProjectCliResolver;
    this.initLibraryCliResolver = initLibraryCliResolver;
    this.syncHostCliResolver = syncHostCliResolver;
    this.showUsageCliResolver = showUsageCliResolver;
    this.openDocsCliResolver = openDocsCliResolver;
    this.upgradeCfgCliResolver = upgradeCfgCliResolver;
    this.detectDepsCliResolver = detectDepsCliResolver;
    this.installDepsCliResolver = installDepsCliResolver;
    this.couplingsCliResolver = couplingsCliResolver;
    this.bulkInstallCliResolver = bulkInstallCliResolver;
    this.bulkPublishCliResolver = bulkPublishCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveMainCommandsPrompt() {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt = await this.mainCommandsCliPrompt.mainCommandsPrompt();

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
          case INTERACTIVE_CLI_COMMANDS.initProject:
            await this.initProjectCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.initLibrary:
            await this.initLibraryCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.syncHost:
            await this.syncHostCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.showUsage:
            await this.showUsageCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.openDocs:
            await this.openDocsCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.upgradeCfg:
            await this.upgradeCfgCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.detectDeps:
            await this.detectDepsCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.installDeps:
            await this.installDepsCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.couplings:
            await this.couplingsCliResolver?.resolve();
            break;

          case INTERACTIVE_CLI_COMMANDS.listInstalledPackages:
            await this.localPackagesListingCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.listRemotePackages:
            await this.remoteLibrary.showRemotePackagesAsTable();
            await this.resolveMainCommandsPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.publishPackage:
            await this.packagePublishingCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.getRemotePackageLatestVersion:
            await this.remotePackageLatestVersionCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.installPackage:
            await this.installPackageCliResolver.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.installMultiplePackages:
            await this.bulkInstallCliResolver?.resolveBulkInstallPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.publishMultiplePackages:
            await this.bulkPublishCliResolver?.resolveBulkPublishPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.compareInstalledPackageWithRemote:
            await this.packageDiffingCliResolver?.resolveSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            process.exit();
        }
      })
      .catch(promptErrorHandler);
  }
}
