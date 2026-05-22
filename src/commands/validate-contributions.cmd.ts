import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runValidateContributions } from '../contributions/validate.js';

/* ========================================================================== */
/*                       VALIDATE-CONTRIBUTIONS COMMAND                       */
/* ========================================================================== */

/**
 * `lib validate-contributions [name]`
 *
 * Walks every library (or one named) and asserts the contribution shape
 * on disk matches what `lib.cfg` declares. Pure source-text checks; no
 * runtime evaluation. Errors gate CI; warnings (inverse drift like a
 * `tailwind-plugin/` dir on disk with no cfg block) report but don't fail.
 */
export class ValidateContributionsCommand extends Command {
  static override paths = [['validate-contributions']];

  static override usage = Command.Usage({
    description: 'Validate every library\'s contribution shape against its lib.cfg',
    details: `
      Walks each library and asserts:
        - i18n/index.ts re-exports <name>TranslationsEn / <name>TranslationsEs
        - i18n/{en,es}.ts each export the matching const
        - i18n/{en,es}.ts top-level namespace key equals lib.cfg.name
        - tailwind-plugin entry exports create<PascalCase(name)>Plugin
        - declared contribution paths exist on disk

      Reports inverse drift (a contribution dir exists but the cfg block is
      missing, or vice versa) as warnings.

      Exits non-zero if any errors are found. Designed for CI gating.
    `,
    examples: [
      ['Validate every library', '$0 validate-contributions'],
      ['Validate one library', '$0 validate-contributions tectonic'],
    ],
  });

  name = Option.String({ required: false });

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

    const result = await runValidateContributions({
      hostRoot,
      localLibraryPath,
      name: this.name,
    });

    console.log();
    console.log(
      bold('@beautifulbits/lib validate-contributions') + dim('  →  ' + hostRoot),
    );
    console.log();

    if (!result.ok) {
      console.log(`  ${red('✗')} ${result.error}`);
      console.log();
      return 1;
    }

    /* ---------- per-library report ---------- */
    let totalErrors = 0;
    let totalWarnings = 0;
    let cleanLibs = 0;
    for (const r of result.reports) {
      const errors = r.issues.filter((i) => i.kind === 'error');
      const warnings = r.issues.filter((i) => i.kind === 'warn');
      totalErrors += errors.length;
      totalWarnings += warnings.length;
      if (errors.length === 0 && warnings.length === 0) {
        cleanLibs++;
        console.log(`  ${green('✓')} @${r.name}  ${dim('— ok')}`);
        continue;
      }
      console.log(`  @${r.name}`);
      for (const issue of r.issues) {
        const sigil = issue.kind === 'error' ? red('✗') : yellow('!');
        const file = issue.file ? dim(`  (${issue.file})`) : '';
        console.log(`    ${sigil} ${issue.message}${file}`);
      }
    }
    console.log();

    /* ---------- summary ---------- */
    console.log(bold('summary'));
    const total = result.reports.length;
    console.log(
      `  ${total} librar${total === 1 ? 'y' : 'ies'} processed; ` +
        `${cleanLibs} clean; ` +
        `${totalErrors} error${totalErrors === 1 ? '' : 's'}; ` +
        `${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`,
    );
    console.log();

    return result.hasErrors ? 1 : 0;
  }
}

/* -------------------------------------------------------------------------- */
const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
