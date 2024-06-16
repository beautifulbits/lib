import recursiveReaddir from 'recursive-readdir-async';
import consola from 'consola';
import path from 'path';
import {
  LIB_CONFIG_FILENAME,
  NEW_PACKAGE_INITIAL_VERSION,
  UNPUBLISHED_VERSION,
  VERSION_UPDATE_TYPES,
  VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR,
} from './helpers/constants.js';
import { showPackagesAsTable } from './helpers/show-packages-as-table.js';
import { getPackagesFromCatalog } from './helpers/get-packages-from-catalog.js';
import { PackageFileGenerator } from './package-file-generator.js';
import { RemoteLibrary } from './remote-library.js';
import { TReaddirFileExtended } from './@types/readdir-file';
import { TPackageMetadata } from './@types/package-metadata';
import { TPackageConfig } from './@types/package-config';
import { TPackagesCatalog } from './@types/packages-catalog';

/* ================================ INTERFACE =============================== */
interface ILocalLibraryInitFn {
  localLibraryDirectory: string;
  verbose: boolean;
  packageFileGenerator: PackageFileGenerator;
  remoteLibrary: RemoteLibrary;
}

/* ========================================================================== */
/*                                LOCAL LIBRARY                               */
/* ========================================================================== */
export class LocalLibrary {
  cliWorkingDir: string;
  libConfigFiles: TReaddirFileExtended[];
  libDir?: string;
  libPath?: string;
  packageFileGenerator?: PackageFileGenerator;
  packagesCatalog: TPackagesCatalog;
  remoteLibrary?: RemoteLibrary;
  verbose?: boolean;

  /* ------------------------------------------------------------------------ */
  constructor() {
    this.packagesCatalog = {};
    this.libConfigFiles = [];
    this.cliWorkingDir = process.cwd();
  }

  /* ------------------------------------------------------------------------ */
  init({
    localLibraryDirectory,
    verbose = false,
    packageFileGenerator,
    remoteLibrary,
  }: ILocalLibraryInitFn) {
    this.libDir = localLibraryDirectory;
    this.libPath = path.join(this.cliWorkingDir, this.libDir);
    this.packageFileGenerator = packageFileGenerator;
    this.remoteLibrary = remoteLibrary;
    this.verbose = verbose;
  }

  /* =========================== SCANNING LIBRARY =========================== */

