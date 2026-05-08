import boxen from 'boxen';
import consola from 'consola';
import { TPackageConfig } from './@types/package-config.js';
import { TReaddirFileExtended } from './@types/readdir-file.js';
import { LocalLibrary } from './local-library.js';
import { RemoteLibrary } from './remote-library.js';
import * as diff from 'diff';
import * as CLI_COLORS from './helpers/cli-colors.js';
import { UNPUBLISHED_VERSION } from './helpers/constants.js';

/* ================================ INTERFACE =============================== */
interface IPackageDiffingInitFn {
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
}

type FileDiffStatus = 'unchanged' | 'changed' | 'local-only';
type DiffMode = 'added' | 'removed' | 'context';

/* ========================================================================== */
/*                               PACKAGE DIFFING                              */
/* ========================================================================== */
export class PackageDiffing {
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;

  /* ------------------------------------------------------------------------ */
  public init({ localLibrary, remoteLibrary }: IPackageDiffingInitFn) {
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
  }

  /* ------------------------------------------------------------------------ */
  /** Count how many files differ between the local copy of a package and the
   *  given remote version. Files that exist only on one side count as one
   *  difference each. Returns null if either side could not be loaded.
   *
   *  When the remote is `unpublished`, every local file is effectively a
   *  difference, so the local file count is returned. */
  public async countDifferentFiles(
    packageName: string,
    remoteVersion: string,
  ): Promise<number | null> {
    if (!this.localLibrary) return null;

    const local = await this.localLibrary.grabPackageFilesAndMetadata(
      packageName,
    );
    if (!local) return null;

    if (remoteVersion === UNPUBLISHED_VERSION) {
      return local.packageFiles.length;
    }

    const remote = await this.remoteLibrary?.grabPackageFilesAndMetadata(
      packageName,
      remoteVersion,
    );
    if (!remote) return null;

    const localPath = local.path;
    const remotePath = remote.path;

    const remoteByRel = new Map<string, string>();
    for (const file of remote.packageFiles) {
      remoteByRel.set(file.fullname.replace(remotePath, ''), file.data);
    }

    let count = 0;
    const seenRel = new Set<string>();

    for (const file of local.packageFiles) {
      const rel = file.fullname.replace(localPath, '');
      seenRel.add(rel);
      const remoteContent = remoteByRel.get(rel);
      if (remoteContent === undefined) {
        count += 1; // file exists only locally
      } else if (remoteContent !== file.data) {
        count += 1; // file content differs
      }
    }

    for (const rel of remoteByRel.keys()) {
      if (!seenRel.has(rel)) count += 1; // file exists only remotely
    }

    return count;
  }

  /* ------------------------------------------------------------------------ */
  public async diffWithRemotePackage(
    packageName: string,
    selectedRemoteVersion: string,
  ) {
    if (!this.localLibrary) return;

    const localFilesAndMetadata =
      await this.localLibrary.grabPackageFilesAndMetadata(packageName);

    const remoteFilesAndMetadata =
      await this.remoteLibrary?.grabPackageFilesAndMetadata(
        packageName,
        selectedRemoteVersion,
      );

    if (!localFilesAndMetadata || !remoteFilesAndMetadata) return;

    this.printLegend(packageName, selectedRemoteVersion);

    const localPackagePath = localFilesAndMetadata.path;
    const localPackageFiles = localFilesAndMetadata.packageFiles;

    let unchangedCount = 0;
    let changedCount = 0;
    let localOnlyCount = 0;

    for (const localPackageFile of localPackageFiles) {
      const relativeLocalFilename = localPackageFile.fullname.replace(
        localPackagePath,
        '',
      );
      const localFileData = localPackageFile.data;

      const remoteFileData = this.findRemotePackageFile({
        relativeLocalFilename,
        remoteFilesAndMetadata,
      });

      const status = this.printDiff({
        localFileData,
        remoteFileData,
        relativeLocalFilename,
        remoteVersion: selectedRemoteVersion,
      });

      if (status === 'unchanged') unchangedCount += 1;
      else if (status === 'changed') changedCount += 1;
      else if (status === 'local-only') localOnlyCount += 1;
    }

    const newRemotePackageFiles = this.findNewRemotePackageFiles({
      localFilesAndMetadata,
      remoteFilesAndMetadata,
    });

    newRemotePackageFiles.forEach(([newFilename, newFileContents]) => {
      const subtitle = [
        `This file exists in remote@${selectedRemoteVersion} but NOT in your local copy.`,
        `Installing the remote version would add this file to local.`,
        ``,
      ].join('\n');

      const newFileLines = newFileContents.split('\n');
      const newFileLinesToPrint = newFileLines.map(
        (line, index) =>
          `${CLI_COLORS.FgGreen}${index}. ${line}${CLI_COLORS.Reset}`,
      );

      consola.log(
        boxen(subtitle + newFileLinesToPrint.join('\n'), {
          title: `ONLY IN REMOTE · ${newFilename}`,
          padding: 1,
          margin: 1,
          borderColor: 'green',
          textAlignment: 'left',
          dimBorder: true,
        }),
      );
    });

    this.printSummary({
      unchangedCount,
      changedCount,
      localOnlyCount,
      remoteOnlyCount: newRemotePackageFiles.length,
    });
  }

