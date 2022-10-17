import boxen from 'boxen';
import consola from 'consola';
import * as diff from 'diff';
import * as CLI_COLORS from './helpers/cli-colors.js';
/* ========================================================================== */
/*                               PACKAGE DIFFING                              */
/* ========================================================================== */
export class PackageDiffing {
    /* ------------------------------------------------------------------------ */
    init({ localLibrary, remoteLibrary }) {
        this.localLibrary = localLibrary;
        this.remoteLibrary = remoteLibrary;
    }
    /* ------------------------------------------------------------------------ */
    async diffWithRemotePackage(packageName, selectedRemoteVersion) {
        if (!this.localLibrary)
            return;
        const localFilesAndMetadata = await this.localLibrary.grabPackageFilesAndMetadata(packageName);
        const remoteFilesAndMetadata = await this.remoteLibrary?.grabPackageFilesAndMetadata(packageName, selectedRemoteVersion);
        if (localFilesAndMetadata && remoteFilesAndMetadata) {
            const localPackagePath = localFilesAndMetadata.path;
            const localPackageFiles = localFilesAndMetadata.packageFiles;
            localPackageFiles.forEach(async (localPackageFile) => {
                const relativeLocalFilename = localPackageFile.fullname.replace(localPackagePath, '');
                const localFileData = localPackageFile.data;
                const remoteFileData = await this.findRemotePackageFile({
                    relativeLocalFilename,
                    remoteFilesAndMetadata,
                });
                this.printDiff({
                    localFileData,
                    remoteFileData,
                    relativeLocalFilename,
                });
            });
            const newRemotePackageFiles = this.findNewRemotePackageFiles({
                localFilesAndMetadata,
                remoteFilesAndMetadata,
            });
            newRemotePackageFiles.forEach(([newFilename, newFileContents]) => {
                const newFileSentences = newFileContents.split('\n');
                const newFileSentencesToPrint = newFileSentences.map((sentence, index) => `${CLI_COLORS.FgGreen}${index}. ${sentence}`);
                consola.log(boxen([newFileSentencesToPrint.join('\n')].join(''), {
                    title: newFilename,
                    padding: 1,
                    margin: 1,
                    borderColor: 'green',
                    textAlignment: 'left',
                    dimBorder: true,
                }));
            });
        }
    }
    /* ------------------------------------------------------------------------ */
    findRemotePackageFile({ relativeLocalFilename, remoteFilesAndMetadata, }) {
        let fileContents = undefined;
        if (remoteFilesAndMetadata?.packageFiles && remoteFilesAndMetadata?.path) {
            const remotePackagePath = remoteFilesAndMetadata.path;
            const remotePackageFiles = remoteFilesAndMetadata.packageFiles;
            remotePackageFiles.some((remotePackageFile) => {
                const relativeRemoteFilename = remotePackageFile.fullname.replace(remotePackagePath, '');
                if (relativeRemoteFilename === relativeLocalFilename) {
                    fileContents = remotePackageFile.data;
                    return true;
                }
            });
        }
        return fileContents;
    }
    /* ------------------------------------------------------------------------ */
    findNewRemotePackageFiles({ remoteFilesAndMetadata, localFilesAndMetadata, }) {
        const notFoundPackages = [];
        const remotePackagePath = remoteFilesAndMetadata.path;
        const remotePackageFiles = remoteFilesAndMetadata.packageFiles;
        const localPackagePath = localFilesAndMetadata.path;
        const localPackageFiles = localFilesAndMetadata.packageFiles;
        remotePackageFiles.forEach((remotePackageFile) => {
            const relativeRemoteFilename = remotePackageFile.fullname.replace(remotePackagePath, '');
            let packageFound = false;
            localPackageFiles.some((localPackageFile) => {
                const relativeLocalFilename = localPackageFile.fullname.replace(localPackagePath, '');
                if (relativeRemoteFilename === relativeLocalFilename) {
                    packageFound = true;
                    return true;
                }
            });
            if (!packageFound) {
                notFoundPackages.push([relativeRemoteFilename, remotePackageFile.data]);
            }
        });
        return notFoundPackages;
    }
    /* ------------------------------------------------------------------------ */
    printDiff({ localFileData, remoteFileData, relativeLocalFilename, }) {
        if (!remoteFileData) {
            consola.log(boxen([CLI_COLORS.FgRed, 'deleted'].join(''), {
                title: relativeLocalFilename,
                padding: 0,
                margin: 1,
                borderColor: 'red',
                textAlignment: 'center',
                dimBorder: true,
            }));
        }
        else {
            const differences = diff.diffLines(localFileData, remoteFileData, {
                ignoreWhitespace: false,
            });
            let lineCount = 0;
            let diffFound = false;
            let fileContentsPrint = [];
            differences.forEach((difference) => {
                let textColor = CLI_COLORS.Reset;
                if (difference.added) {
                    textColor = CLI_COLORS.FgGreen;
                    diffFound = true;
                }
                if (difference.removed) {
                    textColor = CLI_COLORS.FgRed;
                    diffFound = true;
                }
                if (!difference.added && !difference.removed) {
                    textColor = CLI_COLORS.Reset;
                }
                const splittedSentences = difference.value.split('\n');
                const splittedSentencesWithoutExtraElement = splittedSentences.slice(0, -1);
                if (splittedSentencesWithoutExtraElement) {
                    splittedSentencesWithoutExtraElement.forEach((sentence) => {
                        fileContentsPrint.push(textColor);
                        fileContentsPrint.push(`${lineCount}. ${sentence}\n`);
                        ++lineCount;
                    });
                }
            });
            if (diffFound) {
                consola.log(boxen(fileContentsPrint.join(''), {
                    title: relativeLocalFilename,
                    padding: 1,
                    margin: 1,
                    textAlignment: 'left',
                    borderColor: 'yellow',
                }));
            }
            else {
                consola.log(boxen([CLI_COLORS.FgBlue, 'no changes'].join(''), {
                    title: relativeLocalFilename,
                    padding: 0,
                    margin: 1,
                    titleAlignment: 'center',
                    borderColor: 'blue',
                    textAlignment: 'center',
                    dimBorder: true,
                }));
            }
        }
    }
}
//# sourceMappingURL=package-diffing.js.map