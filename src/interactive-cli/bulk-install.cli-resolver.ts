import consola from 'consola';
import { UNPUBLISHED_VERSION } from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { PackageDiffing } from '../package-diffing.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import {
  BULK_TOGGLE_SENTINELS,
  MainCommandsCliPrompt,
} from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

/* ================================ INTERFACE =============================== */
interface IBulkInstallCliResolverInitFn {
  verbose?: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  mainCommandsCliResolver: MainCommandsCliResolver;
}

type BulkRow = {
  key: string;
  packageName: string;
  library: string;
  collection: string;
  localVersion: string;
  remoteVersion: string;
  /** number of files that differ between local and remote latest version,
   *  null when comparison wasn't requested or couldn't be performed. */
  diffCount: number | null;
};

/* ========================================================================== */
/*                         BULK INSTALL CLI RESOLVER                          */
/* ========================================================================== */
export class BulkInstallCliResolver {
  verbose?: boolean;
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;
  mainCommandsCliPrompt?: MainCommandsCliPrompt;
  mainCommandsCliResolver?: MainCommandsCliResolver;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    mainCommandsCliPrompt,
    mainCommandsCliResolver,
  }: IBulkInstallCliResolverInitFn) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveBulkInstallPrompt() {
    if (
      !this.localLibrary ||
      !this.remoteLibrary ||
      !this.mainCommandsCliPrompt ||
      !this.mainCommandsCliResolver
    ) {
      return;
    }

    const rows = await collectBulkRows(this.localLibrary, this.remoteLibrary);

    if (rows.length === 0) {
      consola.warn('No installed packages found to update.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    const { header, choices, rowByKey } = formatBulkRows(rows);
    const selected = new Set<string>();

    const selectedKeys = await runToggleLoop({
      mainCommandsCliPrompt: this.mainCommandsCliPrompt,
      message:
        'Toggle each package with Enter. Cursor over Confirm/Cancel to commit/abort.',
      header,
      rows: choices,
      selected,
      confirmLabel: 'Install / update selected packages',
      allKeys: rows.map((row) => row.key),
    });

    if (selectedKeys === null) {
      // Cancelled.
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    const installable = selectedKeys
      .map((key) => rowByKey.get(key))
      .filter((row): row is BulkRow => Boolean(row))
      .filter((row) => {
        if (row.remoteVersion === UNPUBLISHED_VERSION) {
          consola.warn(
            `Skipping ${row.packageName}: no remote version published.`,
          );
          return false;
        }
        return true;
      });

    if (installable.length === 0) {
      consola.info('Nothing to install. Returning to main menu.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    consola.info('About to install / overwrite the following packages:');
    installable.forEach((row) => {
      consola.log(
        `  ${row.packageName}: ${row.localVersion}  →  ${row.remoteVersion}`,
      );
    });

    const confirmed: boolean = await this.mainCommandsCliPrompt
      .confirmBulkActionPrompt(
        `Install ${installable.length} package(s)? Local files will be replaced.`,
      )
      .run()
      .catch((error: unknown) => {
        promptErrorHandler(error);
        return false;
      });

    if (!confirmed) {
      consola.info('Bulk install aborted. Returning to main menu.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    for (const row of installable) {
      consola.info(
        `Installing ${row.packageName}@${row.remoteVersion} (was ${row.localVersion})`,
      );
      await this.remoteLibrary.installPackage({
        packageName: row.packageName,
        version: row.remoteVersion,
      });
    }

    consola.success(
      `Bulk install finished: ${installable.length} package(s) processed.`,
    );
    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
  }
}

/* ========================================================================== */
/*                              TOGGLE-LOOP RUNNER                            */
/* ========================================================================== */

/* Drive togglePackagesPrompt in a loop. Returns the selected keys on commit
 * or null on cancel. Shared between bulk install and bulk publish. */
export async function runToggleLoop({
  mainCommandsCliPrompt,
  message,
  header,
  rows,
  selected,
  confirmLabel,
  allKeys,
}: {
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  message: string;
  header: string;
  rows: { key: string; message: string }[];
  selected: Set<string>;
  confirmLabel: string;
  allKeys: string[];
}): Promise<string[] | null> {
  let initialIndex = 0;

  while (true) {
    const prompt = mainCommandsCliPrompt.togglePackagesPrompt({
      message,
      header,
      rows,
      selected,
      confirmLabel,
      initialIndex,
    });

    const answer: string | null = await prompt
      .run()
      .catch((error: unknown) => {
        promptErrorHandler(error);
        return null;
      });

    if (answer === null || answer === BULK_TOGGLE_SENTINELS.cancel) {
      return null;
    }

    if (answer === BULK_TOGGLE_SENTINELS.confirm) {
      return Array.from(selected);
    }

    if (answer === BULK_TOGGLE_SENTINELS.toggleAll) {
      if (selected.size === allKeys.length) {
        selected.clear();
      } else {
        allKeys.forEach((key) => selected.add(key));
      }
      // Re-render with cursor on the "Toggle all" row so user can flip again.
      initialIndex = rows.length + 1; // rows + separator
      continue;
    }

    // It's a package row — toggle it.
    if (selected.has(answer)) {
      selected.delete(answer);
    } else {
      selected.add(answer);
    }
    // Keep the cursor on the just-toggled row.
    const idx = rows.findIndex((r) => r.key === answer);
    if (idx >= 0) initialIndex = idx;
  }
}

/* ========================================================================== */
/*                                  HELPERS                                   */
/* ========================================================================== */

/* Walk the local catalog and pair each package with its remote latest. If a
 * PackageDiffing instance is provided, also count files that differ between
 * the local copy and the latest remote version (parallelized). */
export async function collectBulkRows(
  localLibrary: LocalLibrary,
  remoteLibrary: RemoteLibrary,
  packageDiffing?: PackageDiffing,
): Promise<BulkRow[]> {
  await localLibrary.getInstalledPackagesCatalog();
  const catalog = localLibrary.packagesCatalog;

  const baseRows: Omit<BulkRow, 'remoteVersion' | 'diffCount'>[] = [];
  Object.keys(catalog).forEach((library) => {
    Object.keys(catalog[library]).forEach((collection) => {
      Object.keys(catalog[library][collection]).forEach((packageName) => {
        const versions = Object.keys(catalog[library][collection][packageName]);
        const localVersion = versions.sort(compareSemverDesc)[0] ?? UNPUBLISHED_VERSION;
        baseRows.push({
          key: `${library}/${collection}/${packageName}`,
          packageName,
          library,
          collection,
          localVersion,
        });
      });
    });
  });

  const remoteVersions = await Promise.all(
    baseRows.map((row) =>
      remoteLibrary
        .getRemotePackageLatestVersion(row.packageName)
        .catch(() => UNPUBLISHED_VERSION),
    ),
  );

  let diffCounts: (number | null)[] = baseRows.map(() => null);
  if (packageDiffing) {
    consola.info(
      `Computing file differences for ${baseRows.length} package(s)…`,
    );
    diffCounts = await Promise.all(
      baseRows.map((row, index) =>
        packageDiffing
          .countDifferentFiles(row.packageName, remoteVersions[index])
          .catch(() => null),
      ),
    );
  }

  return baseRows.map((row, index) => ({
    ...row,
    remoteVersion: remoteVersions[index],
    diffCount: diffCounts[index],
  }));
}

/* Build padded table rows for the MultiSelect, plus a header line and a
 * key→row lookup so the resolver can find each row again after selection. If
 * any row has a `diffCount`, an extra "changes" column is appended. */
export function formatBulkRows(rows: BulkRow[]) {
  const padTo = (value: string, width: number) =>
    value + ' '.repeat(Math.max(0, width - value.length));

  const showChanges = rows.some((r) => r.diffCount !== null);
  const renderDiff = (count: number | null) =>
    count === null ? '?' : String(count);

  const widths = {
    packageName: Math.max(
      'package'.length,
      ...rows.map((r) => r.packageName.length),
    ),
    collection: Math.max(
      'collection'.length,
      ...rows.map((r) => r.collection.length),
    ),
    library: Math.max('library'.length, ...rows.map((r) => r.library.length)),
    localVersion: Math.max(
      'local'.length,
      ...rows.map((r) => r.localVersion.length),
    ),
    remoteVersion: Math.max(
      'remote'.length,
      ...rows.map((r) => r.remoteVersion.length),
    ),
    changes: Math.max(
      'changes'.length,
      ...rows.map((r) => renderDiff(r.diffCount).length),
    ),
  };

  const renderRow = (
    packageName: string,
    collection: string,
    library: string,
    localVersion: string,
    remoteVersion: string,
    changes: string,
  ) => {
    const cols = [
      padTo(packageName, widths.packageName),
      padTo(collection, widths.collection),
      padTo(library, widths.library),
      padTo(localVersion, widths.localVersion),
      padTo(remoteVersion, widths.remoteVersion),
    ];
    if (showChanges) cols.push(padTo(changes, widths.changes));
    return cols.join('   ');
  };

  const header = renderRow(
    'package',
    'collection',
    'library',
    'local',
    'remote',
    'changes',
  );

  const choices = rows.map((row) => ({
    key: row.key,
    message: renderRow(
      row.packageName,
      row.collection,
      row.library,
      row.localVersion,
      row.remoteVersion,
      renderDiff(row.diffCount),
    ),
  }));

  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  return { header, choices, rowByKey };
}

function compareSemverDesc(a: string, b: string): number {
  const parse = (v: string) =>
    v.split('.').map((part) => parseInt(part, 10) || 0);
  const aParts = parse(a);
  const bParts = parse(b);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i += 1) {
    const ai = aParts[i] ?? 0;
    const bi = bParts[i] ?? 0;
    if (ai !== bi) return bi - ai;
  }
  return 0;
}
