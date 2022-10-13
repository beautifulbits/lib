import path from 'path';
import fs from 'fs';
import enquirer from 'enquirer';
import consola from 'consola';
import {
  INTERACTIVE_CLI_COMMANDS,
  UNPUBLISHED_VERSION,
  VERSION_UPDATE_TYPES,
} from './constants.js';

const { Select, Form } = enquirer;

/* ========================================================================== */
/*                          CLI INTERACTIVE INTERFACE                         */
/* ========================================================================== */
export class CliInteractiveInterface {
  /* ------------------------------------------------------------------------ */
  constructor({ verbose = true, localLibrary, remoteLibrary }) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
  }

  /* ------------------------------------------------------------------------ */
  printSpacingBetweenPrompts() {
    consola.log(`\n`);
  }

  /* ------------------------------------------------------------------------ */
  promptErrorHandler(promptError) {
    consola.error('Error reading answer.', promptError);
  }

  /* ================================ PROMPTS =============================== */

  /* ------------------------------------------------------------------------ */
  async getMainCommandsPrompt() {
    this.printSpacingBetweenPrompts();

    return new Select({
      name: 'Main Commands',
      message: 'Commands:',
      choices: [
        INTERACTIVE_CLI_COMMANDS.listInstalledPackages,
        INTERACTIVE_CLI_COMMANDS.listRemotePackages,
        INTERACTIVE_CLI_COMMANDS.publishPackage,
        INTERACTIVE_CLI_COMMANDS.initPackageDirectory,
        INTERACTIVE_CLI_COMMANDS.exit,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  async getSelectLibraryPrompt() {
    const installedLibraries = await this.localLibrary.getInstalledLibraries();

    this.printSpacingBetweenPrompts();

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

    this.printSpacingBetweenPrompts();

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

    this.printSpacingBetweenPrompts();

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

  /* ============================= MAIN COMMANDS ============================ */

  /* ------------------------------------------------------------------------ */
  async runMainPrompt() {
    const selectPrompt = await this.getMainCommandsPrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.listInstalledPackages:
            this.runListInstalledPackagesSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.listRemotePackages:
            await this.remoteLibrary.showRemotePackagesAsTable();
            this.runMainPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.publishPackage:
            this.runPublishSelectLibraryPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            process.exit();
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ====================== LISTING INSTALLED PACKAGES ====================== */

  /* ------------------------------------------------------------------------ */
  async runListInstalledPackagesSelectLibraryPrompt() {
    const selectPrompt = await this.getSelectLibraryPrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            await this.localLibrary.showInstalledPackagesAsTable();
            this.runMainPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.runMainPrompt();
            break;

          default:
            this.runListInstalledPackagesSelectCollectionPrompt(answer);
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async runListInstalledPackagesSelectCollectionPrompt(selectedLibrary) {
    const selectPrompt = await this.getSelectCollectionPrompt(selectedLibrary);

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            await this.localLibrary.showInstalledPackagesAsTable(
              selectedLibrary
            );
            this.runMainPrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.runMainPrompt();
            break;

          default:
            await this.localLibrary.showInstalledPackagesAsTable(
              selectedLibrary,
              answer
            );
            this.runMainPrompt();
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ========================== PUBLISHING PACKAGE ========================== */

  /* ------------------------------------------------------------------------ */
  async runPublishSelectLibraryPrompt() {
    const selectPrompt = await this.getSelectLibraryPrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            this.runPublishSelectPackagePrompt();
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.runMainPrompt();
            break;

          default:
            this.runPublishSelectCollectionPrompt(answer);
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async runPublishSelectCollectionPrompt(selectedLibrary) {
    const selectPrompt = await this.getSelectCollectionPrompt(selectedLibrary);

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.showAll:
            this.runPublishSelectPackagePrompt(selectedLibrary);
            break;

          case INTERACTIVE_CLI_COMMANDS.exit:
            this.runMainPrompt();
            break;

          default:
            await this.runPublishSelectPackagePrompt(selectedLibrary, answer);
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async runPublishSelectPackagePrompt(selectedLibrary, selectedCollection) {
    const selectPrompt = await this.getSelectPackagePrompt();

    await selectPrompt
      .run()
      .then(async (answer) => {
        switch (answer) {
          case INTERACTIVE_CLI_COMMANDS.exit:
            this.runMainPrompt();
            break;

          default:
            const installedVersion =
              await this.localLibrary.getInstalledPackageVersion(answer);

            if (installedVersion === UNPUBLISHED_VERSION) {
              await this.localLibrary.publishPackage(answer);
              this.runMainPrompt();
            } else {
              this.runPublishUpdateTypePrompt(answer);
            }
        }
      })
      .catch(this.promptErrorHandler);
  }

  /* ------------------------------------------------------------------------ */
  async runPublishUpdateTypePrompt(packageName) {
    const selectPrompt = this.getSelectUpdateTypePrompt();

    await selectPrompt.run().then(async (answer) => {
      await this.localLibrary.publishPackage(packageName, answer);
      this.runMainPrompt();
    });
  }
}
