import { INTERACTIVE_CLI_COMMANDS } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                         MAIN COMMANDS CLI RESOLVER                         */
/* ========================================================================== */
export class MainCommandsCliResolver {
    verbose;
    localLibrary;
    remoteLibrary;
    mainCommandsCliPrompt;
    remotePackageLatestVersionCliResolver;
    packagePublishingCliResolver;
    localPackagesListingCliResolver;
    installPackageCliResolver;
    packageDiffingCliResolver;
    initProjectCliResolver;
    initLibraryCliResolver;
    syncHostCliResolver;
    showUsageCliResolver;
    openDocsCliResolver;
    upgradeCfgCliResolver;
    detectDepsCliResolver;
    installDepsCliResolver;
    couplingsCliResolver;
    bulkInstallCliResolver;
    bulkPublishCliResolver;
    /* ------------------------------------------------------------------------ */
    init({ verbose = true, localLibrary, remoteLibrary, mainCommandsCliPrompt, remotePackageLatestVersionCliResolver, packagePublishingCliResolver, localPackagesListingCliResolver, installPackageCliResolver, packageDiffingCliResolver, initProjectCliResolver, initLibraryCliResolver, syncHostCliResolver, showUsageCliResolver, openDocsCliResolver, upgradeCfgCliResolver, detectDepsCliResolver, installDepsCliResolver, couplingsCliResolver, bulkInstallCliResolver, bulkPublishCliResolver, }) {
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
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = await this.mainCommandsCliPrompt.mainCommandsPrompt();
        await selectPrompt
            .run()
            .then(async (answer) => {
            if (!this.mainCommandsCliPrompt)
                return;
            if (!this.localPackagesListingCliResolver)
                return;
            if (!this.remoteLibrary)
                return;
            if (!this.packagePublishingCliResolver)
                return;
            if (!this.remotePackageLatestVersionCliResolver)
                return;
            if (!this.installPackageCliResolver)
                return;
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
//# sourceMappingURL=main-commands.cli-resolver.js.map