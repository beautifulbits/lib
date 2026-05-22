import enquirer from 'enquirer';
import { INTERACTIVE_CLI_COMMANDS, VERSION_UPDATE_TYPES, } from '../helpers/constants.js';
import { printSpacingBetweenPrompts } from './interactive-cli.helpers.js';
// @ts-ignore
const { Select, Confirm } = enquirer;
// enquirer is loosely typed; widen to `any` so we can extend Survey below.
const BaseSurvey = enquirer.Survey;
/* Sentinel `name` values used by togglePackagesPrompt. Resolvers branch on
 * these to decide whether the user toggled a row, asked to flip everything,
 * or chose to commit / cancel. */
export const BULK_TOGGLE_SENTINELS = {
    confirm: '__BULK_CONFIRM__',
    cancel: '__BULK_CANCEL__',
    toggleAll: '__BULK_TOGGLE_ALL__',
};
/* Scale order for bumpTypesSurveyPrompt. enquirer's Survey returns numeric
 * scale indexes, so resolvers map index → name through this array. */
export const BUMP_TYPE_SCALE_VALUES = [
    VERSION_UPDATE_TYPES.patch, // 0
    VERSION_UPDATE_TYPES.minor, // 1
    VERSION_UPDATE_TYPES.major, // 2
    INTERACTIVE_CLI_COMMANDS.skip, // 3
];
/* enquirer 2.4.1 Survey hardcodes the per-row default to scaleIdx=2 (designed
 * for 5-point Likert scales). For our 4-entry scale that lands on `major` by
 * default — a dangerous default for a publish action. Subclass to honor a
 * custom `defaultScaleIdx` option set in the resolver. */
// @ts-ignore — enquirer is loosely typed
class BumpTypeSurvey extends BaseSurvey {
    async toChoices(...args) {
        // @ts-ignore
        const result = await super.toChoices(...args);
        if (result && Array.isArray(result)) {
            const defaultIdx = this.options.defaultScaleIdx ?? 0;
            for (const choice of result) {
                choice.scaleIdx = defaultIdx;
            }
        }
        return result;
    }
}
/* Compare two semver-like version strings descending (newest first).
 * Treats each dot-segment numerically; missing segments default to 0.
 * Ignores prerelease/build suffixes (good enough for this catalog). */
