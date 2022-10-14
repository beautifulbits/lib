import { TPackageMetadata } from './package-metadata';

type TCollectionPackages = {
  [collectionName: string]: TPackageMetadata;
};

type TLibraryCollections = {
  [libraryName: string]: TCollectionPackages[];
};

export type TLocalPackageCatalog = {
  [libraryName: string]: TCollectionPackages[];
};
