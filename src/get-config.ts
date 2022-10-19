import fs from 'fs';
import path from 'path';
import consola from 'consola';

const SHARED_LIB_CFG_FILENAME = 'sharedlib.cfg';

/* ========================================================================== */
/*                                 GET CONFIG                                 */
/* ========================================================================== */
export class GetConfig {
  cliWorkingDir: string;

  /* ------------------------------------------------------------------------ */
  constructor() {
    this.cliWorkingDir = process.cwd();
  }

  /* ------------------------------------------------------------------------ */
  async load(): Promise<
    | {
        remoteLibraryPath: string;
        localLibraryPath: string;
      }
    | undefined
  > {
    try {
      const configFilePath = path.join(
        this.cliWorkingDir,
        SHARED_LIB_CFG_FILENAME,
      );
      const fileData = await fs.promises.readFile(configFilePath, {
        encoding: 'utf8',
      });
      const data = JSON.parse(fileData);
      return {
        remoteLibraryPath: data.remoteLibraryPath,
        localLibraryPath: data.localLibraryPath,
      };
    } catch (err) {
      consola.error('Error loading shared-lib config file', err);
    }
  }
}
