import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runInstallDeps } from '../init/install-deps.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input, Select } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — INSTALL-DEPS                           */
/* ========================================================================== */

export class InstallDepsCliResolver {
  mainCommandsCliResolver?: MainCommandsCliResolver;

  init({
    mainCommandsCliResolver,
  }: {
    mainCommandsCliResolver: MainCommandsCliResolver;
  }) {
    this.mainCommandsCliResolver = mainCommandsCliResolver;
  }

  async resolve(): Promise<void> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run "Init project" first.',
      );
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    let name: string | undefined;
    let manager: 'yarn' | 'npm' | 'pnpm' | undefined;
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Process just one library? (No = all libraries)',
        initial: false,
      }).run();

      if (single) {
        const entered = await new Input({
          name: 'name',
          message: 'Library name:',
        }).run();
        name = entered || undefined;
      }

      const useDefault = await new Confirm({
        name: 'auto-detect',
        message: 'Auto-detect package manager from lockfile?',
        initial: true,
      }).run();
      if (!useDefault) {
        const picked = await new Select({
          name: 'manager',
          message: 'Pick package manager:',
          choices: ['yarn', 'npm', 'pnpm'],
        }).run();
        manager = picked as 'yarn' | 'npm' | 'pnpm';
      }
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    /* always start with a report-only run */
    const dryResult = await runInstallDeps({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name,
      apply: false,
      manager,
    });

    console.log();
    if (!dryResult.ok) {
      consola.error(dryResult.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    const cwd = process.cwd();
    console.log(`package manager: ${dryResult.manager}`);
    console.log();

    const errored = dryResult.reports.filter((r) => r.error);
    for (const r of errored) console.log(`  ✗ ${r.name}: ${r.error}`);
    if (errored.length > 0) console.log();

    const changed = dryResult.reports.filter((r) => r.changed);
    const total = dryResult.reports.length;

    for (const r of dryResult.reports) {
      if (r.error) continue;
      console.log(`@${r.name} — ${path.relative(cwd, r.cfgPath)}`);
      if (!r.changed) {
        console.log('  — up to date');
        console.log();
        continue;
      }
      if (r.missingNpmDeps.length > 0) {
        console.log('  missing in host package.json:');
        for (const d of r.missingNpmDeps) {
          const tag = d.kind === 'dev' ? '  (devDependency)' : '';
          console.log(`    + ${d.pkg}@${d.version}${tag}`);
        }
      }
      if (r.missingLibrarySiblings.length > 0) {
        console.log('  missing library siblings:');
        for (const s of r.missingLibrarySiblings) {
          console.log(`    ⚠ ${s.name} (suggested: ${s.suggestion})`);
        }
      }
      console.log();
    }

    consola.success(
      `${total} librar${total === 1 ? 'y' : 'ies'} processed — ` +
        `${changed.length} with drift`,
    );

    /* offer to apply, but only if there's anything to install */
    const anyInstallable = dryResult.reports.some(
      (r) => r.missingNpmDeps.length > 0,
    );
    if (anyInstallable) {
      try {
        const applyNow = await new Confirm({
          name: 'apply',
          message: `Run \`${dryResult.manager} add\` to install missing packages?`,
          initial: false,
        }).run();
        if (applyNow) {
          const applied = await runInstallDeps({
            hostRoot: process.cwd(),
            localLibraryPath: sharedCfg.localLibraryPath,
            name,
            apply: true,
            manager,
          });
          console.log();
          let failures = 0;
          for (const r of applied.reports) {
            if (r.installLog) {
              console.log(`@${r.name} install log:`);
              for (const ln of r.installLog.split('\n')) {
                if (ln.length > 0) console.log(`  ${ln}`);
              }
              if (r.installExitCode !== 0) failures++;
              console.log();
            }
          }
          if (failures > 0) {
            consola.warn(`${failures} install run(s) failed.`);
          } else {
            consola.success('All missing packages installed.');
          }
        }
      } catch (err) {
        promptErrorHandler(err);
        return;
      }
    }

    console.log();
    await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
  }
}
