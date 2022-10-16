import { TPackageMetadata } from './package-metadata';

type TPackageVersions = {
  [versionNumber: string]: TPackageMetadata;
};

type TCollectionPackages = {
  [packageName: string]: TPackageVersions;
};

export type TLibraryCollections = {
  [collectionName: string]: TCollectionPackages;
};

export type TPackagesCatalog = {
  [libraryName: string]: TLibraryCollections;
};
