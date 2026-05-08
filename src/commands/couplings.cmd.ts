import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runCouplings } from '../init/couplings.js';

/* ========================================================================== */
/*                             COUPLINGS COMMAND                              */
/* ========================================================================== */

/**
 * `lib couplings [name] [--out <dir>] [--dry-run]` — generates a
 * persistent markdown report of app-coupling violations per library.
 * The report is the input artifact for a manual decoupling effort.
 *
 * Reuses the same import scanner that `detect-deps` uses internally,
 * so the report and `lib detect-deps` stay in sync.
 */
export class CouplingsCommand extends Command {
  static override paths = [['couplings']];

  static override usage = Command.Usage({
    description:
      'Write a markdown report of app couplings (non-lib, non-npm) per library',
    details: `
      For every library, walks \`.ts\`/\`.tsx\` files and writes a markdown
      report listing every import that crosses the library's boundary
      into host-app code:

        - \`@/lib/<library>/foo\`   → host alias to a library;
                                     suggests the canonical alias form
        - \`@/elements/foo\`        → host alias to non-library code;
                                     flagged "needs decoupling decision"
        - \`../../app/foo\`         → relative path that escapes the
                                     library directory; flagged the same

      One file per library is written under \`--out\` (default
      \`__gen__/lib-couplings/\`), plus a \`README.md\` index. Files are
      regenerated on every run — never edited by hand. Use \`--dry-run\`
      to compute without writing.
    `,
    examples: [
      ['Generate reports for every library', '$0 couplings'],
      ['Generate report for one library', '$0 couplings schematic'],
      ['Custom output directory', '$0 couplings --out reports/couplings'],
      ['Preview without writing', '$0 couplings --dry-run'],
    ],
  });

  name = Option.String({ required: false });

  out = Option.String('--out', '__gen__/lib-couplings', {
    description:
      'Output directory for the generated reports (default: __gen__/lib-couplings).',
  });

  dryRun = Option.Boolean('-n,--dry-run', false, {
    description: 'Compute reports but write nothing.',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run `lib project-init` first.',
      );
      return 1;
    }

    const result = await runCouplings({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name: this.name,
      outDir: this.out,
      dryRun: this.dryRun,
    });

    if (!result.ok) {
      consola.error(result.error);
      return 1;
    }

    const cwd = process.cwd();
    const totalCouplings = result.reports.reduce(
      (n, r) => n + r.totalCouplings,
      0,
    );
    const totalFixable = result.reports.reduce(
      (n, r) => n + r.fixableCouplings,
      0,
    );
    const totalWritten = result.reports.filter((r) => r.written).length;

    console.log();
    console.log(bold('@beautifulbits/lib couplings') + dim('  →  ' + cwd));
    console.log(
      dim(
        `output: ${path.relative(cwd, result.outDir) || '.'}` +
          (this.dryRun ? '  (dry-run, nothing written)' : ''),
      ),
    );
    console.log();

    for (const r of [...result.reports].sort(
      (a, b) =>
        b.totalCouplings - a.totalCouplings || a.name.localeCompare(b.name),
    )) {
      const status = this.dryRun
        ? dim('would write')
        : r.written
          ? green('wrote')
          : dim('unchanged');
      const fixable =
        r.totalCouplings > 0
          ? `  ${dim(r.fixableCouplings + ' fixable, ' + (r.totalCouplings - r.fixableCouplings) + ' need decoupling')}`
          : '';
      console.log(
        `  ${status}  ${bold('@' + r.name).padEnd(28)}` +
          `${dim(' (' + r.totalCouplings + ' coupling' + (r.totalCouplings === 1 ? '' : 's') + ')')}` +
          fixable,
      );
    }

    console.log();
    console.log(bold('summary'));
    console.log(
      `  ${result.reports.length} librar${result.reports.length === 1 ? 'y' : 'ies'} processed; ` +
        `${totalCouplings} coupling${totalCouplings === 1 ? '' : 's'} ` +
        `(${totalFixable} fixable mechanically); ` +
        `${this.dryRun ? '0' : totalWritten} report${totalWritten === 1 ? '' : 's'} written`,
    );
    if (!this.dryRun && totalWritten > 0) {
      console.log(
        dim(
          `  see ${path.relative(cwd, result.outDir).replace(/\\/g, '/') || '.'}/README.md for the index`,
        ),
      );
    }
    console.log();
    return 0;
  }
}

/* -------------------------------------------------------------------------- */

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
