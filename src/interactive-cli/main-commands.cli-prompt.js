import enquirer from 'enquirer';
import {
  INTERACTIVE_CLI_COMMANDS,
  VERSION_UPDATE_TYPES,
} from '../constants.js';

const { Select } = enquirer;
import { printSpacingBetweenPrompts } from './interactive-cli.helpers.js';

/* ========================================================================== */
/*                           CLI INTERACTIVE PROMPTS                          */
/* ========================================================================== */
export class MainCommandsCliPrompt {
  /* ------------------------------------------------------------------------ */
  init({ verbose = true, localLibrary, remoteLibrary }) {
    console.log('here', this);
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
  async getSelectCollectionPrompt(selectedLibrary) {
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
  async getSelectPackagePrompt(selectedLibrary, selectedCollection) {
    const installedPackages = await this.localLibrary.getInstalledPackages(
      selectedLibrary,
      selectedCollection
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
    const choices = Object.keys(VERSION_UPDATE_TYPES).map(
      (key) => VERSION_UPDATE_TYPES[key]
    );
    return new Select({
      name: 'select-update-type',
      message: 'Select update type:',
      choices,
    });
  }
}
