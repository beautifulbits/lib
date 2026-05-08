import consola from 'consola';
import {
  INTERACTIVE_CLI_COMMANDS,
  NEW_PACKAGE_INITIAL_VERSION,
  UNPUBLISHED_VERSION,
  VERSION_UPDATE_TYPES,
  VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR,
} from '../helpers/constants.js';
import { LocalLibrary } from '../local-library.js';
import { RemoteLibrary } from '../remote-library.js';
import { PackageDiffing } from '../package-diffing.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import {
  BUMP_TYPE_SCALE_VALUES,
  MainCommandsCliPrompt,
} from './main-commands.cli-prompt.js';
import { MainCommandsCliResolver } from './main-commands.cli-resolver.js';
import {
  collectBulkRows,
  formatBulkRows,
  runToggleLoop,
} from './bulk-install.cli-resolver.js';

/* ================================ INTERFACE =============================== */
interface IBulkPublishCliResolverInitFn {
  verbose?: boolean;
  localLibrary: LocalLibrary;
  remoteLibrary: RemoteLibrary;
  packageDiffing: PackageDiffing;
  mainCommandsCliPrompt: MainCommandsCliPrompt;
  mainCommandsCliResolver: MainCommandsCliResolver;
}

/* ========================================================================== */
/*                         BULK PUBLISH CLI RESOLVER                          */
/* ========================================================================== */
export class BulkPublishCliResolver {
  verbose?: boolean;
  localLibrary?: LocalLibrary;
  remoteLibrary?: RemoteLibrary;
  packageDiffing?: PackageDiffing;
  mainCommandsCliPrompt?: MainCommandsCliPrompt;
  mainCommandsCliResolver?: MainCommandsCliResolver;

  /* ------------------------------------------------------------------------ */
  init({
    verbose = true,
    localLibrary,
    remoteLibrary,
    packageDiffing,
    mainCommandsCliPrompt,
    mainCommandsCliResolver,
  }: IBulkPublishCliResolverInitFn) {
    this.verbose = verbose;
    this.localLibrary = localLibrary;
    this.remoteLibrary = remoteLibrary;
    this.packageDiffing = packageDiffing;
    this.mainCommandsCliPrompt = mainCommandsCliPrompt;
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  /* ------------------------------------------------------------------------ */
  async resolveBulkPublishPrompt() {
    if (
      !this.localLibrary ||
      !this.remoteLibrary ||
      !this.mainCommandsCliPrompt ||
      !this.mainCommandsCliResolver
    ) {
      return;
    }

    const rows = await collectBulkRows(
      this.localLibrary,
      this.remoteLibrary,
      this.packageDiffing,
    );

    if (rows.length === 0) {
      consola.warn('No local packages found to publish.');
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
      confirmLabel: 'Choose bump types and publish selected packages',
      allKeys: rows.map((row) => row.key),
    });

    if (selectedKeys === null) {
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    const selectedRows = selectedKeys
      .map((key) => rowByKey.get(key))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (selectedRows.length === 0) {
      consola.info('Nothing to publish. Returning to main menu.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    // Single-screen Survey: pick a bump type for every selected package at
    // once. Result is { [packageKey]: 'patch' | 'minor' | 'major' | 'Skip' }.
    const surveyPrompt = this.mainCommandsCliPrompt.bumpTypesSurveyPrompt(
      selectedRows.map((row) => ({
        key: row.key,
        label: `${row.packageName.padEnd(28)}  local ${row.localVersion}  ·  remote ${row.remoteVersion}`,
      })),
    );

    // Survey returns { [name]: scaleIdx } where scaleIdx is the numeric index
    // into the scale array. Map it back through BUMP_TYPE_SCALE_VALUES.
    const surveyAnswers = (await surveyPrompt.run().catch((error: unknown) => {
      promptErrorHandler(error);
      return {};
    })) as Record<string, number>;

    const plan: {
      packageName: string;
      bumpType: VERSION_UPDATE_TYPES;
      currentVersion: string;
      nextVersion: string;
    }[] = [];

    for (const row of selectedRows) {
      const idx = surveyAnswers[row.key];
      const bumpAnswer =
        typeof idx === 'number' && BUMP_TYPE_SCALE_VALUES[idx] !== undefined
          ? BUMP_TYPE_SCALE_VALUES[idx]
          : INTERACTIVE_CLI_COMMANDS.skip;

      if (bumpAnswer === INTERACTIVE_CLI_COMMANDS.skip) {
        consola.info(`Skipped ${row.packageName}.`);
        continue;
      }
      const bumpType = bumpAnswer as VERSION_UPDATE_TYPES;
      plan.push({
        packageName: row.packageName,
        bumpType,
        currentVersion: row.localVersion,
        nextVersion: bumpVersion(row.localVersion, bumpType),
      });
    }

    if (plan.length === 0) {
      consola.info('Nothing to publish. Returning to main menu.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    consola.info('About to publish:');
    plan.forEach((item) => {
      consola.log(
        `  ${item.packageName}: ${item.currentVersion}  →  ${item.nextVersion}  (${item.bumpType})`,
      );
    });

    const confirmed: boolean = await this.mainCommandsCliPrompt
      .confirmBulkActionPrompt(
        `Publish ${plan.length} package(s) with the bumps above?`,
      )
      .run()
      .catch((error: unknown) => {
        promptErrorHandler(error);
        return false;
      });

    if (!confirmed) {
      consola.info('Bulk publish aborted. Returning to main menu.');
      await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
      return;
    }

    for (const item of plan) {
      consola.info(
        `Publishing ${item.packageName} ${item.currentVersion} → ${item.nextVersion} (${item.bumpType})`,
      );
      await this.localLibrary.publishPackage(item.packageName, item.bumpType);
    }

    consola.success(
      `Bulk publish finished: ${plan.length} package(s) processed.`,
    );
    await this.mainCommandsCliResolver.resolveMainCommandsPrompt();
  }
}

/* Mirror the bump logic in LocalLibrary.updatePackageVersion so the preview
 * shown to the user matches what the publish will actually produce. */
function bumpVersion(
  current: string,
  bumpType: VERSION_UPDATE_TYPES,
): string {
  if (current === UNPUBLISHED_VERSION) {
    return NEW_PACKAGE_INITIAL_VERSION;
  }
  const parts = current
    .split(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR)
    .map((part) => parseInt(part, 10) || 0);
  while (parts.length < 3) parts.push(0);
  const [major, minor, patch] = parts;
  if (bumpType === VERSION_UPDATE_TYPES.major) {
    return [major + 1, 0, 0].join(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR);
  }
  if (bumpType === VERSION_UPDATE_TYPES.minor) {
    return [major, minor + 1, 0].join(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR);
  }
  return [major, minor, patch + 1].join(VERSION_UPDATE_TYPE_SEMANTIC_SEPARATOR);
}
