import { Command, Option } from 'clipanion';
import consola from 'consola';

import { GetConfig } from '../get-config.js';
import { UsageRegistry } from '../usage-registry/index.js';
import type {
  TUsageLibrary,
  TUsageProject,
  TUsageRegistry,
} from '../usage-registry/types.js';

/* ========================================================================== */
/*                              USAGE COMMAND                                 */
/* ========================================================================== */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
const tty = !!process.stdout.isTTY;
const c = (color: keyof typeof C, s: string) =>
  tty ? `${C[color]}${s}${C.reset}` : s;

/**
 * `lib usage` — prints the current state of the centralized usage registry.
 *
 *   lib usage                    summary across all projects + libraries
 *   lib usage --library schematic  who consumes schematic, at what versions
 *   lib usage --project workbench-ui  what does workbench-ui have installed
 */
export class UsageCommand extends Command {
  static override paths = [['usage']];

  static override usage = Command.Usage({
    description: 'Inspect the central usage registry',
    details: `
      Reads \`<remoteLibraryPath>/_meta/usage.json\` and prints which
      projects use which libraries at which versions. Updated automatically
      by \`publish\`, \`install\`, and \`sync\`.
    `,
    examples: [
      ['Summary across all projects and libraries', '$0 usage'],
      ['Who uses one library', '$0 usage --library schematic'],
      ['What does one project have installed', '$0 usage --project workbench-ui'],
    ],
  });

  library = Option.String('--library', { description: 'Show consumers of one library' });
  project = Option.String('--project', { description: 'Show one project\'s installations' });
  json = Option.Boolean('--json', false, {
    description: 'Print the raw JSON registry contents.',
  });

  async execute(): Promise<number> {
    const sharedCfg = await new GetConfig().load();
    if (!sharedCfg) {
      consola.error(
        'No sharedlib.cfg found in current directory — usage runs from a project root.',
      );
      return 1;
    }

    const registry = new UsageRegistry(sharedCfg.remoteLibraryPath);
    const data = await registry.load();

    if (this.json) {
      console.log(JSON.stringify(data, null, 2));
      return 0;
    }

    if (this.library && this.project) {
      consola.error('Pass --library or --project, not both.');
      return 1;
    }

    if (this.library) return this.printLibraryView(data, this.library);
    if (this.project) return this.printProjectView(data, this.project);
    return this.printSummaryView(data);
  }

  /* ------------------------------------------------------------------------ */
  private printSummaryView(data: TUsageRegistry): number {
    const projectCount = Object.keys(data.projects).length;
    const libraryCount = Object.keys(data.libraries).length;

    console.log();
    console.log(
      c('bold', '@beautifulbits/lib usage') +
        c('dim', `  →  ${this.cwd()}`),
    );
    console.log(
      c('dim', `registry: ${data.updatedAt || '(never written)'}`),
    );
    console.log();

    if (projectCount === 0 && libraryCount === 0) {
      console.log(c('dim', '  (registry is empty)'));
      console.log();
      return 0;
    }

    console.log(c('bold', `Projects (${projectCount})`));
    for (const [name, project] of sortedEntries(data.projects)) {
      const libs = Object.keys(project.libraries).length;
      console.log(
        `  ${c('cyan', name)} ${c('dim', '— ' + libs + ' lib' + (libs === 1 ? '' : 's'))}`,
      );
    }
    console.log();

    console.log(c('bold', `Libraries (${libraryCount})`));
    for (const [name, lib] of sortedEntries(data.libraries)) {
      const consumers = lib.consumers.length;
      console.log(
        `  ${c('cyan', name)}@${lib.currentVersion} ${c('dim', '— ' + consumers + ' consumer' + (consumers === 1 ? '' : 's'))}`,
      );
    }
    console.log();

    return 0;
  }

  /* ------------------------------------------------------------------------ */
  private printLibraryView(data: TUsageRegistry, libName: string): number {
    const lib = data.libraries[libName] as TUsageLibrary | undefined;
    if (!lib) {
      consola.error(`Library "${libName}" is not in the registry.`);
      return 1;
    }

    console.log();
    console.log(c('bold', `@${libName}@${lib.currentVersion}`));
    console.log();

    if (lib.consumers.length === 0) {
      console.log(c('dim', '  (no consumers)'));
      console.log();
      return 0;
    }

    console.log(c('bold', 'Consumers'));
    for (const projectName of lib.consumers) {
      const project = data.projects[projectName];
      const entry = project?.libraries[libName];
      const ver = entry?.version ?? '?';
      const stale = entry && entry.version !== lib.currentVersion
        ? c('dim', '  (latest: ' + lib.currentVersion + ')')
        : '';
      console.log(`  ${c('cyan', projectName)} @ ${ver}${stale}`);
    }
    console.log();

    return 0;
  }

  /* ------------------------------------------------------------------------ */
  private printProjectView(data: TUsageRegistry, projectName: string): number {
    const project = data.projects[projectName] as TUsageProject | undefined;
    if (!project) {
      consola.error(`Project "${projectName}" is not in the registry.`);
      return 1;
    }

    console.log();
    console.log(c('bold', projectName));
    console.log(c('dim', `  path: ${project.path}`));
    console.log(c('dim', `  last seen: ${project.lastSeen}`));
    console.log();

    const libs = Object.entries(project.libraries);
    if (libs.length === 0) {
      console.log(c('dim', '  (no libraries installed)'));
      console.log();
      return 0;
    }

    console.log(c('bold', 'Libraries'));
    for (const [name, entry] of libs.sort(([a], [b]) => a.localeCompare(b))) {
      const latest = data.libraries[name]?.currentVersion;
      const stale = latest && latest !== entry.version
        ? c('dim', '  (latest: ' + latest + ')')
        : '';
      console.log(`  ${c('cyan', name)} @ ${entry.version}${stale}`);
    }
    console.log();

    return 0;
  }

  private cwd(): string {
    return process.cwd();
  }
}

function sortedEntries<T>(o: Record<string, T>): Array<[string, T]> {
  return Object.entries(o).sort(([a], [b]) => a.localeCompare(b));
}
