import fs from 'fs';
import path from 'path';
import consola from 'consola';
const SHARED_LIB_CFG_FILENAME = 'sharedlib.cfg';
/* ========================================================================== */
/*                                 GET CONFIG                                 */
/* ========================================================================== */
export class GetConfig {
    /* ------------------------------------------------------------------------ */
    constructor() {
        this.cliWorkingDir = process.cwd();
    }
    /* ------------------------------------------------------------------------ */
    async load() {
        try {
            const configFilePath = path.join(this.cliWorkingDir, SHARED_LIB_CFG_FILENAME);
            const fileData = await fs.promises.readFile(configFilePath, {
                encoding: 'utf8',
            });
            const data = JSON.parse(fileData);
            return {
                remoteLibraryPath: data.remoteLibraryPath,
                localLibraryPath: data.localLibraryPath,
            };
        }
        catch (err) {
            consola.error('Error loading shared-lib config file', err);
        }
    }
}
//# sourceMappingURL=get-config.js.map