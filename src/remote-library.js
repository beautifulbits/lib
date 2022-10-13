import recursiveReaddir from 'recursive-readdir-async';
import consola from 'consola';
import path from 'path';
import { showPackagesAsTable } from './show-packages-as-table.js';
import { LIB_CONFIG_FILENAME } from './constants.js';

/* ========================================================================== */
/*                               REMOTE LIBRARY                               */
/* ========================================================================== */
export class RemoteLibrary {
  /* ------------------------------------------------------------------------ */
  constructor({ path, verbose = false, packageFileGenerator }) {
    this.remoteLibraryPath = path;
    this.packageFileGenerator = packageFileGenerator;
    this.verbose = verbose;
  }

  /* ------------------------------------------------------------------------ */
  async findLibConfigFiles() {
    try {
      if (this.verbose) {
        consola.log(`Scanning ${this.remoteLibraryPath} for modules.`);
      }
      this.libConfigFiles = await recursiveReaddir.list(
        this.remoteLibraryPath,
        {
          ignoreFolders: true,
          extensions: true,
          readContent: true,
          include: [LIB_CONFIG_FILENAME],
          encoding: `utf8`,
        }
      );

      if (this.verbose) {
        consola.log(`Found remote modules:`, this.libConfigFiles);
      }
    } catch (recursiveReaddirError) {
      consola.error(`Unable to scan directory: ${recursiveReaddirError}`);
      process.exit(1);
    }
  }

  /* ------------------------------------------------------------------------ */
  async getPublishedPackagesCatalog() {
    await this.findLibConfigFiles();

    this.packagesCatalog = {};

    this.libConfigFiles.forEach((configFile) => {
      const configData = JSON.parse(configFile.data);
      const { library, collection, name, version } = configData;

      if (!this.packagesCatalog[library]) {
        this.packagesCatalog[library] = {};
      }

      if (!this.packagesCatalog[library][collection]) {
        this.packagesCatalog[library][collection] = {};
      }

      if (!this.packagesCatalog[library][collection][name]) {
        this.packagesCatalog[library][collection][name] = {};
      }

      if (!this.packagesCatalog[library][collection][name][version]) {
        this.packagesCatalog[library][collection][name][version] = {
          path: configFile.path,
          config: configData,
        };
      } else {
        consola.warn(
          'Duplicated package version found in local library.',
          path,
          configData
        );
      }
    });
  }

  /* ------------------------------------------------------------------------ */
  async showRemotePackagesAsTable(
    selectedLibrary,
    selectedCollection,
    selectedPackage
  ) {
    await this.getPublishedPackagesCatalog();
    console.log();
    showPackagesAsTable(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection,
      selectedPackage
    );
  }

  /* ------------------------------------------------------------------------ */
  async findPublishedPackageMetadata(selectedPackage, selectedVersion) {
    let packageConfig;

    await this.getPublishedPackagesCatalog();

    Object.keys(this.packagesCatalog).forEach((libraryName) => {
      const library = this.packagesCatalog[libraryName];

      Object.keys(library).forEach((collectionName) => {
        const collection = library[collectionName];

        Object.keys(collection).forEach((packageName) => {
          const packageVersions = collection[packageName];

          Object.keys(packageVersions).forEach((versionNumber) => {
            if (
              packageName === selectedPackage &&
              versionNumber === selectedVersion
            ) {
              packageConfig = collection[packageName][versionNumber];
            }
          });
        });
      });
    });

    if (!packageConfig && this.verbose) {
      consola.warn(
        `Config for package ${selectedPackage}@${selectedVersion} not found.`
      );
    }

    return packageConfig;
  }

  /* ------------------------------------------------------------------------ */
  async publishPackage({ name, version, files, packageLocalRelativePath }) {
    const packageConfig = await this.findPublishedPackageMetadata(
      name,
      version
    );
    console.log('packageConfig', packageConfig);
    if (packageConfig) {
      consola.error(`Package ${name}@${version} already published`);
    } else {
      files.forEach(async (file) => {
        const packageVersionBasePath = path.join(
          packageLocalRelativePath,
          version
        );

        const directoryRelativePathForVersion = path.join(
          packageVersionBasePath,
          file.relativePath.replace(packageLocalRelativePath, '')
        );

        const fileRelativePathForVersion = path.join(
          packageVersionBasePath,
          file.relativePath.replace(packageLocalRelativePath, ''),
          file.name
        );

        await this.packageFileGenerator.generateFile({
          basePath: this.remoteLibraryPath,
          directoryRelativePath: directoryRelativePathForVersion,
          fileRelativePath: fileRelativePathForVersion,
          fileContents: file.data,
        });
      });
      consola.log(`Package ${name}@${version} successfully published!`);
    }
  }
}
