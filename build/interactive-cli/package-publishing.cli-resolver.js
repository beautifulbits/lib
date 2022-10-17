import { INTERACTIVE_CLI_COMMANDS, UNPUBLISHED_VERSION, } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                       PACKAGE PUBLISHING CLI RESOLVER                      */
/* ========================================================================== */
export class PackagePublishingCliResolver {
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
        const selectPrompt = await this.mainCommandsCliPrompt.selectLocalLibraryPrompt();
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
        const selectPrompt = await this.mainCommandsCliPrompt.selectLocalCollectionPrompt(selectedLibrary);
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
        const selectPrompt = await this.mainCommandsCliPrompt.selectLocalPackagePrompt(selectedLibrary, selectedCollection);
        await selectPrompt
            .run()
            .then(async (answer) => {
            if (!this.mainCommandsCliResolver)
                return;
            if (!this.localLibrary)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    const installedVersion = await this.localLibrary.getInstalledPackageVersion(answer);
                    if (installedVersion === UNPUBLISHED_VERSION) {
                        await this.localLibrary.publishPackage(answer);
                        await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    }
                    else {
                        await this.resolveUpdateTypePrompt(answer);
                    }
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
//# sourceMappingURL=package-publishing.cli-resolver.js.map