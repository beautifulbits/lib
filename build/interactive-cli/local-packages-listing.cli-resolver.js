import { INTERACTIVE_CLI_COMMANDS } from '../helpers/constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
/* ========================================================================== */
/*                     LOCAL PACKAGES LISTING CLI RESOLVER                    */
/* ========================================================================== */
export class LocalPackagesListingCliResolver {
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
            if (!this.localLibrary)
                return;
            if (!this.mainCommandsCliResolver)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    await this.localLibrary.showInstalledPackagesAsTable();
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
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
            if (!this.localLibrary)
                return;
            if (!this.mainCommandsCliResolver)
                return;
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    await this.localLibrary.showInstalledPackagesAsTable(selectedLibrary);
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                case INTERACTIVE_CLI_COMMANDS.exit:
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.localLibrary.showInstalledPackagesAsTable(selectedLibrary, answer);
                    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            }
        })
            .catch(promptErrorHandler);
    }
}
//# sourceMappingURL=local-packages-listing.cli-resolver.js.map