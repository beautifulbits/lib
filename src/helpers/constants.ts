export const LIB_CONFIG_FILENAME = `lib.cfg`;

export const INTERACTIVE_CLI_COMMANDS = {
  compareInstalledPackageWithRemote: `Compare installed package with remote`,
  detectDeps: `Detect library dependencies (scan imports → lib.cfg)`,
  installDeps: `Install missing dependencies (host package.json + libraries)`,
  couplings: `Generate app-coupling reports (markdown per library)`,
  detectPackageDependencies: `Detect package dependencies`,
  exit: `Exit`,
  getInstalledPackageVersion: `Get installed package version`,
  getRemotePackageLatestVersion: `Get package latest published version`,
  initLib: `Init LIB`,
  initPackageDirectory: `Init package (directory)`,
  initPackageSingleFile: `Init package (single file)`,
  initProject: `Init project (write sharedlib.cfg)`,
  initLibrary: `Init library directory (scaffold a new shared library)`,
  upgradeCfg: `Upgrade lib.cfg (add new fields to existing libraries)`,
  openDocs: `Open @beautifulbits/lib docs in browser`,
  installPackageDependencies: `Install package dependencies`,
  listInstalledPackages: `List installed packages`,
  listRemotePackages: `List remote packages`,
  listRemotePackageVersions: `List remote package versions`,
  publishPackage: `Publish package`,
  publishMultiplePackages: `Publish multiple packages`,
  installPackage: `Install package`,
  installMultiplePackages: `Install / update multiple packages`,
  skip: `Skip`,
  showAll: `Show all`,
  showUsage: `Show usage registry`,
  syncHost: `Sync host configuration`,
  updateInstalledPackage: 'Update installed package',
};

export enum VERSION_UPDATE_TYPES {
  patch = `patch`,
  minor = `minor`,
  major = `major`,
}

export const VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR = '.';

export const NEW_PACKAGE_INITIAL_VERSION = `1.0.0`;

export const UNPUBLISHED_VERSION = `unpublished`;
