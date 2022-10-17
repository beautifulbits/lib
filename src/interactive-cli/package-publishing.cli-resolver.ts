import {
  INTERACTIVE_CLI_COMMANDS,
  UNPUBLISHED_VERSION,
  VERSION_UPDATE_TYPES,
} from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import { MainCommandsCliPrompt } from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

/* ================================ INTERFACE =============================== */
interface IPackagePublishingCliResolverInitFn {
  verbose?: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  mainCommandsCliResolver: MainCommandsCliResolver;
}

/* ========================================================================== */
/*                       PACKAGE PUBLISHING CLI RESOLVER                      */
/* ========================================================================== */
export class PackagePublishingCliResolver {
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
  }: IPackagePublishingCliResolverInitFn) {
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
      await this.mainCommandsCliPrompt.getSelectLocalLibraryPrompt();

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;

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
  async resolveSelectCollectionPrompt(selectedLibrary: string) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectLocalCollectionPrompt(
        selectedLibrary,
      );

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;

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
  async resolveSelectPackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt =
      await this.mainCommandsCliPrompt.getSelectLocalPackagePrompt(
        selectedLibrary,
        selectedCollection,
      );

    await selectPrompt
      .run()
      .then(async (answer: string) => {
        if (!this.mainCommandsCliResolver) return;
        if (!this.localLibrary) return;

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
  async resolveUpdateTypePrompt(packageName: string) {
    if (!this.mainCommandsCliPrompt) return;

    const selectPrompt = this.mainCommandsCliPrompt.getSelectUpdateTypePrompt();

    await selectPrompt.run().then(async (answer: VERSION_UPDATE_TYPES) => {
      if (!this.mainCommandsCliResolver) return;
      if (!this.localLibrary) return;

      switch (answer) {
        case INTERACTIVE_CLI_COMMANDS.exit:
          this.mainCommandsCliResolver.resolveMainCommandsPrompt();
          break;
        default:
          await this.localLibrary.publishPackage(packageName, answer);
          this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      }
    });
  }
}
