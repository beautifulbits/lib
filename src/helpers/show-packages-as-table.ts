import Table from 'cli-table';
import consola from 'consola';
import { TPackagesCatalog } from '../@types/packages-catalog';

export function showPackagesAsTable(
  packagesCatalog: TPackagesCatalog,
  selectedLibrary?: string,
  selectedCollection?: string,
  selectedPackage?: string,
) {
  const table = new Table({
    head: [`Package`, `Version`, `Collection`, `Library`],
  });

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
                table.push([packageName, version, collectionName, libraryName]);
              });
            }
          });
        }
      });
    }
  });

  consola.log(table.toString());
}