  /* ------------------------------------------------------------------------ */
  async findLibConfigFiles() {
    if (!this.libPath) return;

    try {
      if (this.verbose) {
        consola.log(`Scanning ${this.libPath} for modules.`);
      }

      this.libConfigFiles = await recursiveReaddir.list(this.libPath, {
        recursive: true,
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
          installedVersion,
        );
      }
    });
  }

  /* =========================== LISTING PACKAGES =========================== */

  /* ------------------------------------------------------------------------ */
  public async getInstalledLibraries() {
    await this.getInstalledPackagesCatalog();
    return Object.keys(this.packagesCatalog);
  }

  /* ------------------------------------------------------------------------ */
  public async getInstalledCollections(selectedLibrary: string) {
    await this.getInstalledPackagesCatalog();
    return Object.keys(this.packagesCatalog[selectedLibrary]);
  }

  /* ------------------------------------------------------------------------ */
  public async getInstalledPackages(
    selectedLibrary?: string,
    selectedCollection?: string,
  ) {
    await this.getInstalledPackagesCatalog();
    return getPackagesFromCatalog(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection,
    );
  }

  /* ------------------------------------------------------------------------ */
  public async showInstalledPackagesAsTable(
    selectedLibrary?: string,
    selectedCollection?: string,
    selectedPackage?: string,
  ) {
    await this.getInstalledPackagesCatalog();
    showPackagesAsTable(
      this.packagesCatalog,
      selectedLibrary,
      selectedCollection,
      selectedPackage,
    );
  }

  /* ======================== GETTING PACKAGE DETAILS ======================= */

  /* ------------------------------------------------------------------------ */
  private async findPackageMetadata(
    selectedPackage: string,
  ): Promise<TPackageMetadata | undefined> {
    let packageMetadata;

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
              packageMetadata = collection[packageName][latestVersion];
            }
          }
        });
      });
    });

    if (!packageMetadata) {
      consola.warn(`Config for local package ${selectedPackage} not found.`);
    }

    return packageMetadata;
  }

  /* ------------------------------------------------------------------------ */
  public async getInstalledPackageVersion(packageName: string) {
    const packageMetadata = await this.findPackageMetadata(packageName);

    if (packageMetadata?.config?.version) {
      return String(packageMetadata.config.version);
    }
    return UNPUBLISHED_VERSION;
  }

  /* ------------------------------------------------------------------------ */
  public async grabPackageFilesAndMetadata(packageName: string): Promise<
    | {
        path: string;
        config: TPackageConfig;
        packageFiles: TReaddirFileExtended[];
      }
    | undefined
  > {
    const packageMetadata = await this.findPackageMetadata(packageName);

    if (packageMetadata?.path && packageMetadata?.config) {
      const { path: packagePath, config } = packageMetadata;
      try {
        let files: TReaddirFileExtended[] = [];

        if (
          config.includeFromProjectRoot &&
          Array.isArray(config.includeFromProjectRoot) &&
          config.includeFromProjectRoot.length > 0
        ) {
          const fromProjectRootFiles = await recursiveReaddir.list(
            this.cliWorkingDir,
            {
              ignoreFolders: true,
              extensions: true,
              readContent: true,
              encoding: `utf8`,
              include: [...config.includeFromProjectRoot],
              exclude: ['node_modules'],
            },
          );

          const packageConfigFile = await recursiveReaddir.list(packagePath, {
            ignoreFolders: true,
            extensions: true,
            readContent: true,
            encoding: `utf8`,
          });

          files = [...fromProjectRootFiles, ...packageConfigFile];
        } else {
          files = await recursiveReaddir.list(packagePath, {
            ignoreFolders: true,
            extensions: true,
            readContent: true,
            encoding: `utf8`,
          });
        }

        const packageFiles = files.map((file) => {
          return {
            ...file,
            relativePath: file.path.replace(this.cliWorkingDir, ''),
          };
        });

        return {
          path: packagePath,
          config,
          packageFiles,
        };
      } catch (recursiveReaddirError) {
        consola.error(`Unable to scan directory: ${recursiveReaddirError}`);
        process.exit(1);
      }
    }
    return undefined;
  }

  /* ========================== PUBLISHING PACKAGES ========================= */

  /* ------------------------------------------------------------------------ */
  private async updatePackageVersion(
    packageName: string,
    updateType?: VERSION_UPDATE_TYPES,
  ) {
    let newVersion;

    const currentVersion = await this.getInstalledPackageVersion(packageName);

    if (currentVersion === UNPUBLISHED_VERSION) {
      newVersion = NEW_PACKAGE_INITIAL_VERSION;
    } else {
      const versionTuple = currentVersion.split(
        VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR,
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
            `.`,
          );
          break;
        case VERSION_UPDATE_TYPES.major:
          const currentMajorVersion = Number(versionTuple[0]);
          const newMajorVersion = currentMajorVersion + 1;
          newVersion = [String(newMajorVersion), '0', '0'].join(
            VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR,
          );
          break;
        case undefined:
          newVersion = NEW_PACKAGE_INITIAL_VERSION;
          break;
        default:
          consola.warn(
            `Error determining new version for package ${packageName}: update type ${updateType} not supported.`,
          );
      }
    }

    if (!this.remoteLibrary) return;
    if (!this.packageFileGenerator) return;

    if (newVersion) {
      const remotePackageConfig =
        await this.remoteLibrary.findPublishedPackageMetadata(
          packageName,
          newVersion,
        );

      if (!remotePackageConfig) {
        const packageMetadata = await this.findPackageMetadata(packageName);
        if (packageMetadata?.config && packageMetadata?.path) {
          const { config, path } = packageMetadata;
          const { name, library, collection, includeFromProjectRoot } = config;
          this.packageFileGenerator.generateLocalConfigFile({
            name,
            library,
            collection,
            version: newVersion,
            packagePath: path,
            rootPath: this.cliWorkingDir,
            includeFromProjectRoot,
          });
          return true;
        } else {
          consola.warn(`Error finding ${packageName} config file.`);
          return false;
        }
      } else {
        consola.warn(
          `Version ${newVersion} of ${packageName} has already been published.`,
        );
        return false;
      }
    } else {
      consola.warn(`Error updating ${packageName} config file.`);
      return false;
    }
  }

  /* ------------------------------------------------------------------------ */
  public async publishPackage(
    packageName: string,
    updateType?: VERSION_UPDATE_TYPES,
  ) {
    if (!this.remoteLibrary) return;

    const isUpdateSuccess = await this.updatePackageVersion(
      packageName,
      updateType,
    );

    if (isUpdateSuccess) {
      const packagesFilesAndMetadata = await this.grabPackageFilesAndMetadata(
        packageName,
      );

      if (
        packagesFilesAndMetadata?.path &&
        packagesFilesAndMetadata?.packageFiles &&
        packagesFilesAndMetadata?.config
      ) {
        const { path, packageFiles, config } = packagesFilesAndMetadata;

        await this.remoteLibrary.publishPackage({
          name: packageName,
          version: config.version,
          files: packageFiles,
          packageLocalRelativePath: path.replace(this.cliWorkingDir, ''),
          collection: config.collection,
          library: config.library,
        });
      }
    }
  }

  /* ========================== INSTALLING PACKAGES ========================= */

  /* ------------------------------------------------------------------------ */
  public async installPackage({
    packageFiles,
    packageName,
    packageRemotePath,
    packageLocalPath,
    version,
  }: {
    packageFiles: TReaddirFileExtended[];
    packageName: string;
    packageRemotePath: string;
    packageLocalPath: string;
    version: string;
  }) {
    const packageMetadata = await this.findPackageMetadata(packageName);
    const remotePackageMetadata =
      (await this.remoteLibrary?.findPublishedPackageMetadata(
        packageName,
        version,
      )) as TPackageMetadata;

    if (packageMetadata?.config.version === version) {
      consola.warn(
        `Package ${packageName}@${version} is already installed in this project.`,
      );
    } else {
      await this.packageFileGenerator?.deleteDirectory(
        path.join(this.cliWorkingDir, packageLocalPath),
      );

      let packageWithFilesFromProjectRoot = false;
      if (remotePackageMetadata && !Array.isArray(remotePackageMetadata)) {
        if (remotePackageMetadata.config.includeFromProjectRoot) {
          packageWithFilesFromProjectRoot = true;
        }
      }

      for (const file of packageFiles) {
        const {
          name,
          path: filePath,
          fullname: fileFullname,
          data: fileContents,
        } = file;

        if (!this.packageFileGenerator) return;

        const basePath = path.join(this.cliWorkingDir, packageLocalPath);

        const directoryRelativePath = filePath.replace(packageRemotePath, '');

        const fileRelativePath = fileFullname.replace(packageRemotePath, '');

        await this.packageFileGenerator.generateFile({
          basePath,
          directoryRelativePath,
          fileRelativePath,
          fileContents,
        });
      }

      consola.log(`Package ${packageName}@${version} successfully installed!`);
    }
  }
}
