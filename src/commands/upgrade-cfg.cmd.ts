import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runUpgradeLibCfg } from '../init/upgrade-lib-cfg.js';

/* ========================================================================== */
/*                            UPGRADE-CFG COMMAND                             */
/* ========================================================================== */

/**
 * `lib upgrade-cfg [name] [--dry-run]` — adds new-format fields (alias,
 * libRoot, stacks, dependencies, devDependencies, typescript, description)
 * to an existing library's lib.cfg, leaving every existing field untouched.
 *
 * Strictly additive — never overwrites or removes anything. Safe to run
 * repeatedly.
 */
export class UpgradeCfgCommand extends Command {
  static override paths = [['upgrade-cfg']];

  static override usage = Command.Usage({
    description: 'Add new-format fields to an existing library lib.cfg',
    details: `
      Walks every library directory under \`localLibraryPath\` (or one
      named library, if given) and adds the new optional manifest fields
      that aren't yet present:

        alias, libRoot, stacks, dependencies, devDependencies,
        typescript, description

      Existing fields — name, library, collection, version, path, date,
      includeFromProjectRoot, and any new fields you've already filled in —
      are NEVER overwritten. Re-running is a no-op.

      Workflow ports (test/storybook/docs) and the ai.claudeMd reference
      are intentionally NOT added because they imply concrete tooling
      decisions you should make by hand.

      Use \`--dry-run\` to preview which fields would be added before
      writing.
    `,
    examples: [
      ['Upgrade every library lib.cfg in this project', '$0 upgrade-cfg'],
      ['Upgrade one library', '$0 upgrade-cfg schematic'],
      ['Preview without writing', '$0 upgrade-cfg --dry-run'],
    ],
  });

  name = Option.String({ required: false });

  dryRun = Option.Boolean('-n,--dry-run', false, {
    description: 'Show planned additions without writing files.',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run `lib project-init` first.',
      );
      return 1;
    }

    const result = await runUpgradeLibCfg({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name: this.name,
      dryRun: this.dryRun,
    });

    if (!result.ok) {
      consola.error(result.error);
      return 1;
    }

    /* ---------- print report ---------- */
    const cwd = process.cwd();
    const changed = result.reports.filter((r) => r.changed);
    const errored = result.reports.filter((r) => r.error);
    const noChanges = result.reports.filter((r) => !r.changed && !r.error);

    console.log();
    console.log(
      bold('@beautifulbits/lib upgrade-cfg') + dim('  →  ' + cwd),
    );
    if (this.dryRun) {
      console.log(yellow('mode: dry-run — no files will be written'));
    }
    console.log();

    if (errored.length > 0) {
      for (const r of errored) {
        console.log(`  ${red('✗')} ${r.name}: ${r.error}`);
      }
      console.log();
    }

    for (const r of changed) {
      const verb = this.dryRun ? 'would add' : 'added';
      console.log(`${bold('@' + r.name)} ${dim('— ' + path.relative(cwd, r.cfgPath))}`);
      for (const field of r.fieldsAdded) {
        console.log(`  ${green('+')} ${field}  ${dim('(' + verb + ')')}`);
      }
      console.log();
    }

    /* ---------- summary ---------- */
    const total = result.reports.length;
    console.log(bold('summary'));
    console.log(
      `  ${total} librar${total === 1 ? 'y' : 'ies'} processed; ` +
        `${changed.length} ${this.dryRun ? 'would be updated' : 'updated'}; ` +
        `${noChanges.length} already up to date` +
        (errored.length > 0 ? `; ${errored.length} errored` : ''),
    );
    console.log();
    return errored.length > 0 ? 1 : 0;
  }
}

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
