import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runSync } from '../host-sync/orchestrator.js';
import { printSyncReport } from '../host-sync/print-report.js';
import { UsageRegistry } from '../usage-registry/index.js';

/* ========================================================================== */
/*                              SYNC COMMAND                                  */
/* ========================================================================== */

/**
 * `lib sync [name] [--dry-run] [--check]`
 *
 * Reads each library's `lib.cfg` under `localLibraryPath` (from
 * `sharedlib.cfg`) and applies host-wiring patches to the current
 * project. Idempotent — re-running is safe.
 *
 * Modes:
 *   - default  → apply changes to host configs
 *   - --dry-run → preview, write nothing
 *   - --check  → dry-run + exit 1 if anything would change (CI mode)
 */
export class SyncCommand extends Command {
  static override paths = [['sync']];

  static override usage = Command.Usage({
    description: 'Apply each library\'s host wiring (deps, aliases, scripts)',
    details: `
      Reads every \`lib.cfg\` under the configured \`localLibraryPath\` and
      patches the host project's \`package.json\`, \`tsconfig.json\`,
      \`next.config.*\`, \`jest.config.*\`, \`.storybook/main.*\`, and
      \`CLAUDE.md\` so each library can be consumed and run in isolation.

      Re-running this command is safe and idempotent — only changed entries
      are written. Use \`--dry-run\` to preview, or \`--check\` for CI to
      fail when host configuration has drifted from the manifests.
    `,
    examples: [
      ['Apply wiring for all libraries', '$0 sync'],
      ['Apply wiring for one library only', '$0 sync schematic'],
      ['Preview the changes without writing', '$0 sync --dry-run'],
      ['Fail if anything would change (CI)', '$0 sync --check'],
    ],
  });

  name = Option.String({ required: false });

  dryRun = Option.Boolean('-n,--dry-run', false, {
    description: 'Show planned changes without writing files.',
  });

  check = Option.Boolean('--check', false, {
    description: 'Exit non-zero if any changes would be applied. Implies --dry-run.',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run sync from a project root.',
      );
      return 1;
    }

    const hostRoot = process.cwd();
    // Match the existing tool's convention: localLibraryPath is always
    // host-root-relative, even when it starts with `/`. A literal leading
    // slash in `sharedlib.cfg` means "from project root", not absolute.
    const localLibraryPath = path.join(hostRoot, sharedCfg.localLibraryPath);

    const dryRun = this.check || this.dryRun;
    const usageRegistry = new UsageRegistry(sharedCfg.remoteLibraryPath);

    let report;
    try {
      report = await runSync({
        hostRoot,
        localLibraryPath,
        libraryFilter: this.name,
        dryRun,
        usageRegistry,
      });
    } catch (err) {
      consola.error((err as Error).message);
      return 1;
    }

    printSyncReport(report);

    // --check: exit code reflects whether host has drift
    if (this.check) {
      return report.totals.changes > 0 ? 1 : 0;
    }
    return 0;
  }
}
