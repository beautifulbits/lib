import { promises as fs } from 'node:fs';
import path from 'node:path';
import boxen from 'boxen';
import consola from 'consola';
import { LIB_CONFIG_FILENAME, NEW_PACKAGE_INITIAL_VERSION, } from './helpers/constants.js';
/* ========================================================================== */
/*                        PACKAGE CONFIG FILE GENERATOR                       */
/* ========================================================================== */
export class PackageFileGenerator {
    verbose;
    /* ------------------------------------------------------------------------ */
    constructor({ verbose = false }) {
        this.verbose = verbose;
    }
    /* ------------------------------------------------------------------------ */
    async deleteDirectory(path) {
        try {
            await fs.access(path);
            await fs.rm(path, { recursive: true });
        }
        catch {
            if (this.verbose) {
                consola.warn(`Didn't delete ${path}. Directory doesn't exists in project.`);
            }
        }
    }
    /* ------------------------------------------------------------------------ */
    async generateLocalConfigFile({ name, version, library, collection, packagePath, rootPath, includeFromProjectRoot = [], }) {
        const packageConfig = {
            name,
            library,
            collection,
            version: version ? version : NEW_PACKAGE_INITIAL_VERSION,
            path: packagePath.replace(rootPath, ''),
            date: new Date().toUTCString(),
            includeFromProjectRoot,
        };
        const fileContents = JSON.stringify(packageConfig, null, 2);
        try {
            const configFilePath = path.join(packagePath, LIB_CONFIG_FILENAME);
            await fs.writeFile(configFilePath, fileContents);
            if (this.verbose) {
                consola.log(`Config file for package ${name} created: ${configFilePath}`);
            }
        }
        catch (writeFileError) {
            consola.error(`Unable to create config file for ${name}:`, writeFileError);
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
                await fs.access(directoryPath);
            }
            catch {
                await fs.mkdir(directoryPath, { recursive: true });
                if (this.verbose) {
                    consola.log(`Directory created: ${directoryPath}`);
                }
            }
            // Create the file
            await fs.writeFile(filePath, fileContents);
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