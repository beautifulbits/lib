import { promises as fs } from 'node:fs';
import path from 'node:path';
import consola from 'consola';
import { LIB_CONFIG_FILENAME, NEW_PACKAGE_INITIAL_VERSION, UNPUBLISHED_VERSION, VERSION_UPDATE_TYPES, VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR, } from './helpers/constants.js';
import { showPackagesAsTable } from './helpers/show-packages-as-table.js';
import { getPackagesFromCatalog } from './helpers/get-packages-from-catalog.js';
import { listFiles, listSubdirectories } from './helpers/fs.js';
import { readProjectIdentity } from './helpers/project-identity.js';
/* ========================================================================== */
/*                                LOCAL LIBRARY                               */
/* ========================================================================== */
export class LocalLibrary {
    cliWorkingDir;
    libConfigFiles;
    libDir;
    libPath;
    packageFileGenerator;
    packagesCatalog;
    remoteLibrary;
    usageRegistry;
    verbose;
    /* ------------------------------------------------------------------------ */
    constructor() {
        this.packagesCatalog = {};
        this.libConfigFiles = [];
        this.cliWorkingDir = process.cwd();
    }
    /* ------------------------------------------------------------------------ */
    init({ localLibraryDirectory, verbose = false, packageFileGenerator, remoteLibrary, usageRegistry, }) {
        this.libDir = localLibraryDirectory;
        this.libPath = path.join(this.cliWorkingDir, this.libDir);
        this.packageFileGenerator = packageFileGenerator;
        this.remoteLibrary = remoteLibrary;
        this.usageRegistry = usageRegistry;
        this.verbose = verbose;
    }
    /* =========================== SCANNING LIBRARY =========================== */
    /* ------------------------------------------------------------------------ */
    /**
     * Local libraries are organized as one top-level directory per library.
     * Each library's `lib.cfg` lives at the library's root, so we don't need
     * to recursively walk — listing immediate subdirectories of `libPath` and
     * checking for a `lib.cfg` in each is O(N libraries).
     */
    async findLibConfigFiles() {
        if (!this.libPath)
            return;
        try {
            if (this.verbose) {
                consola.log(`Scanning ${this.libPath} for modules.`);
            }
            const subdirs = await listSubdirectories(this.libPath);
            const cfgFiles = await Promise.all(subdirs.map(async (dir) => {
                const cfgPath = path.join(dir, LIB_CONFIG_FILENAME);
                try {
                    const data = await fs.readFile(cfgPath, 'utf8');
                    return {
                        name: LIB_CONFIG_FILENAME,
                        title: 'lib',
                        path: dir,
                        fullname: cfgPath,
                        extension: 'cfg',
                        isDirectory: false,
                        data,
                    };
                }
                catch {
                    return null;
                }
            }));
            this.libConfigFiles = cfgFiles.filter((f) => f !== null);
            if (this.verbose) {
                consola.log(`Found modules:`, this.libConfigFiles);
            }
        }
        catch (scanError) {
            consola.error(`Unable to scan directory: ${scanError}`);
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
            }
            else {
                consola.warn('Duplicated package version found in local library.', path, configData, installedVersion);
            }
        });
    }
    /* =========================== LISTING PACKAGES =========================== */
    /* ------------------------------------------------------------------------ */
    async getInstalledLibraries() {
        await this.getInstalledPackagesCatalog();
        return Object.keys(this.packagesCatalog);
    }
    /* ------------------------------------------------------------------------ */
    async getInstalledCollections(selectedLibrary) {
        await this.getInstalledPackagesCatalog();
        return Object.keys(this.packagesCatalog[selectedLibrary]);
    }
    /* ------------------------------------------------------------------------ */
    async getInstalledPackages(selectedLibrary, selectedCollection) {
        await this.getInstalledPackagesCatalog();
        return getPackagesFromCatalog(this.packagesCatalog, selectedLibrary, selectedCollection);
    }
    /* ------------------------------------------------------------------------ */
    async showInstalledPackagesAsTable(selectedLibrary, selectedCollection, selectedPackage) {
        await this.getInstalledPackagesCatalog();
        await showPackagesAsTable(this.packagesCatalog, selectedLibrary, selectedCollection, selectedPackage, this.remoteLibrary);
    }
    /* ======================== GETTING PACKAGE DETAILS ======================= */
    /* ------------------------------------------------------------------------ */
    async findPackageMetadata(selectedPackage) {
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
    async getInstalledPackageVersion(packageName) {
        const packageMetadata = await this.findPackageMetadata(packageName);
        if (packageMetadata?.config?.version) {
            return String(packageMetadata.config.version);
        }
        return UNPUBLISHED_VERSION;
    }
    /* ------------------------------------------------------------------------ */
    async grabPackageFilesAndMetadata(packageName) {
        const packageMetadata = await this.findPackageMetadata(packageName);
        if (packageMetadata?.path && packageMetadata?.config) {
            const { path: packagePath, config } = packageMetadata;
            try {
                let files = [];
                if (config.includeFromProjectRoot &&
                    Array.isArray(config.includeFromProjectRoot) &&
                    config.includeFromProjectRoot.length > 0) {
                    const fromProjectRootFiles = await listFiles({
                        cwd: this.cliWorkingDir,
                        patterns: config.includeFromProjectRoot,
                        readContent: true,
                    });
                    const packageConfigFile = await listFiles({
                        cwd: packagePath,
                        patterns: ['**/*'],
                        readContent: true,
                    });
                    files = [...fromProjectRootFiles, ...packageConfigFile];
                }
                else {
                    files = await listFiles({
                        cwd: packagePath,
                        patterns: ['**/*'],
                        readContent: true,
                    });
                }
                const packageFiles = files.map((file) => ({
                    ...file,
                    relativePath: file.path.replace(this.cliWorkingDir, ''),
                }));
                return {
                    path: packagePath,
                    config,
                    packageFiles,
                };
            }
            catch (scanError) {
                consola.error(`Unable to scan directory: ${scanError}`);
                process.exit(1);
            }
        }
        return undefined;
    }
    /* ========================== PUBLISHING PACKAGES ========================= */
    /* ------------------------------------------------------------------------ */
    async updatePackageVersion(packageName, updateType) {
        let newVersion;
        const currentVersion = await this.getInstalledPackageVersion(packageName);
        if (currentVersion === UNPUBLISHED_VERSION) {
            newVersion = NEW_PACKAGE_INITIAL_VERSION;
        }
        else {
            const versionTuple = currentVersion.split(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR);
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
                    newVersion = [versionTuple[0], String(newMinorVersion), '0'].join(`.`);
                    break;
                case VERSION_UPDATE_TYPES.major:
                    const currentMajorVersion = Number(versionTuple[0]);
                    const newMajorVersion = currentMajorVersion + 1;
                    newVersion = [String(newMajorVersion), '0', '0'].join(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR);
                    break;
                case undefined:
                    newVersion = NEW_PACKAGE_INITIAL_VERSION;
                    break;
                default:
                    consola.warn(`Error determining new version for package ${packageName}: update type ${updateType} not supported.`);
            }
        }
        if (!this.remoteLibrary)
            return;
        if (!this.packageFileGenerator)
            return;
        if (newVersion) {
            const remotePackageConfig = await this.remoteLibrary.findPublishedPackageMetadata(packageName, newVersion);
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
                }
                else {
                    consola.warn(`Error finding ${packageName} config file.`);
                    return false;
                }
            }
            else {
                consola.warn(`Version ${newVersion} of ${packageName} has already been published.`);
                return false;
            }
        }
        else {
            consola.warn(`Error updating ${packageName} config file.`);
            return false;
        }
    }
    /* ------------------------------------------------------------------------ */
    async publishPackage(packageName, updateType) {
        if (!this.remoteLibrary)
            return;
        const isUpdateSuccess = await this.updatePackageVersion(packageName, updateType);
        if (isUpdateSuccess) {
            const packagesFilesAndMetadata = await this.grabPackageFilesAndMetadata(packageName);
            if (packagesFilesAndMetadata?.path &&
                packagesFilesAndMetadata?.packageFiles &&
                packagesFilesAndMetadata?.config) {
                const { path, packageFiles, config } = packagesFilesAndMetadata;
                await this.remoteLibrary.publishPackage({
                    name: packageName,
                    version: config.version,
                    files: packageFiles,
                    packageLocalRelativePath: path.replace(this.cliWorkingDir, ''),
                    collection: config.collection,
                    library: config.library,
                });
                // Best-effort usage registry update — never block publish on it.
                if (this.usageRegistry) {
                    try {
                        await this.usageRegistry.recordPublish({
                            libName: packageName,
                            version: config.version,
                        });
                    }
                    catch (err) {
                        consola.warn(`usage registry not updated after publish: ${err.message}`);
                    }
                }
            }
        }
    }
    /* ========================== INSTALLING PACKAGES ========================= */
    /* ------------------------------------------------------------------------ */
    async installPackage({ packageFiles, packageName, packageRemotePath, packageLocalPath, version, }) {
        const packageMetadata = await this.findPackageMetadata(packageName);
        const remotePackageMetadata = (await this.remoteLibrary?.findPublishedPackageMetadata(packageName, version));
        if (packageMetadata?.config.version === version) {
            consola.warn(`Package ${packageName}@${version} is already installed in this project.`);
        }
        else {
            await this.packageFileGenerator?.deleteDirectory(path.join(this.cliWorkingDir, packageLocalPath));
            let packageWithFilesFromProjectRoot = false;
            if (remotePackageMetadata && !Array.isArray(remotePackageMetadata)) {
                if (remotePackageMetadata.config.includeFromProjectRoot) {
                    packageWithFilesFromProjectRoot = true;
                }
            }
            for (const file of packageFiles) {
                const { name, path: filePath, fullname: fileFullname, data: fileContents, } = file;
                if (!this.packageFileGenerator)
                    return;
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
            // Best-effort usage registry update — never block install on it.
            if (this.usageRegistry) {
                try {
                    const identity = await readProjectIdentity(this.cliWorkingDir);
                    await this.usageRegistry.recordInstall({
                        projectName: identity.name,
                        projectPath: identity.path,
                        libName: packageName,
                        version,
                    });
                }
                catch (err) {
                    consola.warn(`usage registry not updated after install: ${err.message}`);
                }
            }
        }
    }
}
//# sourceMappingURL=local-library.js.map