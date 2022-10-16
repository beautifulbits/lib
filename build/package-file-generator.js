import consolaGlobalInstance from 'consola';
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import mkdirp from 'mkdirp';
import consola from 'consola';
import { LIB_CONFIG_FILENAME, NEW_PACKAGE_INITIAL_VERSION, } from './helpers/constants.js';
/* ========================================================================== */
/*                        PACKAGE CONFIG FILE GENERATOR                       */
/* ========================================================================== */
export class PackageFileGenerator {
    /* ------------------------------------------------------------------------ */
    constructor({ verbose = false }) {
        this.verbose = verbose;
    }
    /* ------------------------------------------------------------------------ */
    async generateLocalConfigFile({ name, version, library, collection, packagePath, }) {
        const packageConfig = {
            name,
            library,
            collection,
            version: version ? version : NEW_PACKAGE_INITIAL_VERSION,
        };
        const fileContents = JSON.stringify(packageConfig, null, 2);
        try {
            const configFilePath = path.join(packagePath, LIB_CONFIG_FILENAME);
            await fs.promises.writeFile(configFilePath, fileContents);
            if (this.verbose) {
                consola.log(`Config file for package ${name} created: ${configFilePath}`);
            }
        }
        catch (writeFileError) {
            consolaGlobalInstance.error(`Unable to create config file for ${name}:`, writeFileError);
        }
    }
    /* ------------------------------------------------------------------------ */
    async generateFile({ basePath, directoryRelativePath, fileRelativePath, fileContents, }) {
        const directoryPath = path.join(basePath, directoryRelativePath);
        const filePath = path.join(basePath, fileRelativePath);
        try {
            // First create directory for output file before attempting to
            // create the file
            try {
                await fs.promises.access(directoryPath);
            }
            catch {
                await mkdirp(directoryPath);
                if (this.verbose) {
                    consola.log(`Directory created: ${directoryPath}`);
                }
            }
            // Create the file
            await fs.promises.writeFile(filePath, fileContents);
            if (this.verbose) {
                consola.log(boxen(fileContents, {
                    padding: 1,
                    margin: 1,
                    title: `${filePath}`,
                    titleAlignment: 'center',
                    borderStyle: 'double',
                    borderColor: 'green',
                }));
            }
        }
        catch (writeFileError) {
            consola.error(`Unable to write file: ${filePath}\n${writeFileError}\n`);
            process.exit(1);
        }
    }
}
//# sourceMappingURL=package-file-generator.js.map