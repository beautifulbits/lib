export function getPackagesFromCatalog(packagesCatalog, selectedLibrary, selectedCollection) {
    const packages = [];
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
//# sourceMappingURL=get-packages-from-catalog.js.map