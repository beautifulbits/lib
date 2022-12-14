import {
  INTERACTIVE_CLI_COMMANDS,
  VERSION_UPDATE_TYPES,
} from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

/* ================================ INTERFACE =============================== */
interface IInstallPackageCliResolverInitFn {
  verbose?: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  mainCommandsCliResolver: MainCommandsCliResolver;
}

/* ========================================================================== */
/*                        INSTALL PACKAGE CLI RESOLVER                        */
/* ========================================================================== */
export class InstallPackageCliResolver {
  verbose?: boolean;
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;
  mainCommandsCliPrompt?: MainCommandsCliPrompt;
  mainCommandsCliResolver?: MainCommandsCliResolver;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    mainCommandsCliPrompt,
    mainCommandsCliResolver,
  }: IInstallPackageCliResolverInitFn) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveSelectLibraryPrompt() {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.selectRemoteLibraryPrompt();

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;

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
  async resolveSelectCollectionPrompt(selectedLibrary: string) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.selectRemoteCollectionPrompt(
        selectedLibrary,
      );

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;

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
  async resolveSelectPackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.selectRemotePackagePrompt(
        selectedLibrary,
        selectedCollection,
      );

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;
        if (!this.localLibrary) return;
        if (!this.remoteLibrary) return;

        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.exit:
            await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
            break;

          default:
            const latestRemoteVersion =
              await this.remoteLibrary.getRemotePackageLatestVersion(answer);

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
  async resolveUpdateTypePrompt(packageName: string) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt = this.mainCommandsCliPrompt.selectUpdateTypePrompt();

    await selectPrompt.run().then(async (answer: VERSION_UPDATE_TYPES) => {
      if (!this.mainCommandsCliResolver) return;
      if (!this.localLibrary) return;

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
