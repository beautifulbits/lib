import enquirer from 'enquirer';
import {
  INTERACTIVE_CLI_COMMANDS,
  VERSION_UPDATE_TYPES,
} from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { printSpacingBetweenPrompts } from './interactive-cli.helpers.js';

// @ts-ignore
const { Select } = enquirer;

/* ================================ INTERFACE =============================== */
interface IMainCommandsCliPromptInitFn {
  verbose: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
}

/* ========================================================================== */
/*                           CLI INTERACTIVE PROMPTS                          */
/* ========================================================================== */
export class MainCommandsCliPrompt {
  verbose?: boolean;
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
  }: IMainCommandsCliPromptInitFn) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
  }

  /* ================================ PROMPTS =============================== */

  /* ------------------------------------------------------------------------ */
  async getMainCommandsPrompt() {
    printSpacingBetweenPrompts();

    return new Select({
      name: 'Main Commands',
      message: 'Commands:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.listInstalledPackages,
        INTERACTIVE_CLI_COMMANDS.listRemotePackages,
        INTERACTIVE_CLI_COMMANDS.getRemotePackageLatestVersion,
        INTERACTIVE_CLI_COMMANDS.publishPackage,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectLibraryPrompt() {
    if (!this.localLibrary) return;

    const installedLibraries = await this.localLibrary.getInstalledLibraries();

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-library',
      message: 'Select library:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...installedLibraries,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectCollectionPrompt(selectedLibrary: string) {
    if (!this.localLibrary) return;

    const selectedLibraryInstalledCollections =
      await this.localLibrary.getInstalledCollections(selectedLibrary);

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-collection',
      message: 'Select collection:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...selectedLibraryInstalledCollections,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectPackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    if (!this.localLibrary) return;

    const installedPackages = await this.localLibrary.getInstalledPackages(
      selectedLibrary,
      selectedCollection,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-package',
      message: 'Select package:',
      choices: [...installedPackages, INTERACTIVE_CLI_COMMANDS.exit],
    });
  }

  /* ------------------------------------------------------------------------ */
  getSelectUpdateTypePrompt() {
    let versionUpdateValues = Object.values(VERSION_UPDATE_TYPES);
    const choices: (VERSION_UPDATE_TYPES | string)[] = [
      ...versionUpdateValues,
      INTERACTIVE_CLI_COMMANDS.exit,
    ];

    return new Select({
      name: 'select-update-type',
      message: 'Select update type:',
      choices,
    });
  }
}
