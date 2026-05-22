import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runGenerateRegistry } from '../contributions/registry.js';

/* ========================================================================== */
/*                       GENERATE-REGISTRY COMMAND                            */
/* ========================================================================== */

/**
 * `lib generate-registry [--dry-run] [--check]`
 *
 * Aggregates every contributing library's i18n + tailwind plugin into a
 * single TypeScript module the host imports — by default at
 * `src/.lib-generated/registry.ts`. The host wires the registry into its
 * own `src/i18n/<locale>/index.ts` and `tailwind.config.ts` once, by hand;
 * this command never touches those files.
 */
export class GenerateRegistryCommand extends Command {
  static override paths = [['generate-registry']];

  static override usage = Command.Usage({
    description:
      'Generate the aggregated library-contributions registry the host imports',
    details: `
      Walks every \`lib.cfg\` under the configured \`localLibraryPath\`,
      finds libraries with a \`contributions\` block, and emits a single
      TypeScript module the host application imports — by default at
      \`src/.lib-generated/registry.ts\`.

      The generated file exposes:
        \`libraryTranslationsEn\`     — spread of every lib's en messages
        \`libraryTranslationsEs\`     — spread of every lib's es messages
        \`libraryTailwindPlugins\`    — array of plugin factories (Tailwind 3)

      Idempotent — re-running with no changes produces a byte-identical
      file. Commit the result; do NOT gitignore.

      Host wiring (one-time, manual):
        src/i18n/<locale>/index.ts:
          import { libraryTranslationsEn } from '@/.lib-generated/registry';
          const messages = { ...common, ...libraryTranslationsEn };

        tailwind.config.ts:
          import { libraryTailwindPlugins } from './src/.lib-generated/registry';
          plugins: libraryTailwindPlugins.map((factory) => factory()),
    `,
    examples: [
      ['Generate the registry', '$0 generate-registry'],
      ['Preview without writing', '$0 generate-registry --dry-run'],
      ['Fail if registry is stale (CI)', '$0 generate-registry --check'],
    ],
  });

  dryRun = Option.Boolean('-n,--dry-run', false, {
    description: 'Show what would be written without touching the filesystem.',
  });

  check = Option.Boolean('--check', false, {
    description:
      'Exit non-zero if the on-disk registry differs from what would be generated. Implies --dry-run.',
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
    const dryRun = this.check || this.dryRun;

    const result = await runGenerateRegistry({
      hostRoot,
      localLibraryPath,
      dryRun,
    });

    /* ---------- header ---------- */
    console.log();
    console.log(
      bold('@beautifulbits/lib generate-registry') + dim('  →  ' + hostRoot),
    );
    if (dryRun) {
      console.log(yellow('mode: dry-run — no files will be written'));
    }
    console.log();

    if (!result.ok) {
      console.log(`  ${red('✗')} ${result.error}`);
      console.log();
      return 1;
    }

    /* ---------- contributors ---------- */
    const relRegistry = path.relative(hostRoot, result.registryPath);
    if (result.contributors.length === 0) {
      console.log(
        `  ${yellow('!')} No libraries declare a ` +
          bold('contributions') +
          ' block — registry will be empty.',
      );
      console.log();
    } else {
      console.log(bold('contributors') + dim(' (sorted by name)'));
      for (const c of result.contributors) {
        const tags = [
          c.contributesI18n ? 'i18n' : null,
          c.contributesTailwindPlugin ? 'tailwind-plugin' : null,
        ]
          .filter(Boolean)
          .join(', ');
        console.log(`  ${green('+')} @${c.name}  ${dim('(' + tags + ')')}`);
      }
      console.log();
    }

    /* ---------- registry status ---------- */
    console.log(bold('registry'));
    console.log(`  path: ${dim(relRegistry)}`);
    if (result.isNew) {
      const verb = dryRun ? 'would be created' : 'created';
      console.log(`  ${green('✓')} ${verb}`);
    } else if (result.willChange) {
      const verb = dryRun ? 'would be updated' : 'updated';
      console.log(`  ${green('↻')} ${verb}`);
    } else {
      console.log(`  ${dim('·')} already up to date`);
    }
    console.log();

    /* ---------- check mode ---------- */
    if (this.check && result.willChange) {
      console.log(
        red('drift') +
          ` — registry on disk differs from generated output. ` +
          `Run ${bold('lib generate-registry')} and commit the result.`,
      );
      console.log();
      return 1;
    }

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
