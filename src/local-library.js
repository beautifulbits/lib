import recursiveReaddir from 'recursive-readdir-async';
import consola from 'consola';
import path from 'path';
import {
  LIB_CONFIG_FILENAME,
  NEW_PACKAGE_INITIAL_VERSION,
  UNPUBLISHED_VERSION,
  VERSION_UPDATE_TYPES,
  VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR,
} from './constants.js';
import { showPackagesAsTable } from './show-packages-as-table.js';
import { getPackagesFromCatalog } from './get-packages-from-catalog.js';

/* ========================================================================== */
/*                                LOCAL LIBRARY                               */
/* ========================================================================== */
export class LocalLibrary {
  /* ------------------------------------------------------------------------ */
  constructor({
    localLibraryDirectory,
    verbose = false,
    packageFileGenerator,
    remoteLibrary,
  }) {
    this.verbose = verbose;
    this.packageFileGenerator = packageFileGenerator;
    this.cliWorkingDir = process.cwd();
    this.libDir = localLibraryDirectory;
    this.libPath = path.join(this.cliWorkingDir, this.libDir);
    this.remoteLibrary = remoteLibrary;
  }

  /* ------------------------------------------------------------------------ */
  async findLibConfigFiles() {
    try {
      if (this.verbose) {
        consola.log(`Scanning ${this.libPath} for modules.`);
      }
      this.libConfigFiles = await recursiveReaddir.list(this.libPath, {
        ignoreFolders: true,
        extensions: true,
        readContent: true,
        include: [LIB_CONFIG_FILENAME],
        encoding: `utf8`,
      });
      if (this.verbose) {
        consola.log(`Found modules:`, this.libConfigFiles);
      }
    } catch (recursiveReaddirError) {
      consola.error(`Unable to scan directory: ${recursiveReaddirError}`);
      process.exit(1);
    }
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledPackagesCatalog() {
    await this.findLibConfigFiles();

    this.packagesCatalog = {};

    this.libConfigFiles.forEach((configFile) => {
      const configData = JSON.parse(configFile.data);
      const { library, collection, name, version } = configData;

      const installedVersion = version ? version : UNPUBLISHED_VERSION;

      if (!this.packagesCatalog[library]) {
        this.packagesCatalog[library] = {};
      }

      if (!this.packagesCatalog[library][collection]) {
        this.packagesCatalog[library][collection] = {};
      }

      if (!this.packagesCatalog[library][collection][name]) {
        this.packagesCatalog[library][collection][name] = {};
      }

      if (!this.packagesCatalog[library][collection][name][installedVersion]) {
        this.packagesCatalog[library][collection][name][installedVersion] = {
          path: configFile.path,
          config: configData,
        };
      } else {
        consola.warn(
          'Duplicated package version found in local library.',
          path,
          configData,
          installedVersion
        );
      }
    });
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledLibraries() {
    await this.getInstalledPackagesCatalog();
    return Object.keys(this.packagesCatalog);
  }

  /* ------------------------------------------------------------------------ */
  async findPackageMetadata(selectedPackage) {
    let packageConfig;

    await this.getInstalledPackagesCatalog();

    Object.keys(this.packagesCatalog).forEach((libraryName) => {
      const library = this.packagesCatalog[libraryName];

      Object.keys(library).forEach((collectionName) => {
        const collection = library[collectionName];

        Object.keys(collection).forEach((packageName) => {
          if (packageName === selectedPackage) {
            const versions = Object.keys(collection[packageName]);

            if (versions.length > 1) {
              consola.warn(`Multiple versions of ${selectedPackage} found.`);
            }
            if (versions.length === 0) {
              consola.warn(`No versions of ${selectedPackage} found.`);
            }

            const latestVersion = versions[0];
            if (collection[packageName][latestVersion]) {
              packageConfig = collection[packageName][latestVersion];
            }
          }
        });
      });
    });

    if (!packageConfig) {
      consola.warn(`Config for package ${selectedPackage} not found.`);
    }

    return packageConfig;
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledCollections(selectedLibrary) {
    await this.getInstalledPackagesCatalog();
    return Object.keys(this.packagesCatalog[selectedLibrary]);
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledPackages(selectedLibrary, selectedCollection) {
    await this.getInstalledPackagesCatalog();
    return getPackagesFromCatalog(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection
    );
  }

  /* ------------------------------------------------------------------------ */
  async showInstalledPackagesAsTable(
    selectedLibrary,
    selectedCollection,
    selectedPackage
  ) {
    await this.getInstalledPackagesCatalog();
    showPackagesAsTable(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection,
      selectedPackage
    );
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledPackageVersion(packageName) {
    const { config } = await this.findPackageMetadata(packageName);
    if (config && config.version) {
      return String(config.version);
    }
    return UNPUBLISHED_VERSION;
  }

  /* ------------------------------------------------------------------------ */
  async updatePackageVersion(packageName, updateType) {
    let newVersion;

    const currentVersion = await this.getInstalledPackageVersion(packageName);

    if (currentVersion === UNPUBLISHED_VERSION) {
      newVersion = NEW_PACKAGE_INITIAL_VERSION;
    } else {
      const versionTuple = currentVersion.split(
        VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR
      );

      switch (updateType) {
        case VERSION_UPDATE_TYPES.patch:
          const currentPatchVersion = Number(versionTuple[2]);
          const newPatchVersion = currentPatchVersion + 1;
          newVersion = [
            versionTuple[0],
            versionTuple[1],
            String(newPatchVersion),
          ].join(`.`);
          break;
        case VERSION_UPDATE_TYPES.minor:
          const currentMinorVersion = Number(versionTuple[1]);
          const newMinorVersion = currentMinorVersion + 1;
          newVersion = [versionTuple[0], String(newMinorVersion), '0'].join(
            `.`
          );
          break;
        case VERSION_UPDATE_TYPES.major:
          const currentMajorVersion = Number(versionTuple[0]);
          const newMajorVersion = currentMajorVersion + 1;
          newVersion = [String(newMajorVersion), '0', '0'].join(
            VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR
          );
          break;
        default:
          consola.warn(
            `Error determining new version for package ${packageName}: update type ${updateType} not supported.`
          );
      }
    }

    if (newVersion) {
      const remotePackageConfig =
        await this.remoteLibrary.findPublishedPackageMetadata(
          packageName,
          newVersion
        );

      if (!remotePackageConfig) {
        const { config, path } = await this.findPackageMetadata(packageName);
        const { name, library, collection } = config;
        this.packageFileGenerator.generateLocalConfigFile({
          name,
          library,
          collection,
          version: newVersion,
          packagePath: path,
        });
        return true;
      } else {
        consola.warn(
          `Version ${newVersion} of ${packageName} has already been published.`
        );
        return false;
      }
    } else {
      consola.warn(`Error updating ${packageName} config file.`);
      return false;
    }
  }

  /* ------------------------------------------------------------------------ */
  async grabPackageFilesAndMetadataForPublish(packageName) {
    const { path, config } = await this.findPackageMetadata(packageName);

    try {
      const files = await recursiveReaddir.list(path, {
        ignoreFolders: true,
        extensions: true,
        readContent: true,
        encoding: `utf8`,
      });

      const packageFiles = files.map((file) => {
        return {
          ...file,
          relativePath: file.path.replace(this.cliWorkingDir, ''),
        };
      });

      return {
        path,
        config,
        packageFiles,
      };
    } catch (recursiveReaddirError) {
      consola.error(`Unable to scan directory: ${recursiveReaddirError}`);
      process.exit(1);
    }
  }

  /* ------------------------------------------------------------------------ */
  async publishPackage(packageName, updateType) {
    const isUpdateSuccess = await this.updatePackageVersion(
      packageName,
      updateType
    );

    if (isUpdateSuccess) {
      const { path, packageFiles, config } =
        await this.grabPackageFilesAndMetadataForPublish(packageName);

      await this.remoteLibrary.publishPackage({
        name: packageName,
        library: config.library,
        collection: config.collection,
        version: config.version,
        files: packageFiles,
        packageLocalRelativePath: path.replace(this.cliWorkingDir, ''),
      });
    }
  }
}
