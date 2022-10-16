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
        const selectPrompt = await this.mainCommandsCliPrompt.getSelectLibraryPrompt();
        await selectPrompt
            .run()
            .then(async (answer) => {
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    await this.resolveSelectPackagePrompt();
                    break;
                case INTERACTIVE_CLI_COMMANDS.exit:
                    this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    this.resolveSelectCollectionPrompt(answer);
            }
        })
            .catch(promptErrorHandler);
    }
    /* ------------------------------------------------------------------------ */
    async resolveSelectCollectionPrompt(selectedLibrary) {
        const selectPrompt = await this.mainCommandsCliPrompt.getSelectCollectionPrompt(selectedLibrary);
        await selectPrompt
            .run()
            .then(async (answer) => {
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.showAll:
                    this.resolveSelectPackagePrompt(selectedLibrary);
                    break;
                case INTERACTIVE_CLI_COMMANDS.exit:
                    this.mainCommandsCliResolver.resolveMainCommandsPrompt();
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
        const selectPrompt = await this.mainCommandsCliPrompt.getSelectPackagePrompt(selectedLibrary, selectedCollection);
        await selectPrompt
            .run()
            .then(async (answer) => {
            switch (answer) {
                case INTERACTIVE_CLI_COMMANDS.exit:
                    this.mainCommandsCliResolver.resolveMainCommandsPrompt();
                    break;
                default:
                    await this.remoteLibrary.getRemotePackageLatestVersion(answer, true);
                    this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            }
        })
            .catch(promptErrorHandler);
    }
}
