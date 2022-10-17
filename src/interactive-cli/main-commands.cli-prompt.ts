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
        INTERACTIVE_CLI_COMMANDS.compareInstalledPackageWithRemote,
        INTERACTIVE_CLI_COMMANDS.listInstalledPackages,
        INTERACTIVE_CLI_COMMANDS.listRemotePackages,
        INTERACTIVE_CLI_COMMANDS.getRemotePackageLatestVersion,
        INTERACTIVE_CLI_COMMANDS.publishPackage,
        INTERACTIVE_CLI_COMMANDS.installPackage,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ============================= LOCAL LIBRARY ============================ */

  /* ------------------------------------------------------------------------ */
  async getSelectLocalLibraryPrompt() {
    if (!this.localLibrary) return;

    const libraries = await this.localLibrary.getInstalledLibraries();

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-library',
      message: 'Select library:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...libraries,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectLocalCollectionPrompt(selectedLibrary: string) {
    if (!this.localLibrary) return;

    const collections = await this.localLibrary.getInstalledCollections(
      selectedLibrary,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-collection',
      message: 'Select collection:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...collections,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectLocalPackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    if (!this.localLibrary) return;

    const packages = await this.localLibrary.getInstalledPackages(
      selectedLibrary,
      selectedCollection,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-package',
      message: 'Select package:',
      choices: [...packages, INTERACTIVE_CLI_COMMANDS.exit],
    });
  }

  /* ============================ REMOTE LIBRARY ============================ */

  /* ------------------------------------------------------------------------ */
  async getSelectRemoteLibraryPrompt() {
    if (!this.remoteLibrary) return;

    const libraries = await this.remoteLibrary.getRemoteLibraries();

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-library',
      message: 'Select library:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...libraries,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectRemoteCollectionPrompt(selectedLibrary: string) {
    if (!this.remoteLibrary) return;

    const collections = await this.remoteLibrary.getRemoteCollections(
      selectedLibrary,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-collection',
      message: 'Select collection:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.showAll,
        ...collections,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectRemotePackagePrompt(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    if (!this.remoteLibrary) return;

    const packages = await this.remoteLibrary.getRemotePackages(
      selectedLibrary,
      selectedCollection,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-package',
      message: 'Select package:',
      choices: [...packages, INTERACTIVE_CLI_COMMANDS.exit],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectRemotePackageVersionPrompt(selectedPackage: string) {
    if (!this.remoteLibrary) return;

    const versions = await this.remoteLibrary.getRemotePackageAllVersions(
      selectedPackage,
    );

    printSpacingBetweenPrompts();

    return new Select({
      name: 'select-version',
      message: 'Select versions:',
      choices: [...versions, INTERACTIVE_CLI_COMMANDS.exit],
    });
  }

  /* ============================== VERSIONING ============================== */

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
