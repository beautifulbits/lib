import { INTERACTIVE_CLI_COMMANDS, } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                        INSTALL PACKAGE CLI RESOLVER                        */
/* ========================================================================== */
export class InstallPackageCliResolver {
    /* ------------------------------------------------------------------------ */
    init({ verbose = true, localLibrary, remoteLibrary, mainCommandsCliPrompt, mainCommandsCliResolver, }) {
        this.verbose = verbose;
        this.localLibrary = localLibrary;
        this.remoteLibrary = remoteLibrary;
        this.mainCommandsCliPrompt = mainCommandsCliPrompt;
        this.mainCommandsCliResolver = mainCommandsCliResolver;
    }
    /* ------------------------------------------------------------------------ */
    async resolveSelectLibraryPrompt() {
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = await this.mainCommandsCliPrompt.selectRemoteLibraryPrompt();
        await selectPrompt
            .run()
            .then(async (answer) => {
            if (!this.mainCommandsCliResolver)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    await this.resolveSelectPackagePrompt();
                    break;
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.resolveSelectCollectionPrompt(answer);
            }
        })
            .catch(promptErrorHandler);
    }
    /* ------------------------------------------------------------------------ */
    async resolveSelectCollectionPrompt(selectedLibrary) {
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = await this.mainCommandsCliPrompt.selectRemoteCollectionPrompt(selectedLibrary);
        await selectPrompt
            .run()
            .then(async (answer) => {
            if (!this.mainCommandsCliResolver)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    await this.resolveSelectPackagePrompt(selectedLibrary);
                    break;
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.resolveSelectPackagePrompt(selectedLibrary, answer);
            }
        })
            .catch(promptErrorHandler);
    }
    /* ------------------------------------------------------------------------ */
    async resolveSelectPackagePrompt(selectedLibrary, selectedCollection) {
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = await this.mainCommandsCliPrompt.selectRemotePackagePrompt(selectedLibrary, selectedCollection);
        await selectPrompt
            .run()
            .then(async (answer) => {
            if (!this.mainCommandsCliResolver)
                return;
            if (!this.localLibrary)
                return;
            if (!this.remoteLibrary)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    const latestRemoteVersion = await this.remoteLibrary.getRemotePackageLatestVersion(answer);
                    await this.remoteLibrary.installPackage({
                        packageName: answer,
                        version: latestRemoteVersion,
                    });
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            }
        })
            .catch(promptErrorHandler);
    }
    /* ------------------------------------------------------------------------ */
    async resolveUpdateTypePrompt(packageName) {
        if (!this.mainCommandsCliPrompt)
            return;
        const selectPrompt = this.mainCommandsCliPrompt.selectUpdateTypePrompt();
        await selectPrompt.run().then(async (answer) => {
            if (!this.mainCommandsCliResolver)
                return;
            if (!this.localLibrary)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.localLibrary.publishPackage(packageName, answer);
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            }
        });
    }
}
//# sourceMappingURL=install-package.cli-resolver.js.map