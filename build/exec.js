#!/usr/bin/env node
import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();
import { LocalLibrary } from './local-library.js';
import { RemoteLibrary } from './remote-library.js';
import { InteractiveCli } from './interactive-cli/interactive-cli.js';
import { PackageFileGenerator } from './package-file-generator.js';
const remoteLibraryPath = `/Users/Nathaniel/Code/shared-lib`;
const libDir = `/src/lib/`;
(async () => {
    const packageFileGenerator = new PackageFileGenerator({
        verbose: false,
    });
    const remoteLibrary = new RemoteLibrary();
    const localLibrary = new LocalLibrary();
    remoteLibrary.init({
        path: remoteLibraryPath,
        packageFileGenerator,
        verbose: false,
        localLibrary,
    });
    localLibrary.init({
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
//# sourceMappingURL=exec.js.map