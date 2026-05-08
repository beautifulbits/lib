import Table from 'cli-table';
import consola from 'consola';
import { UNPUBLISHED_VERSION } from './constants.js';
import type { TPackagesCatalog } from '../@types/packages-catalog.js';

interface IRemoteLatestVersionResolver {
  getRemotePackageLatestVersion(packageName: string): Promise<string>;
}

export async function showPackagesAsTable(
  packagesCatalog: TPackagesCatalog,
  selectedLibrary?: string,
  selectedCollection?: string,
  selectedPackage?: string,
  remoteLibrary?: IRemoteLatestVersionResolver,
) {
  const showLatest = Boolean(remoteLibrary);

  const head = showLatest
    ? [`Package`, `Version`, `Latest`, `Collection`, `Library`]
    : [`Package`, `Version`, `Collection`, `Library`];

  const table = new Table({ head });

  const rows: Array<{
    packageName: string;
    version: string;
    collectionName: string;
    libraryName: string;
  }> = [];

  Object.keys(packagesCatalog).forEach((libraryName) => {
    const library = packagesCatalog[libraryName];

    if (!selectedLibrary || selectedLibrary === libraryName) {
      Object.keys(library).forEach((collectionName) => {
        const collection = library[collectionName];

        if (!selectedCollection || selectedCollection === collectionName) {
          Object.keys(collection).forEach((packageName) => {
            const packageVersions = collection[packageName];

            if (!selectedPackage || selectedPackage === packageName) {
              Object.keys(packageVersions).forEach((version) => {
                rows.push({ packageName, version, collectionName, libraryName });
              });
            }
          });
        }
      });
    }
  });

  let latestByPackage: Record<string, string> = {};
  if (showLatest && remoteLibrary) {
    const uniquePackageNames = Array.from(
      new Set(rows.map((row) => row.packageName)),
    );
    const latestVersions = await Promise.all(
      uniquePackageNames.map((name) =>
        remoteLibrary
          .getRemotePackageLatestVersion(name)
          .catch(() => UNPUBLISHED_VERSION),
      ),
    );
    uniquePackageNames.forEach((name, index) => {
      latestByPackage[name] = latestVersions[index];
    });
  }

  rows.forEach(({ packageName, version, collectionName, libraryName }) => {
    if (showLatest) {
      const latest = latestByPackage[packageName] ?? UNPUBLISHED_VERSION;
      table.push([
        packageName,
        version,
        latest,
        collectionName,
        libraryName,
      ]);
    } else {
      table.push([packageName, version, collectionName, libraryName]);
    }
  });

  consola.log(table.toString());
}
