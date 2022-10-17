import { INTERACTIVE_CLI_COMMANDS } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                 REMOTE PACKAGE LATEST VERSION CLI RESOLVER                 */
/* ========================================================================== */
export class RemotePackageLatestVersionCliResolver {
    /* ------------------------------------------------------------------------ */
    init({ verbose = true, localLibrary, remoteLibrary, mainCommandsCliPrompt, mainCommandsCliResolver, }) {
        this.verbose = verbose;
        this.localLibrary = localLibrary;
        this.remoteLibrary = remoteLibrary;
        this.mainCommandsCliPrompt = mainCommandsCliPrompt;
        this.mainCommandsCliResolver = mainCommandsCliResolver;
    }
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
                    this.mainCommandsCliResolver.resolveMainCommandsPrompt();
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
            if (!this.remoteLibrary)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.remoteLibrary.getRemotePackageLatestVersion(answer, true);
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            }
        })
            .catch(promptErrorHandler);
    }
}
//# sourceMappingURL=remote-package-latest-version.cli-resolver.js.map