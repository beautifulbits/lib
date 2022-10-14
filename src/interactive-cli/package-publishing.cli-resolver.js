import { INTERACTIVE_CLI_COMMANDS, UNPUBLISHED_VERSION } from '../constants.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';

/* ========================================================================== */
/*                       PACKAGE PUBLISHING CLI RESOLVER                      */
/* ========================================================================== */
export class PackagePublishingCliResolver {
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
            this.resolveSelectPackagePrompt();
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
            this.resolveSelectPackagePrompt(selectedLibrary);
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            break;

          default:
            await this.resolveSelectPackagePrompt(selectedLibrary, answer);
        }
      })
      .catch(promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async resolveSelectPackagePrompt(selectedLibrary, selectedCollection) {
    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectPackagePrompt(
        selectedLibrary,
        selectedCollection
      );

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.exit:
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            break;

          default:
            const installedVersion =
              await this.localLibrary.getInstalledPackageVersion(answer);

            if (installedVersion === UNPUBLISHED_VERSION) {
              await this.localLibrary.publishPackage(answer);
              this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            } else {
              this.resolveUpdateTypePrompt(answer);
            }
        }
      })
      .catch(promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async resolveUpdateTypePrompt(packageName) {
    const selectPrompt = this.mainCommandsCliPrompt.getSelectUpdateTypePrompt();

    await selectPrompt.run().then(async (answer) => {
      await this.localLibrary.publishPackage(packageName, answer);
      this.mainCommandsCliResolver.resolveMainCommandsPrompt();
    });
  }
}