function compareSemverDesc(a, b) {
    const parse = (v) => v.split('.').map((part) => parseInt(part, 10) || 0);
    const aParts = parse(a);
    const bParts = parse(b);
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i += 1) {
        const ai = aParts[i] ?? 0;
        const bi = bParts[i] ?? 0;
        if (ai !== bi)
            return bi - ai;
    }
    return 0;
}
/* ========================================================================== */
/*                           CLI INTERACTIVE PROMPTS                          */
/* ========================================================================== */
export class MainCommandsCliPrompt {
    verbose;
    localLibrary;
    remoteLibrary;
    /* ------------------------------------------------------------------------ */
    init({ verbose = true, localLibrary, remoteLibrary, }) {
        this.verbose = verbose;
        this.localLibrary = localLibrary;
        this.remoteLibrary = remoteLibrary;
    }
    /* ================================ PROMPTS =============================== */
    /* ------------------------------------------------------------------------ */
    async mainCommandsPrompt() {
        printSpacingBetweenPrompts();
        return new Select({
            name: 'Main Commands',
            message: 'Commands:',
            choices: [
                INTERACTIVE_CLI_COMMANDS.initProject,
                INTERACTIVE_CLI_COMMANDS.initLibrary,
                INTERACTIVE_CLI_COMMANDS.upgradeCfg,
                INTERACTIVE_CLI_COMMANDS.detectDeps,
                INTERACTIVE_CLI_COMMANDS.installDeps,
                INTERACTIVE_CLI_COMMANDS.couplings,
                INTERACTIVE_CLI_COMMANDS.syncHost,
                INTERACTIVE_CLI_COMMANDS.addContribution,
                INTERACTIVE_CLI_COMMANDS.generateRegistry,
                INTERACTIVE_CLI_COMMANDS.validateContributions,
                INTERACTIVE_CLI_COMMANDS.migrateContributionTypes,
                INTERACTIVE_CLI_COMMANDS.showUsage,
                INTERACTIVE_CLI_COMMANDS.openDocs,
                INTERACTIVE_CLI_COMMANDS.listInstalledPackages,
                INTERACTIVE_CLI_COMMANDS.listRemotePackages,
                INTERACTIVE_CLI_COMMANDS.publishPackage,
                INTERACTIVE_CLI_COMMANDS.publishMultiplePackages,
                INTERACTIVE_CLI_COMMANDS.installPackage,
                INTERACTIVE_CLI_COMMANDS.installMultiplePackages,
                INTERACTIVE_CLI_COMMANDS.getRemotePackageLatestVersion,
                INTERACTIVE_CLI_COMMANDS.compareInstalledPackageWithRemote,
                INTERACTIVE_CLI_COMMANDS.exit,
            ],
        });
    }
    /* ============================= LOCAL LIBRARY ============================ */
    /* ------------------------------------------------------------------------ */
    async selectLocalLibraryPrompt() {
        if (!this.localLibrary)
            return;
        const libraries = await this.localLibrary.getInstalledLibraries();
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-library',
            message: 'Select library:',
            choices: [
                INTERACTIVE_CLI_COMMANDS.showAll,
                ...libraries,
                INTERACTIVE_CLI_COMMANDS.exit,
            ],
        });
    }
    /* ------------------------------------------------------------------------ */
    async selectLocalCollectionPrompt(selectedLibrary) {
        if (!this.localLibrary)
            return;
        const collections = await this.localLibrary.getInstalledCollections(selectedLibrary);
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-collection',
            message: 'Select collection:',
            choices: [
                INTERACTIVE_CLI_COMMANDS.showAll,
                ...collections,
                INTERACTIVE_CLI_COMMANDS.exit,
            ],
        });
    }
    /* ------------------------------------------------------------------------ */
    async selectLocalPackagePrompt(selectedLibrary, selectedCollection) {
        if (!this.localLibrary)
            return;
        const packages = await this.localLibrary.getInstalledPackages(selectedLibrary, selectedCollection);
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-package',
            message: 'Select package:',
            choices: [...packages, INTERACTIVE_CLI_COMMANDS.exit],
        });
    }
    /* ============================ REMOTE LIBRARY ============================ */
    /* ------------------------------------------------------------------------ */
    async selectRemoteLibraryPrompt() {
        if (!this.remoteLibrary)
            return;
        const libraries = await this.remoteLibrary.getRemoteLibraries();
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-library',
            message: 'Select library:',
            choices: [
                INTERACTIVE_CLI_COMMANDS.showAll,
                ...libraries,
                INTERACTIVE_CLI_COMMANDS.exit,
            ],
        });
    }
    /* ------------------------------------------------------------------------ */
    async selectRemoteCollectionPrompt(selectedLibrary) {
        if (!this.remoteLibrary)
            return;
        const collections = await this.remoteLibrary.getRemoteCollections(selectedLibrary);
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-collection',
            message: 'Select collection:',
            choices: [
                INTERACTIVE_CLI_COMMANDS.showAll,
                ...collections,
                INTERACTIVE_CLI_COMMANDS.exit,
            ],
        });
    }
    /* ------------------------------------------------------------------------ */
    async selectRemotePackagePrompt(selectedLibrary, selectedCollection) {
        if (!this.remoteLibrary)
            return;
        const packages = await this.remoteLibrary.getRemotePackages(selectedLibrary, selectedCollection);
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-package',
            message: 'Select package:',
            choices: [...packages, INTERACTIVE_CLI_COMMANDS.exit],
        });
    }
    /* ------------------------------------------------------------------------ */
    async selectRemotePackageVersionPrompt(selectedPackage) {
        if (!this.remoteLibrary)
            return;
        const versions = await this.remoteLibrary.getRemotePackageAllVersions(selectedPackage);
        const sortedVersions = [...versions].sort(compareSemverDesc);
        printSpacingBetweenPrompts();
        return new Select({
            name: 'select-version',
            message: 'Select versions:',
            choices: [...sortedVersions, INTERACTIVE_CLI_COMMANDS.exit],
        });
    }
    /* ============================== VERSIONING ============================== */
    /* ------------------------------------------------------------------------ */
    selectUpdateTypePrompt() {
        let versionUpdateValues = Object.values(VERSION_UPDATE_TYPES);
        const choices = [
            ...versionUpdateValues,
            INTERACTIVE_CLI_COMMANDS.exit,
        ];
        return new Select({
            name: 'select-update-type',
            message: 'Select update type:',
            choices,
        });
    }
    /* ============================ BULK SELECTION ============================ */
    /* ------------------------------------------------------------------------ */
    /** Checkbox-style toggle list built on a regular Select so Enter (the only
     *  key the user has to remember) toggles a row, and explicit Confirm /
     *  Cancel rows at the bottom commit or abort. The caller drives this in a
     *  loop, mutating `selected` in response to each return value. */
    togglePackagesPrompt({ message, header, rows, selected, confirmLabel, initialIndex, }) {
        printSpacingBetweenPrompts();
        const checkmark = (key) => (selected.has(key) ? '[x]' : '[ ]');
        const choices = [
            ...rows.map((row) => ({
                name: row.key,
                message: `${checkmark(row.key)}  ${row.message}`,
            })),
            { role: 'separator' },
            {
                name: BULK_TOGGLE_SENTINELS.toggleAll,
                message: `Toggle all (${selected.size}/${rows.length} selected)`,
            },
            {
                name: BULK_TOGGLE_SENTINELS.confirm,
                message: selected.size === 0
                    ? `${confirmLabel} (nothing selected — disabled)`
                    : `${confirmLabel} (${selected.size} package(s))`,
                disabled: selected.size === 0 ? '— select at least one package' : false,
            },
            {
                name: BULK_TOGGLE_SENTINELS.cancel,
                message: 'Cancel and return to main menu',
            },
        ];
        return new Select({
            name: 'toggle-packages',
            message: `${message}\n\n     ${header}`,
            hint: '(↑/↓ to move · enter to toggle / commit · type ahead to filter)',
            choices,
            initial: initialIndex,
        });
    }
    /* ------------------------------------------------------------------------ */
    /** Final yes/no guard before a bulk install / publish actually runs. */
    confirmBulkActionPrompt(message) {
        return new Confirm({
            name: 'confirm-bulk-action',
            message,
            initial: false,
        });
    }
    /* ------------------------------------------------------------------------ */
    /** Single-screen Survey for picking a bump type (patch / minor / major /
     *  skip) for each selected package. Returns an object keyed by question
     *  `name` (the package key), valued by the chosen scale `name`. */
    bumpTypesSurveyPrompt(packages) {
        printSpacingBetweenPrompts();
        return new BumpTypeSurvey({
            name: 'bulk-bump-types',
            message: 'Choose a bump type for each selected package:',
            hint: '(↑/↓ packages · ←/→ bump type · enter to confirm)',
            scale: [
                { name: VERSION_UPDATE_TYPES.patch, message: 'patch' },
                { name: VERSION_UPDATE_TYPES.minor, message: 'minor' },
                { name: VERSION_UPDATE_TYPES.major, message: 'major' },
                { name: INTERACTIVE_CLI_COMMANDS.skip, message: 'skip ' },
            ],
            defaultScaleIdx: 0, // patch — safest active bump
            margin: [0, 0, 1, 0],
            // enquirer 2.4.1's Survey reads `choices`, not `questions`, despite the
            // README example. Each entry is a row in the matrix.
            choices: packages.map((pkg) => ({
                name: pkg.key,
                message: pkg.label,
            })),
        });
    }
}
//# sourceMappingURL=main-commands.cli-prompt.js.map