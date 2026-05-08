import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runDetectDeps } from '../init/detect-deps.js';

/* ========================================================================== */
/*                            DETECT-DEPS COMMAND                             */
/* ========================================================================== */

/**
 * `lib detect-deps [name] [--dry-run] [--apply]` — scans `.ts`/`.tsx`
 * files in each library, classifies imports, and writes detected
 * dependencies into the library's `lib.cfg`.
 *
 * Strictly additive — never overwrites a manual entry, never deletes
 * anything. Re-runs are no-ops once everything imported is already
 * declared.
 *
 * Imports are classified as:
 *   - relative / Node builtin              → ignored
 *   - matches a known library alias        → libraryDependencies
 *   - matches a host-level alias (`@/...`) → app-coupling warning
 *   - everything else                      → npm package
 *
 * Npm packages used only in `*.spec`/`*.test`/`*.stories` files become
 * devDependencies; everything else becomes dependencies. Versions are
 * looked up in the host's `package.json`.
 */
export class DetectDepsCommand extends Command {
  static override paths = [['detect-deps']];

  static override usage = Command.Usage({
    description: 'Auto-detect a library\'s deps from its imports',
    details: `
      Walks every library directory under \`localLibraryPath\` (or one
      named library, if given) and scans every \`.ts\`/\`.tsx\` file for
      imports. The resulting set is classified and merged additively
      into each library's \`lib.cfg\`:

        dependencies         — npm packages used in production code
        devDependencies      — npm packages only used in
                               *.spec / *.test / *.stories files
        libraryDependencies  — other libraries imported via path alias

      Strictly additive: existing entries are NEVER overwritten or
      removed. Re-running is a no-op once nothing new is detected.

      Imports that look like app couplings (\`@/...\`, relative paths
      that escape the library directory, or any tsconfig alias that
      isn't a registered library) surface as warnings and are NEVER
      added to any field — these are decoupling violations the user
      should resolve by hand.

      Use \`--dry-run\` to preview without writing.
    `,
    examples: [
      ['Detect deps for every library', '$0 detect-deps'],
      ['Detect deps for one library', '$0 detect-deps schematic'],
      ['Preview without writing', '$0 detect-deps --dry-run'],
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

    const result = await runDetectDeps({
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
    const errored = result.reports.filter((r) => r.error);
    const changed = result.reports.filter((r) => r.changed);
    const noChanges = result.reports.filter((r) => !r.changed && !r.error);
    const couplingTotal = result.reports.reduce(
      (n, r) => n + r.appCouplings.length,
      0,
    );

    console.log();
    console.log(bold('@beautifulbits/lib detect-deps') + dim('  →  ' + cwd));
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

    for (const r of result.reports) {
      if (r.error) continue;
      const header =
        bold('@' + r.name) +
        '  ' +
        dim(
          path.relative(cwd, r.cfgPath) +
            '  (' +
            r.filesScanned +
            ' file' +
            (r.filesScanned === 1 ? '' : 's') +
            ' scanned)',
        );
      console.log(header);

      if (!r.changed && r.appCouplings.length === 0) {
        console.log(`  ${dim('— up to date')}`);
        console.log();
        continue;
      }

      if (r.addedDependencies.length > 0) {
        console.log(`  ${bold('dependencies:')}`);
        for (const d of r.addedDependencies) {
          const tag = d.versionMissing
            ? yellow(' (no version found in host)')
            : '';
          console.log(
            `    ${green('+')} ${d.pkg}@${d.version}${tag}` +
              dim('  ' + truncList(d.examples)),
          );
        }
      }

      if (r.addedDevDependencies.length > 0) {
        console.log(`  ${bold('devDependencies:')}`);
        for (const d of r.addedDevDependencies) {
          const tag = d.versionMissing
            ? yellow(' (no version found in host)')
            : '';
          console.log(
            `    ${green('+')} ${d.pkg}@${d.version}${tag}` +
              dim('  ' + truncList(d.examples)),
          );
        }
      }

      if (r.addedLibraryDependencies.length > 0) {
        console.log(`  ${bold('libraryDependencies:')}`);
        for (const lib of r.addedLibraryDependencies) {
          console.log(`    ${green('+')} ${lib}`);
        }
      }

      if (r.appCouplings.length > 0) {
        console.log(`  ${bold(yellow('app-coupling warnings:'))}`);
        for (const c of r.appCouplings) {
          const reasonLabel =
            c.reason === 'host-alias'
              ? 'host alias'
              : 'relative path escapes library';
          console.log(
            `    ${yellow('⚠')} ${c.specifier}  ${dim('(' + reasonLabel + ')')}`,
          );
          console.log(`      ${dim('in ' + c.file + ':' + c.line)}`);
          if (c.suggestedFix) {
            console.log(`      ${dim('→ ' + c.suggestedFix)}`);
          }
        }
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
        (errored.length > 0 ? `; ${errored.length} errored` : '') +
        (couplingTotal > 0
          ? `; ${yellow(couplingTotal + ' app-coupling warning' + (couplingTotal === 1 ? '' : 's'))}`
          : ''),
    );
    console.log();
    return errored.length > 0 ? 1 : 0;
  }
}

/* -------------------------------------------------------------------------- */

function truncList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length <= 2) return '(' + items.join(', ') + ')';
  return '(' + items.slice(0, 2).join(', ') + ', …)';
}

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
