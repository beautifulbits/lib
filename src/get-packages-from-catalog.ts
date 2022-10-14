import { TLocalPackageCatalog } from './@types/local-package-catalog';
import { TRemotePackageCatalog } from './@types/remote-package-catalog';

export function getPackagesFromCatalog(
  packagesCatalog: TLocalPackageCatalog | TRemotePackageCatalog,
  selectedLibrary?: string,
  selectedCollection?: string
) {
  const packages: string[] = [];
  Object.keys(packagesCatalog).forEach((libraryName) => {
    const library = packagesCatalog[libraryName];

    if (!selectedLibrary || selectedLibrary === libraryName) {
      Object.keys(library).forEach((collectionName) => {
        const collection = library[collectionName];

        if (!selectedCollection || selectedCollection === collectionName) {
          Object.keys(collection).forEach((packageName) => {
            packages.push(packageName);
          });
        }
      });
    }
  });

  return packages;
}
