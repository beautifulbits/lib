import { INTERACTIVE_CLI_COMMANDS } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                         MAIN COMMANDS CLI RESOLVER                         */
/* ========================================================================== */
export class MainCommandsCliResolver {
    /* ------------------------------------------------------------------------ */
    init({ verbose = true, localLibrary, remoteLibrary, mainCommandsCliPrompt, remotePackageLatestVersionCliResolver, packagePublishingCliResolver, localPackagesListingCliResolver, installPackageCliResolver, }) {
        this.verbose = verbose;
        this.localLibrary = localLibrary;
        this.remoteLibrary = remoteLibrary;
        this.mainCommandsCliPrompt = mainCommandsCliPrompt;
        this.remotePackageLatestVersionCliResolver =
            remotePackageLatestVersionCliResolver;
        this.packagePublishingCliResolver = packagePublishingCliResolver;
        this.localPackagesListingCliResolver = localPackagesListingCliResolver;
        this.installPackageCliResolver = installPackageCliResolver;
    }
    /* ------------------------------------------------------------------------ */
    async resolveMainCommandsPrompt() {
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = await this.mainCommandsCliPrompt.getMainCommandsPrompt();
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
                case INTERACTIVE_CLI_COMMANDS.exit:
                    process.exit();
            }
        })
            .catch(promptErrorHandler);
    }
}
//# sourceMappingURL=main-commands.cli-resolver.js.map