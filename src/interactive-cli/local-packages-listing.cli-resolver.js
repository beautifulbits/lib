import { INTERACTIVE_CLI_COMMANDS } from '../constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';

/* ========================================================================== */
/*                     LOCAL PACKAGES LISTING CLI RESOLVER                    */
/* ========================================================================== */
export class LocalPackagesListingCliResolver {
  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    mainCommandsCliPrompt,
    mainCommandsCliResolver,
  }) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveSelectLibraryPrompt() {
    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectLibraryPrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            await this.localLibrary.showInstalledPackagesAsTable();
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
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
    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectCollectionPrompt(
        selectedLibrary
      );

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            await this.localLibrary.showInstalledPackagesAsTable(
              selectedLibrary
            );
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            break;

          default:
            await this.localLibrary.showInstalledPackagesAsTable(
              selectedLibrary,
              answer
            );
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
        }
      })
      .catch(promptErrorHandler);
  }
}
