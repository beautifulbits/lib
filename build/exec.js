#!/usr/bin/env node
import { LocalLibrary } from './local-library.js';
import { RemoteLibrary } from './remote-library.js';
import { InteractiveCli } from './interactive-cli/interactive-cli.js';
import { PackageFileGenerator } from './package-file-generator.js';
const remoteLibraryPath = `/Users/Nathaniel/Code/lib`;
const libDir = `/src/lib/`;
(async () => {
    const packageFileGenerator = new PackageFileGenerator({
        verbose: false,
    });
    const remoteLibrary = new RemoteLibrary({
        path: remoteLibraryPath,
        packageFileGenerator,
        verbose: false,
    });
    const localLibrary = new LocalLibrary({
        localLibraryDirectory: libDir,
        verbose: false,
        packageFileGenerator,
        remoteLibrary,
    });
    const interactiveCli = new InteractiveCli({
        verbose: false,
        localLibrary,
        remoteLibrary,
    });
    interactiveCli.init();
})();
