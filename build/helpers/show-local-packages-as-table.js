import Table from 'cli-table';
import consola from 'consola';
export function showLocalPackagesAsTable(packagesCatalog, selectedLibrary, selectedCollection, selectedPackage) {
    console.log('packagesCatalog', JSON.stringify(packagesCatalog, null, 2));
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
                        const collectionPackages = collection[packageName];
                        if (!selectedPackage || selectedPackage === packageName) {
                            Object.keys(collectionPackages).forEach((version) => {
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
