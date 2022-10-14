import { INTERACTIVE_CLI_COMMANDS } from '../constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

/* ========================================================================== */
/*                 REMOTE PACKAGE LATEST VERSION CLI RESOLVER                 */
/* ========================================================================== */
export class RemotePackageLatestVersionCliResolver {
  verbose: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  mainCommandsCliResolver: MainCommandsCliResolver;

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

  async resolveSelectLibraryPrompt() {
    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectLibraryPrompt();

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
  async resolveSelectCollectionPrompt(selectedLibrary: string) {
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
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
        }
      })
      .catch(promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async resolveSelectPackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string
  ) {
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
            await this.remoteLibrary.getRemotePackageLatestVersion(
              answer,
              true
            );
            this.mainCommandsCliResolver.resolveMainCommandsPrompt();
        }
      })
      .catch(promptErrorHandler);
  }
}
