import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import {
  runInstallDeps,
  type TPackageManager,
} from '../init/install-deps.js';

/* ========================================================================== */
/*                            INSTALL-DEPS COMMAND                            */
/* ========================================================================== */

/**
 * `lib install-deps [name] [--apply] [--manager yarn|npm|pnpm]`
 *
 * Compares each library's `lib.cfg` against the host's `package.json`
 * and reports missing entries. With `--apply`, runs the host's package
 * manager to install them. Library-sibling deps that aren't present
 * locally are reported but never auto-installed (cross-library install
 * needs a real architectural decision; the report names the suggested
 * `lib install <name>` command instead).
 */
export class InstallDepsCommand extends Command {
  static override paths = [['install-deps']];

  static override usage = Command.Usage({
    description: 'Sync host package.json + node_modules against lib.cfg deps',
    details: `
      Walks every \`lib.cfg\` under the configured \`localLibraryPath\`
      (or one named library, if given) and lists:

        - npm packages declared in lib.cfg.dependencies / devDependencies
          that aren't present in the host's package.json
        - libraryDependencies that don't exist as a sibling library under
          \`localLibraryPath\` (these are NEVER auto-installed; the
          report suggests the \`lib install\` command instead)

      Without flags this is report-only. Pass \`--apply\` to run the
      host's package manager (auto-detected from the lockfile, or
      override with \`--manager\`).

      Strictly additive: never overwrites a host version, never
      downgrades, never removes entries.
    `,
    examples: [
      ['Show what would be installed', '$0 install-deps'],
      ['Show for one library', '$0 install-deps schematic'],
      ['Actually install missing deps', '$0 install-deps --apply'],
      [
        'Force a specific package manager',
        '$0 install-deps --apply --manager pnpm',
      ],
    ],
  });

  name = Option.String({ required: false });

  apply = Option.Boolean('--apply', false, {
    description:
      'Run the host package manager to install the missing entries.',
  });

  manager = Option.String('--manager', {
    description: 'Force yarn / npm / pnpm (default: auto-detect from lockfile).',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run `lib project-init` first.',
      );
      return 1;
    }

    const manager = validateManager(this.manager);
    if (this.manager && !manager) {
      consola.error(
        `Unknown --manager value "${this.manager}". Use yarn, npm, or pnpm.`,
      );
      return 1;
    }

    const result = await runInstallDeps({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name: this.name,
      apply: this.apply,
      manager,
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

    console.log();
    console.log(
      bold('@beautifulbits/lib install-deps') + dim('  →  ' + cwd),
    );
    console.log(
      dim(`package manager: ${result.manager}`) +
        (this.apply ? '' : dim('   (report-only — pass --apply to install)')),
    );
    console.log();

    if (errored.length > 0) {
      for (const r of errored) {
        console.log(`  ${red('✗')} ${r.name}: ${r.error}`);
      }
      console.log();
    }

    let installFailures = 0;

    for (const r of result.reports) {
      if (r.error) continue;

      const header =
        bold('@' + r.name) + '  ' + dim(path.relative(cwd, r.cfgPath));
      console.log(header);

      if (!r.changed) {
        console.log(`  ${dim('— up to date')}`);
        console.log();
        continue;
      }

      if (r.missingNpmDeps.length > 0) {
        console.log(`  ${bold('missing in host package.json:')}`);
        for (const d of r.missingNpmDeps) {
          const tag =
            d.kind === 'dev' ? dim('  (devDependency)') : '';
          console.log(`    ${green('+')} ${d.pkg}@${d.version}${tag}`);
        }
      }

      if (r.missingLibrarySiblings.length > 0) {
        console.log(`  ${bold('missing library siblings:')}`);
        for (const s of r.missingLibrarySiblings) {
          console.log(
            `    ${yellow('⚠')} ${s.name}  ${dim('(suggested: ' + s.suggestion + ')')}`,
          );
        }
      }

      if (this.apply && r.installLog) {
        console.log();
        console.log(`  ${dim('install log:')}`);
        for (const line of r.installLog.split('\n')) {
          if (line.length > 0) console.log(`    ${dim(line)}`);
        }
        if (r.installExitCode !== 0) {
          installFailures++;
          console.log(
            `  ${red('✗')} install exited with code ${r.installExitCode}`,
          );
        }
      }

      console.log();
    }

    /* ---------- summary ---------- */
    const total = result.reports.length;
    const verb = this.apply ? 'installed' : 'would install';
    const totalMissingPkgs = result.reports.reduce(
      (n, r) => n + r.missingNpmDeps.length,
      0,
    );
    const totalMissingSiblings = result.reports.reduce(
      (n, r) => n + r.missingLibrarySiblings.length,
      0,
    );

    console.log(bold('summary'));
    console.log(
      `  ${total} librar${total === 1 ? 'y' : 'ies'} processed; ` +
        `${changed.length} ${this.apply ? 'updated' : 'with drift'}; ` +
        `${noChanges.length} already up to date`,
    );
    if (totalMissingPkgs > 0) {
      console.log(
        `  ${green('+')} ${totalMissingPkgs} npm package${totalMissingPkgs === 1 ? '' : 's'} ${verb}`,
      );
    }
    if (totalMissingSiblings > 0) {
      console.log(
        `  ${yellow('⚠')} ${totalMissingSiblings} library sibling${totalMissingSiblings === 1 ? '' : 's'} not present locally`,
      );
    }
    if (installFailures > 0) {
      console.log(`  ${red('✗')} ${installFailures} install run(s) failed`);
    }
    console.log();
    return installFailures > 0 || errored.length > 0 ? 1 : 0;
  }
}

/* -------------------------------------------------------------------------- */

function validateManager(input?: string): TPackageManager | undefined {
  if (!input) return undefined;
  if (input === 'yarn' || input === 'npm' || input === 'pnpm') return input;
  return undefined;
}

const tty = !!process.stdout.isTTY;
const bold = (s: string): string => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (tty ? `\x1b[33m${s}\x1b[0m` : s);
