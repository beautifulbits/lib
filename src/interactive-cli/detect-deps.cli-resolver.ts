import enquirer from 'enquirer';
import path from 'node:path';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runDetectDeps } from '../init/detect-deps.js';
import { promptErrorHandler } from './interactive-cli.helpers.js';
import type { MainCommandsCliResolver } from './main-commands.cli-resolver.js';

// @ts-ignore
const { Confirm, Input } = enquirer;

/* ========================================================================== */
/*                       INTERACTIVE — DETECT-DEPS                            */
/* ========================================================================== */

export class DetectDepsCliResolver {
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
    let dryRun = true;
    try {
      const single = await new Confirm({
        name: 'single',
        message: 'Detect for just one library? (No = all libraries)',
        initial: false,
      }).run();

      if (single) {
        const entered = await new Input({
          name: 'name',
          message: 'Library name:',
        }).run();
        name = entered || undefined;
      }

      dryRun = await new Confirm({
        name: 'dry-run',
        message: 'Dry-run first? (preview without writing)',
        initial: true,
      }).run();
    } catch (err) {
      promptErrorHandler(err);
      return;
    }

    const result = await runDetectDeps({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name,
      dryRun,
    });

    console.log();
    if (!result.ok) {
      consola.error(result.error);
      await this.mainCommandsCliResolver?.resolveMainCommandsPrompt();
      return;
    }

    const cwd = process.cwd();
    const errored = result.reports.filter((r) => r.error);
    const changed = result.reports.filter((r) => r.changed);
    const total = result.reports.length;
    const couplingTotal = result.reports.reduce(
      (n, r) => n + r.appCouplings.length,
      0,
    );

    if (dryRun) {
      console.log('mode: dry-run — no files were written');
      console.log();
    }

    for (const r of errored) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    if (errored.length > 0) console.log();

    for (const r of result.reports) {
      if (r.error) continue;

      const header =
        `@${r.name} — ${path.relative(cwd, r.cfgPath)} ` +
        `(${r.filesScanned} file${r.filesScanned === 1 ? '' : 's'} scanned)`;
      console.log(header);

      if (!r.changed && r.appCouplings.length === 0) {
        console.log('  — up to date');
        console.log();
        continue;
      }

      if (r.addedDependencies.length > 0) {
        console.log('  dependencies:');
        for (const d of r.addedDependencies) {
          const tag = d.versionMissing ? ' (no version found in host)' : '';
          console.log(`    + ${d.pkg}@${d.version}${tag}`);
        }
      }
      if (r.addedDevDependencies.length > 0) {
        console.log('  devDependencies:');
        for (const d of r.addedDevDependencies) {
          const tag = d.versionMissing ? ' (no version found in host)' : '';
          console.log(`    + ${d.pkg}@${d.version}${tag}`);
        }
      }
      if (r.addedLibraryDependencies.length > 0) {
        console.log('  libraryDependencies:');
        for (const lib of r.addedLibraryDependencies) {
          console.log(`    + ${lib}`);
        }
      }
      if (r.appCouplings.length > 0) {
        console.log('  app-coupling warnings:');
        for (const c of r.appCouplings) {
          const reasonLabel =
            c.reason === 'host-alias'
              ? 'host alias'
              : 'relative path escapes library';
          console.log(`    ⚠ ${c.specifier} (${reasonLabel})`);
          console.log(`      in ${c.file}:${c.line}`);
          if (c.suggestedFix) {
            console.log(`      → ${c.suggestedFix}`);
          }
        }
      }
      console.log();
    }

    consola.success(
      `${total} librar${total === 1 ? 'y' : 'ies'} processed — ` +
        `${changed.length} ${dryRun ? 'would be updated' : 'updated'}` +
        (couplingTotal > 0
          ? `, ${couplingTotal} app-coupling warning${couplingTotal === 1 ? '' : 's'}`
          : ''),
    );

    /* if dry-run produced changes, offer to apply */
    if (dryRun && changed.length > 0) {
      try {
        const applyNow = await new Confirm({
          name: 'apply',
          message: 'Apply these changes now?',
          initial: false,
        }).run();
        if (applyNow) {
          const applied = await runDetectDeps({
            hostRoot: process.cwd(),
            localLibraryPath: sharedCfg.localLibraryPath,
            name,
            dryRun: false,
          });
          console.log();
          consola.success(
            `Applied to ${applied.reports.filter((r) => r.changed).length} librar${changed.length === 1 ? 'y' : 'ies'}.`,
          );
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
