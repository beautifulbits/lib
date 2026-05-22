#!/usr/bin/env node
import { Builtins, Cli } from 'clipanion';
import { AddContributionCommand } from './commands/add-contribution.cmd.js';
import { CouplingsCommand } from './commands/couplings.cmd.js';
import { DetectDepsCommand } from './commands/detect-deps.cmd.js';
import { DocsCommand } from './commands/docs.cmd.js';
import { GenerateRegistryCommand } from './commands/generate-registry.cmd.js';
import { InstallDepsCommand } from './commands/install-deps.cmd.js';
import { InteractiveCommand } from './commands/interactive.cmd.js';
import { LibInitCommand } from './commands/lib-init.cmd.js';
import { MigrateContributionTypesCommand } from './commands/migrate-contribution-types.cmd.js';
import { ProjectInitCommand } from './commands/project-init.cmd.js';
import { SyncCommand } from './commands/sync.cmd.js';
import { UpgradeCfgCommand } from './commands/upgrade-cfg.cmd.js';
import { UsageCommand } from './commands/usage.cmd.js';
import { ValidateContributionsCommand } from './commands/validate-contributions.cmd.js';
/* ========================================================================== */
/*                                  CLI ENTRY                                 */
/* ========================================================================== */
const [, , ...args] = process.argv;
const cli = new Cli({
    binaryLabel: '@beautifulbits/lib',
    binaryName: 'lib',
    binaryVersion: '0.1.0',
});
cli.register(InteractiveCommand);
cli.register(ProjectInitCommand);
cli.register(LibInitCommand);
cli.register(SyncCommand);
cli.register(UsageCommand);
cli.register(UpgradeCfgCommand);
cli.register(DetectDepsCommand);
cli.register(InstallDepsCommand);
cli.register(CouplingsCommand);
cli.register(DocsCommand);
cli.register(AddContributionCommand);
cli.register(GenerateRegistryCommand);
cli.register(ValidateContributionsCommand);
cli.register(MigrateContributionTypesCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);
await cli.runExit(args);
//# sourceMappingURL=exec.js.map