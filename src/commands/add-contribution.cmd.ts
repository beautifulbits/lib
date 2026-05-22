import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runAddContribution } from '../contributions/scaffold.js';

/* ========================================================================== */
/*                       ADD-CONTRIBUTION COMMAND                             */
/* ========================================================================== */

/**
 * `lib add-contribution <libname> [--with-tailwind-plugin] [--dry-run]`
 *
 * Scaffolds the contribution convention (i18n, optionally tailwind plugin)
 * for an existing library that doesn't yet have it. Idempotent — files
 * that already exist are skipped, not overwritten.
 */
export class AddContributionCommand extends Command {
  static override paths = [['add-contribution']];

  static override usage = Command.Usage({
    description:
      'Scaffold contribution files (i18n, optional tailwind plugin) for a library',
    details: `
      Creates the convention files under \`<libRoot>/i18n/\` and
      (with \`--with-tailwind-plugin\`) \`<libRoot>/tailwind-plugin/\`, and
      updates \`lib.cfg\` to declare the matching \`contributions\` block.

      Idempotent: existing files are skipped, never overwritten. Existing
      cfg keys are preserved.

      The empty \`{ <name>: {} }\` namespace ships day-one so the registry
      codegen can pick the lib up immediately; populate the namespace as
      the lib grows.
    `,
    examples: [
      ['Scaffold i18n only', '$0 add-contribution harmonic'],
      [
        'Scaffold i18n + tailwind plugin',
        '$0 add-contribution somelib --with-tailwind-plugin',
      ],
      ['Preview without writing', '$0 add-contribution harmonic --dry-run'],
    ],
  });

  libname = Option.String({ required: true });

  withTailwindPlugin = Option.Boolean('--with-tailwind-plugin', false, {
    description: 'Also scaffold a tailwind-plugin/index.ts entry.',
  });

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
    const localLibBase = path.join(hostRoot, sharedCfg.localLibraryPath);
    const libDir = path.join(localLibBase, this.libname);

    if (!(await isDirectory(libDir))) {
      consola.error(
        `No library directory at ${path.relative(hostRoot, libDir)} — ` +
          `pass a valid library name.`,
      );
      return 1;
    }

    const result = await runAddContribution({
      libDir,
      withTailwindPlugin: this.withTailwindPlugin,
      dryRun: this.dryRun,
    });

    console.log();
    console.log(
      bold('@beautifulbits/lib add-contribution') + dim('  →  ' + libDir),
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

    console.log(bold(`@${result.name}`));
    for (const c of result.changes) {
      const sigil =
        c.kind === 'add' ? green('+') : c.kind === 'skip' ? dim('·') : yellow('!');
      const tail = c.message ? dim(` — ${c.message}`) : '';
      console.log(`  ${sigil} ${c.file}${tail}`);
    }
    console.log();

    /* ---------- summary ---------- */
    const adds = result.changes.filter((c) => c.kind === 'add').length;
    const skips = result.changes.filter((c) => c.kind === 'skip').length;
    const verb = this.dryRun ? 'would write' : 'wrote';
    console.log(bold('summary'));
    console.log(
      `  ${adds} ${verb}; ${skips} skipped (already present)`,
    );
    console.log();

    return 0;
  }
}

/* -------------------------------------------------------------------------- */

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