  /* ------------------------------------------------------------------------ */
  private printLegend(packageName: string, remoteVersion: string) {
    const lines = [
      `Comparing local copy of ${packageName} with remote@${remoteVersion}`,
      ``,
      `Inside a changed file, hunks are framed by a section header:`,
      `  ${CLI_COLORS.FgRed}ONLY IN LOCAL${CLI_COLORS.Reset}  (red)   = lines that exist only in your local copy`,
      `  ${CLI_COLORS.FgGreen}ONLY IN REMOTE${CLI_COLORS.Reset} (green) = lines that exist only in the remote copy`,
      `Lines without a header are unchanged context.`,
      ``,
      `${CLI_COLORS.FgRed}ONLY IN LOCAL${CLI_COLORS.Reset}  files exist only in your local copy (red box)`,
      `${CLI_COLORS.FgGreen}ONLY IN REMOTE${CLI_COLORS.Reset} files exist only in the remote copy (green box)`,
      ``,
      `Unchanged files are hidden — counts are reported in the summary at the end.`,
    ];

    consola.log(
      boxen(lines.join('\n'), {
        title: 'Diff legend',
        padding: 1,
        margin: 1,
        borderColor: 'cyan',
        textAlignment: 'left',
        dimBorder: true,
      }),
    );
  }

  /* ------------------------------------------------------------------------ */
  private printSummary({
    unchangedCount,
    changedCount,
    localOnlyCount,
    remoteOnlyCount,
  }: {
    unchangedCount: number;
    changedCount: number;
    localOnlyCount: number;
    remoteOnlyCount: number;
  }) {
    const lines = [
      `Unchanged files:        ${unchangedCount}`,
      `Changed files:          ${changedCount}`,
      `Files only in local:    ${localOnlyCount}`,
      `Files only in remote:   ${remoteOnlyCount}`,
    ];

    consola.log(
      boxen(lines.join('\n'), {
        title: 'Summary',
        padding: 1,
        margin: 1,
        borderColor: 'cyan',
        textAlignment: 'left',
      }),
    );
  }

  /* ------------------------------------------------------------------------ */
  private findRemotePackageFile({
    relativeLocalFilename,
    remoteFilesAndMetadata,
  }: {
    relativeLocalFilename: string;
    remoteFilesAndMetadata: {
      path: string;
      config: TPackageConfig;
      packageFiles: TReaddirFileExtended[];
    };
  }): string | undefined {
    let fileContents = undefined;

    if (remoteFilesAndMetadata?.packageFiles && remoteFilesAndMetadata?.path) {
      const remotePackagePath = remoteFilesAndMetadata.path;
      const remotePackageFiles = remoteFilesAndMetadata.packageFiles;

      remotePackageFiles.some((remotePackageFile) => {
        const relativeRemoteFilename = remotePackageFile.fullname.replace(
          remotePackagePath,
          '',
        );
        if (relativeRemoteFilename === relativeLocalFilename) {
          fileContents = remotePackageFile.data;
          return true;
        }
      });
    }
    return fileContents;
  }

