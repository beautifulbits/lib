import recursiveReaddir from 'recursive-readdir-async';
import consola from 'consola';
import path from 'path';
import boxen from 'boxen';
import { showPackagesAsTable } from './helpers/show-packages-as-table.js';
import {
  LIB_CONFIG_FILENAME,
  UNPUBLISHED_VERSION,
} from './helpers/constants.js';
import { PackageFileGenerator } from './package-file-generator.js';
import { getPackagesFromCatalog } from './helpers/get-packages-from-catalog.js';
import { TPackageMetadata } from './@types/package-metadata.js';

/* ========================================================================== */
/*                               REMOTE LIBRARY                               */
/* ========================================================================== */
export class RemoteLibrary {
  remoteLibraryPath: string;
  packageFileGenerator: PackageFileGenerator;
  verbose: boolean;
  libConfigFiles;
  packagesCatalog;

  /* ------------------------------------------------------------------------ */
  constructor({ path, verbose = false, packageFileGenerator }) {
    this.remoteLibraryPath = path;
    this.packageFileGenerator = packageFileGenerator;
    this.verbose = verbose;
  }

  /* =========================== SCANNING LIBRARY =========================== */

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

  /* =========================== LISTING PACKAGES =========================== */

  /* ------------------------------------------------------------------------ */
  async getInstalledLibraries() {
    await this.getPublishedPackagesCatalog();
    return Object.keys(this.packagesCatalog);
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledCollections(selectedLibrary) {
    await this.getPublishedPackagesCatalog();
    return Object.keys(this.packagesCatalog[selectedLibrary]);
  }

  /* ------------------------------------------------------------------------ */
  async getInstalledPackages(selectedLibrary, selectedCollection) {
    await this.getPublishedPackagesCatalog();
    return getPackagesFromCatalog(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection
    );
  }

  /* ------------------------------------------------------------------------ */
  async showRemotePackagesAsTable(
    selectedLibrary?: string,
    selectedCollection?: string,
    selectedPackage?: string
  ) {
    await this.getPublishedPackagesCatalog();

    showPackagesAsTable(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection,
      selectedPackage
    );
  }

  /* ======================== GETTING PACKAGE DETAILS ======================= */

  /* ------------------------------------------------------------------------ */
  async findPublishedPackageMetadata(
    selectedPackage?: string,
    selectedVersion?: string
  ): Promise<TPackageMetadata | TPackageMetadata[] | undefined> {
    let packageConfig: TPackageMetadata | undefined;
    let packagesConfig: TPackageMetadata[] = [];

    await this.getPublishedPackagesCatalog();

    Object.keys(this.packagesCatalog).forEach((libraryName) => {
      const library = this.packagesCatalog[libraryName];

      Object.keys(library).forEach((collectionName) => {
        const collection = library[collectionName];

        Object.keys(collection).forEach((packageName) => {
          const packageVersions = collection[packageName];

          Object.keys(packageVersions).forEach((versionNumber) => {
            if (selectedVersion) {
              if (
                packageName === selectedPackage &&
                versionNumber === selectedVersion
              ) {
                packageConfig = packageVersions[versionNumber];
              }
            } else {
              if (packageName === selectedPackage) {
                packagesConfig.push(packageVersions[versionNumber]);
              }
            }
          });
        });
      });
    });

    if (selectedVersion) {
      if (packageConfig === undefined && this.verbose) {
        consola.warn(
          `Config for package ${selectedPackage}@${selectedVersion} not found.`
        );
      }
      return packageConfig;
    } else {
      return packagesConfig;
    }
  }

  /* ------------------------------------------------------------------------ */
  async getRemotePackageLatestVersion(packageName, show = false) {
    const packagesMetadata = await this.findPublishedPackageMetadata(
      packageName
    );

    let latestVersion = UNPUBLISHED_VERSION;
    if (packagesMetadata !== undefined && Array.isArray(packagesMetadata)) {
      packagesMetadata.forEach((packageMetadata) => {
        const packageVersion = packageMetadata.config.version;
        if (
          packageVersion > latestVersion ||
          latestVersion === UNPUBLISHED_VERSION
        ) {
          latestVersion = packageVersion;
        }
      });
    }

    if (show) {
      consola.log(boxen(`${packageName}@${latestVersion}`));
    }
    return latestVersion;
  }

  /* ------------------------------------------------------------------------ */
  async grabPackageFilesAndMetadataForPublish(packageName) {
    const packageMetadata = await this.findPublishedPackageMetadata(
      packageName
    );

    if (packageMetadata !== undefined && !Array.isArray(packageMetadata)) {
      const { path, config } = packageMetadata;
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
            relativePath: file.path.replace(this.remoteLibraryPath, ''),
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
  }

  /* ========================== PUBLISHING PACKAGES ========================= */

  /* ------------------------------------------------------------------------ */
  async publishPackage({ name, version, files, packageLocalRelativePath }) {
    const packageConfig = await this.findPublishedPackageMetadata(
      name,
      version
    );

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
