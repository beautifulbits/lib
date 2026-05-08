import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { runLibInit } from '../init/lib-init.js';

/* ========================================================================== */
/*                            LIB-INIT COMMAND                                */
/* ========================================================================== */

/**
 * `lib lib-init <name>` — scaffold a new library at
 * `<localLibraryPath>/<name>/`. Thin wrapper around `runLibInit`.
 *
 * Always additive — never deletes existing directories or files. Refuses
 * to run if `lib.cfg` already exists at the target.
 */
export class LibInitCommand extends Command {
  static override paths = [['lib-init']];

  static override usage = Command.Usage({
    description: 'Scaffold a new shared library in this project',
    details: `
      Creates \`<localLibraryPath>/<name>/\` (if absent) with a starter
      \`lib.cfg\`, plus \`index.ts\` and \`CLAUDE.md\` only if those files
      don't already exist. Existing files are never overwritten.

      If the target directory already has a \`lib.cfg\`, the command
      refuses — edit the file by hand or delete it to re-init.

      Workflow ports (test/storybook/docs) are NOT scaffolded — add them
      by hand when you know what tooling the library needs.

      After scaffolding, run \`lib sync\` to apply the alias to host
      configs.
    `,
    examples: [
      ['Scaffold a new library with the default alias', '$0 lib-init mylib'],
      [
        'Customize library and collection grouping',
        '$0 lib-init mylib --library frameworks --collection react',
      ],
      [
        'Customize description and alias',
        '$0 lib-init mylib --alias @mylib --description "Schema utilities"',
      ],
      ['Also scaffold a CLAUDE.md placeholder', '$0 lib-init mylib --with-claude-md'],
    ],
  });

  name = Option.String({ required: true });

  description = Option.String('--description', {
    description: 'Human-readable one-liner describing the library.',
  });

  alias = Option.String('--alias', {
    description: 'Path-alias prefix. Defaults to `@<name>`.',
  });

  library = Option.String('--library', 'frameworks', {
    description: 'Top-level grouping in the remote library.',
  });

  collection = Option.String('--collection', 'general', {
    description: 'Sub-grouping (e.g., "react", "node", "cli").',
  });

  withClaudeMd = Option.Boolean('--with-claude-md', false, {
    description: 'Also create a CLAUDE.md placeholder (only if absent).',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — run `lib project-init` first.',
      );
      return 1;
    }

    const result = await runLibInit({
      hostRoot: process.cwd(),
      localLibraryPath: sharedCfg.localLibraryPath,
      name: this.name,
      description: this.description,
      alias: this.alias,
      library: this.library,
      collection: this.collection,
      withClaudeMd: this.withClaudeMd,
    });

    if (!result.ok) {
      consola.error(result.error);
      return 1;
    }

    const cwd = process.cwd();

    console.log();
    console.log(
      green('✓') +
        ` ${result.dirExisted ? 'wired up existing' : 'created'} ${result.libDir}`,
    );
    console.log(`    alias:    ${result.alias}`);
    console.log(`    libRoot:  ${result.libRoot}`);
    console.log(`    library:  ${this.library}/${this.collection}`);
    console.log(`    version:  0.1.0`);
    console.log();

    if ((result.filesWritten ?? []).length > 0) {
      console.log(dim('Files written:'));
      for (const f of result.filesWritten ?? []) {
        console.log(`  ${green('+')} ${path.relative(cwd, f)}`);
      }
    }
    if ((result.filesSkipped ?? []).length > 0) {
      console.log(dim('Files left alone (already existed):'));
      for (const f of result.filesSkipped ?? []) {
        console.log(`  ${dim('·')} ${path.relative(cwd, f)}`);
      }
    }

    console.log();
    console.log(dim('Next:'));
    console.log(`  ${dim('•')} edit lib.cfg to add deps / workflows / typescript options`);
    console.log(`  ${dim('•')} \`yarn lib sync\`         — wire the alias into host configs`);
    console.log(`  ${dim('•')} \`yarn lib\` → Publish    — snapshot version 0.1.0 to the remote library`);
    console.log();
    return 0;
  }
}

const tty = !!process.stdout.isTTY;
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
