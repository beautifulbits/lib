#!/usr/bin/env node
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

import { LocalLibrary } from './local-library.js';
import { RemoteLibrary } from './remote-library.js';
import { InteractiveCli } from './interactive-cli/interactive-cli.js';
import { PackageFileGenerator } from './package-file-generator.js';
import { PackageDiffing } from './package-diffing.js';
import { GetConfig } from './get-config.js';

(async () => {
  const getConfig = new GetConfig();
  const config = await getConfig.load();

  if (config) {
    const { remoteLibraryPath, localLibraryPath } = config;

    const packageFileGenerator = new PackageFileGenerator({
      verbose: false,
    });

    const remoteLibrary = new RemoteLibrary();

    const localLibrary = new LocalLibrary();

    const packageDiffing = new PackageDiffing();

    remoteLibrary.init({
      path: remoteLibraryPath,
      packageFileGenerator,
      verbose: false,
      localLibrary,
    });

    localLibrary.init({
      localLibraryDirectory: localLibraryPath,
      verbose: false,
      packageFileGenerator,
      remoteLibrary,
    });

    packageDiffing.init({
      localLibrary,
      remoteLibrary,
    });

    const interactiveCli = new InteractiveCli({
      verbose: false,
      localLibrary,
      remoteLibrary,
      packageDiffing,
    });

    interactiveCli.init();
  }
})();
