import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runMigrateContributionTypes } from '../contributions/migrate-types.js';

/* ========================================================================== */
/*                  MIGRATE-CONTRIBUTION-TYPES COMMAND                        */
/* ========================================================================== */

/**
 * `lib migrate-contribution-types [name] [--dry-run]`
 *
 * One-shot: walks each contributing library and, if its
 * `i18n/types.ts` is the placeholder shape, replaces it with a single
 * re-export from `@beautifulbits/lib`. Files without the placeholder
 * anchor (i.e. user-customized) are skipped with a warning.
 */
export class MigrateContributionTypesCommand extends Command {
  static override paths = [['migrate-contribution-types']];

  static override usage = Command.Usage({
    description:
      'Collapse each library\'s placeholder i18n/types.ts to an @beautifulbits/lib re-export',
    details: `
      Walks every library that declares \`contributions.i18n\` in lib.cfg.
      For each library's \`<libRoot>/i18n/types.ts\`, if the file matches
      the placeholder shape (carries the PLACEHOLDER comment and both
      \`TLibraryI18nMessages\` / \`TLibraryI18nNode\` declarations), it is
      replaced with a single re-export line:

        export type { TLibraryI18nMessages, TLibraryI18nNode } from '@beautifulbits/lib';

      Files without the PLACEHOLDER anchor (user-customized) are skipped
      with a warning. Already-migrated files are detected and skipped.
      Idempotent.
    `,
    examples: [
      ['Migrate every library', '$0 migrate-contribution-types'],
      ['Migrate one library', '$0 migrate-contribution-types tectonic'],
      ['Preview without writing', '$0 migrate-contribution-types --dry-run'],
    ],
  });

  name = Option.String({ required: false });

  dryRun = Option.Boolean('-n,--dry-run', false, {
    description: 'Show planned changes without writing files.',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run from the host project root.',
      );
      return 1;
    }

    const hostRoot = process.cwd();
    const localLibraryPath = path.join(hostRoot, sharedCfg.localLibraryPath);

    const result = await runMigrateContributionTypes({
      hostRoot,
      localLibraryPath,
      name: this.name,
      dryRun: this.dryRun,
    });

    console.log();
    console.log(
      bold('@beautifulbits/lib migrate-contribution-types') +
        dim('  →  ' + hostRoot),
    );
    if (this.dryRun) {
      console.log(yellow('mode: dry-run — no files will be written'));
    }
    console.log();

    if (!result.ok) {
      console.log(`  ${red('✗')} ${result.error}`);
      console.log();
      return 1;
    }

    let migrated = 0;
    let skipped = 0;
    let warned = 0;
    for (const c of result.changes) {
      let sigil = dim('·');
      if (c.kind === 'migrate') {
        sigil = green('↻');
        migrated++;
      } else if (c.kind === 'skip-customized') {
        sigil = yellow('!');
        warned++;
      } else {
        skipped++;
      }
      const file = c.file ? `  ${dim(c.file)}` : '';
      const msg = c.message ? `  ${dim('— ' + c.message)}` : '';
      console.log(`  ${sigil} @${c.lib}${file}${msg}`);
    }
    console.log();
    console.log(bold('summary'));
    const verb = this.dryRun ? 'would migrate' : 'migrated';
    console.log(
      `  ${migrated} ${verb}; ${skipped} skipped; ${warned} warning${warned === 1 ? '' : 's'}`,
    );
    console.log();
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