  /* ------------------------------------------------------------------------ */
  private findNewRemotePackageFiles({
    remoteFilesAndMetadata,
    localFilesAndMetadata,
  }: {
    remoteFilesAndMetadata: {
      path: string;
      config: TPackageConfig;
      packageFiles: TReaddirFileExtended[];
    };
    localFilesAndMetadata: {
      path: string;
      config: TPackageConfig;
      packageFiles: TReaddirFileExtended[];
    };
  }): string[][] {
    const notFoundPackages: string[][] = [];

    const remotePackagePath = remoteFilesAndMetadata.path;
    const remotePackageFiles = remoteFilesAndMetadata.packageFiles;

    const localPackagePath = localFilesAndMetadata.path;
    const localPackageFiles = localFilesAndMetadata.packageFiles;

    remotePackageFiles.forEach((remotePackageFile) => {
      const relativeRemoteFilename = remotePackageFile.fullname.replace(
        remotePackagePath,
        '',
      );

      let packageFound = false;

      localPackageFiles.some((localPackageFile) => {
        const relativeLocalFilename = localPackageFile.fullname.replace(
          localPackagePath,
          '',
        );
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
  private printDiff({
    localFileData,
    remoteFileData,
    relativeLocalFilename,
    remoteVersion,
  }: {
    localFileData: string;
    remoteFileData?: string;
    relativeLocalFilename: string;
    remoteVersion: string;
  }): FileDiffStatus {
    if (!remoteFileData) {
      // File exists locally but not in remote — show contents in red so the
      // user can see what would disappear if they synced from remote.
      const subtitle = [
        `This file exists in your local copy but NOT in remote@${remoteVersion}.`,
        `Installing the remote version would remove this file from local.`,
        ``,
      ].join('\n');

      const localLines = localFileData.split('\n');
      const printable = localLines.map(
        (line, index) =>
          `${CLI_COLORS.FgRed}${index}. ${line}${CLI_COLORS.Reset}`,
      );
      consola.log(
        boxen(subtitle + printable.join('\n'), {
          title: `ONLY IN LOCAL · ${relativeLocalFilename}`,
          padding: 1,
          margin: 1,
          borderColor: 'red',
          textAlignment: 'left',
          dimBorder: true,
        }),
      );
      return 'local-only';
    }

    const differences = diff.diffLines(localFileData, remoteFileData, {
      ignoreWhitespace: false,
    });

    let lineCount = 0;
    let diffFound = false;
    const fileContentsPrint: string[] = [];
    let prevMode: DiffMode = 'context';

    differences.forEach((difference) => {
      let mode: DiffMode = 'context';
      let textColor = CLI_COLORS.Reset;
      let label: string | null = null;

      if (difference.added) {
        mode = 'added';
        textColor = CLI_COLORS.FgGreen;
        label = 'ONLY IN REMOTE';
        diffFound = true;
      } else if (difference.removed) {
        mode = 'removed';
        textColor = CLI_COLORS.FgRed;
        label = 'ONLY IN LOCAL';
        diffFound = true;
      }

      // Entering a labeled (added/removed) hunk: emit a section header.
      if (label !== null && prevMode !== mode) {
        fileContentsPrint.push('\n');
        fileContentsPrint.push(`${textColor}${label}${CLI_COLORS.Reset}\n`);
        fileContentsPrint.push('\n');
      } else if (label === null && prevMode !== 'context') {
        // Leaving a labeled hunk back to context: visual breathing room.
        fileContentsPrint.push('\n');
      }

      prevMode = mode;

      const splittedSentences = difference.value.split('\n');
      const splittedSentencesWithoutExtraElement = splittedSentences.slice(
        0,
        -1,
      );
      splittedSentencesWithoutExtraElement.forEach((sentence) => {
        fileContentsPrint.push(
          `${textColor}${lineCount}. ${sentence}${CLI_COLORS.Reset}\n`,
        );
        ++lineCount;
      });
    });

    if (diffFound) {
      consola.log(
        boxen(fileContentsPrint.join(''), {
          title: relativeLocalFilename,
          padding: 1,
          margin: 1,
          textAlignment: 'left',
          borderColor: 'yellow',
        }),
      );
      return 'changed';
    }

    // Unchanged files: deliberately silent — they are tallied in the summary.
    return 'unchanged';
  }
}
