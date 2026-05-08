import path from 'node:path';
import consola from 'consola';
import boxen from 'boxen';
import { showPackagesAsTable } from './helpers/show-packages-as-table.js';
import { showVersionsAsTable } from './helpers/show-versions-as-table.js';
import { LIB_CONFIG_FILENAME, UNPUBLISHED_VERSION, } from './helpers/constants.js';
import { listFiles } from './helpers/fs.js';
import { getPackagesFromCatalog } from './helpers/get-packages-from-catalog.js';
/* ========================================================================== */
/*                               REMOTE LIBRARY                               */
/* ========================================================================== */
export class RemoteLibrary {
    libConfigFiles;
    localLibrary;
    packageFileGenerator;
    packagesCatalog;
    remoteLibraryPath;
    verbose;
    /* ------------------------------------------------------------------------ */
    constructor() {
        this.packagesCatalog = {};
        this.libConfigFiles = [];
    }
    /* ------------------------------------------------------------------------ */
    init({ path, verbose = false, packageFileGenerator, localLibrary, }) {
        this.localLibrary = localLibrary;
        this.packageFileGenerator = packageFileGenerator;
        this.remoteLibraryPath = path;
        this.verbose = verbose;
    }
    /* =========================== SCANNING LIBRARY =========================== */
    /* ------------------------------------------------------------------------ */
    /**
     * Remote libraries are organized as `library/collection/name/version/lib.cfg`,
     * so we still need a recursive scan — but a glob is faster and more focused
     * than a full readdir of every file.
     */
    async findLibConfigFiles() {
        try {
            if (!this.remoteLibraryPath)
                return;
            if (this.verbose) {
                consola.log(`Scanning ${this.remoteLibraryPath} for modules.`);
            }
            this.libConfigFiles = await listFiles({
                cwd: this.remoteLibraryPath,
                patterns: [`**/${LIB_CONFIG_FILENAME}`],
                readContent: true,
            });
            if (this.verbose) {
                consola.log(`Found remote modules:`, this.libConfigFiles);
            }
        }
        catch (scanError) {
            consola.error(`Unable to scan directory: ${scanError}`);
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
            }
            else {
                consola.warn('Duplicated package version found in local library.', path, configData);
            }
        });
    }
    /* =========================== LISTING PACKAGES =========================== */
    /* ------------------------------------------------------------------------ */
    async getRemoteLibraries() {
        await this.getPublishedPackagesCatalog();
        return Object.keys(this.packagesCatalog);
    }
    /* ------------------------------------------------------------------------ */
    async getRemoteCollections(selectedLibrary) {
        await this.getPublishedPackagesCatalog();
        return Object.keys(this.packagesCatalog[selectedLibrary]);
    }
    /* ------------------------------------------------------------------------ */
    async getRemotePackages(selectedLibrary, selectedCollection) {
        await this.getPublishedPackagesCatalog();
        return getPackagesFromCatalog(this.packagesCatalog, selectedLibrary, selectedCollection);
    }
    /* ------------------------------------------------------------------------ */
    async showRemotePackagesAsTable(selectedLibrary, selectedCollection, selectedPackage) {
        await this.getPublishedPackagesCatalog();
        await showPackagesAsTable(this.packagesCatalog, selectedLibrary, selectedCollection, selectedPackage);
    }
    /* ======================== GETTING PACKAGE DETAILS ======================= */
    /* ------------------------------------------------------------------------ */
    async findPublishedPackageMetadata(selectedPackage, selectedVersion) {
        let packageConfig;
        let packagesConfig = [];
        await this.getPublishedPackagesCatalog();
        Object.keys(this.packagesCatalog).forEach((libraryName) => {
            const library = this.packagesCatalog[libraryName];
            Object.keys(library).forEach((collectionName) => {
                const collection = library[collectionName];
                Object.keys(collection).forEach((packageName) => {
                    const packageVersions = collection[packageName];
                    Object.keys(packageVersions).forEach((versionNumber) => {
                        if (selectedVersion) {
                            if (packageName === selectedPackage &&
                                versionNumber === selectedVersion) {
                                packageConfig = packageVersions[versionNumber];
                            }
                        }
                        else {
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
                consola.warn(`Config for remote package ${selectedPackage}@${selectedVersion} not found!`);
            }
            return packageConfig;
        }
        else {
            return packagesConfig;
        }
    }
    /* ------------------------------------------------------------------------ */
    async getRemotePackageLatestVersion(packageName, show = false) {
        const packagesMetadata = await this.findPublishedPackageMetadata(packageName);
        let latestVersion = UNPUBLISHED_VERSION;
        if (packagesMetadata !== undefined && Array.isArray(packagesMetadata)) {
            packagesMetadata.forEach((packageMetadata) => {
                const packageVersion = packageMetadata.config.version;
                if (packageVersion > latestVersion ||
                    latestVersion === UNPUBLISHED_VERSION) {
                    latestVersion = packageVersion;
                }
            });
        }
        if (show) {
            if (latestVersion === UNPUBLISHED_VERSION) {
                consola.log(boxen(latestVersion));
            }
            else {
                consola.log(boxen(`${packageName}@${latestVersion}`));
            }
        }
        return latestVersion;
    }
    /* ------------------------------------------------------------------------ */
    async getRemotePackageAllVersions(packageName, show = false) {
        const packagesMetadata = await this.findPublishedPackageMetadata(packageName);
        let versions = [];
        if (packagesMetadata !== undefined && Array.isArray(packagesMetadata)) {
            packagesMetadata.forEach((packageMetadata) => {
                const packageVersion = packageMetadata.config.version;
                versions.push(packageVersion);
            });
        }
        if (show) {
            showVersionsAsTable(packageName, versions);
        }
        return versions;
    }
    /* ------------------------------------------------------------------------ */
    async grabPackageFilesAndMetadata(packageName, selectedVersion) {
        const packagesMetadata = await this.findPublishedPackageMetadata(packageName);
        if (packagesMetadata !== undefined && Array.isArray(packagesMetadata)) {
            const packageMetadata = packagesMetadata.find((test) => test.config.version === selectedVersion);
            if (packageMetadata) {
                const { path: pkgPath, config } = packageMetadata;
                try {
                    const files = await listFiles({
                        cwd: pkgPath,
                        patterns: ['**/*'],
                        readContent: true,
                    });
                    const remoteLibraryPath = this.remoteLibraryPath ?? '';
                    if (!this.remoteLibraryPath) {
                        consola.warn(`RemoteLibrary.remoteLibraryPath is not defined.`);
                    }
                    const packageFiles = files.map((file) => ({
                        ...file,
                        relativePath: file.path.replace(remoteLibraryPath, ''),
                    }));
                    return {
                        path: pkgPath,
                        config,
                        packageFiles,
                    };
                }
                catch (scanError) {
                    consola.error(`Unable to scan directory: ${scanError}`);
                    process.exit(1);
                }
            }
            else {
                consola.error(`Unable to find metadata in remote library for ${packageName}@${selectedVersion}`);
            }
        }
        else {
            consola.error(`Unable to find metadata in remote library  for ${packageName}`);
        }
    }
    /* ========================== PUBLISHING PACKAGES ========================= */
    /* ------------------------------------------------------------------------ */
    async publishPackage({ name, version, files, packageLocalRelativePath, library, collection, }) {
        const packageConfig = await this.findPublishedPackageMetadata(name, version);
        if (packageConfig) {
            consola.error(`Package ${name}@${version} already published`);
        }
        else {
            files.forEach(async (file) => {
                const packageVersionBasePath = path.join(library, collection, name, version);
                const directoryRelativePathForVersion = path.join(packageVersionBasePath, file.relativePath.replace(packageLocalRelativePath, ''));
                const fileRelativePathForVersion = path.join(packageVersionBasePath, file.relativePath.replace(packageLocalRelativePath, ''), file.name);
                if (!this.packageFileGenerator)
                    return;
                if (!this.remoteLibraryPath)
                    return;
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
    /* ========================== INSTALLING PACKAGES ========================= */
    /* ------------------------------------------------------------------------ */
    async installPackage({ packageName, version, }) {
        if (!this.localLibrary)
            return;
        const filesAndMetadata = await this.grabPackageFilesAndMetadata(packageName, version);
        if (filesAndMetadata) {
            const { packageFiles, path: packageRemotePath, config, } = filesAndMetadata;
            await this.localLibrary.installPackage({
                packageFiles,
                packageName,
                packageRemotePath,
                packageLocalPath: config.path,
                version,
            });
        }
    }
}
//# sourceMappingURL=remote-library.js.map