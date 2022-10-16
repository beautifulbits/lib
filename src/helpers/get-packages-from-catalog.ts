import { TPackagesCatalog } from '../@types/packages-catalog';

export function getPackagesFromCatalog(
  packagesCatalog: TPackagesCatalog,
  selectedLibrary?: string,
  selectedCollection?: string,
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
