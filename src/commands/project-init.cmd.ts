import path from 'node:path';
import { Command, Option } from 'clipanion';
import consola from 'consola';

import { runProjectInit } from '../init/project-init.js';

/* ========================================================================== */
/*                          PROJECT-INIT COMMAND                              */
/* ========================================================================== */

/**
 * `lib project-init` — set up the current project to use @beautifulbits/lib.
 * Thin wrapper around `runProjectInit`. The interactive CLI resolver calls
 * the same function with prompted values.
 */
export class ProjectInitCommand extends Command {
  static override paths = [['project-init']];

  static override usage = Command.Usage({
    description: 'Set up the current project to use @beautifulbits/lib',
    details: `
      Writes \`sharedlib.cfg\` at the project root and creates \`src/lib/\`
      if it doesn't exist. Run this once per project before using
      \`lib install\`, \`lib publish\`, or \`lib sync\`.
    `,
    examples: [
      [
        'Bootstrap a project',
        '$0 project-init --remote /Users/you/Code/shared-lib',
      ],
      [
        'Override the default local library path',
        '$0 project-init --remote /path/to/remote --local /lib',
      ],
      [
        'Overwrite an existing sharedlib.cfg',
        '$0 project-init --remote /path/to/remote --force',
      ],
    ],
  });

  remote = Option.String('--remote', {
    description: 'Absolute path of the centralized remote library on disk',
    required: true,
  });

  local = Option.String('--local', '/src/lib', {
    description: 'Project-relative path where libraries are synced into',
  });

  force = Option.Boolean('--force', false, {
    description: 'Overwrite an existing sharedlib.cfg.',
  });

  async execute(): Promise<number> {
    const result = await runProjectInit({
      hostRoot: process.cwd(),
      remoteLibraryPath: this.remote,
      localLibraryPath: this.local,
      force: this.force,
    });

    if (!result.ok) {
      consola.error(result.error);
      return 1;
    }

    console.log();
    console.log(
      green('✓') +
        ` ${result.sharedCfgExisted ? 'updated' : 'created'} sharedlib.cfg`,
    );
    console.log(`    remoteLibraryPath: ${this.remote}`);
    console.log(`    localLibraryPath:  ${this.local}`);
    console.log(
      green('✓') +
        ` ${result.localLibExisted ? 'verified' : 'created'} ${result.localLibAbsPath}`,
    );
    console.log();
    console.log(dim('Next:'));
    console.log(`  ${dim('•')} \`yarn lib lib-init <name>\` — scaffold a new library`);
    console.log(`  ${dim('•')} \`yarn lib install <name>\`  — install an existing one`);
    console.log(`  ${dim('•')} \`yarn lib sync\`             — wire libraries into the host`);
    console.log();
    return 0;
  }
}

const tty = !!process.stdout.isTTY;
const green = (s: string): string => (tty ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string): string => (tty ? `\x1b[2m${s}\x1b[0m` : s);
