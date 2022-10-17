export const LIB_CONFIG_FILENAME = `lib.cfg`;
export const INTERACTIVE_CLI_COMMANDS = {
    compareInstalledPackageWithRemote: `Compare installed package with remote`,
    detectPackageDependencies: `Detect package dependencies`,
    exit: `Exit`,
    getInstalledPackageVersion: `Get installed package version`,
    getRemotePackageLatestVersion: `Get package latest published version`,
    initLib: `Init LIB`,
    initPackageDirectory: `Init package (directory)`,
    initPackageSingleFile: `Init package (single file)`,
    installPackageDependencies: `Install package dependencies`,
    listInstalledPackages: `List installed packages`,
    listRemotePackages: `List remote packages`,
    listRemotePackageVersions: `List remote package versions`,
    publishPackage: `Publish package`,
    installPackage: `Install package`,
    showAll: `Show all`,
    updateInstalledPackage: 'Update installed package',
};
export var VERSION_UPDATE_TYPES;
(function (VERSION_UPDATE_TYPES) {
    VERSION_UPDATE_TYPES["patch"] = "patch";
    VERSION_UPDATE_TYPES["minor"] = "minor";
    VERSION_UPDATE_TYPES["major"] = "major";
})(VERSION_UPDATE_TYPES || (VERSION_UPDATE_TYPES = {}));
export const VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR = '.';
export const NEW_PACKAGE_INITIAL_VERSION = `1.0.0`;
export const UNPUBLISHED_VERSION = `unpublished`;
//# sourceMappingURL=constants.js.map