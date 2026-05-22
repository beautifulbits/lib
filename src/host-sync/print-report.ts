import type { TChangeKind } from './types.js';
import type { TSyncReport } from './orchestrator.js';

/* ========================================================================== */
/*                            REPORT PRINTER                                  */
/* ========================================================================== */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const tty = !!process.stdout.isTTY;
const c = (color: keyof typeof C, s: string): string =>
  tty ? `${C[color]}${s}${C.reset}` : s;

/* -------------------------------------------------------------------------- */
/* Symbols per change kind                                                    */
/* -------------------------------------------------------------------------- */

const KIND_SYMBOL: Record<TChangeKind, { glyph: string; color: keyof typeof C }> = {
  add: { glyph: '+', color: 'green' },
  update: { glyph: '↻', color: 'cyan' },
  skip: { glyph: '·', color: 'gray' },
  warn: { glyph: '!', color: 'yellow' },
};

/* -------------------------------------------------------------------------- */
/* Public printer                                                             */
/* -------------------------------------------------------------------------- */

export function printSyncReport(report: TSyncReport): void {
  printHeader(report);

  for (const lib of report.libraries) {
    printLibrary(lib);
  }

  if (report.defaults.results.length > 0) {
    printDefaults(report.defaults);
  }

  printSummary(report);
}

/* -------------------------------------------------------------------------- */

function printHeader(report: TSyncReport): void {
  const files: string[] = [];
  if (report.host.next) files.push(report.host.next.name);
  if (report.host.jest) files.push(report.host.jest.name);
  if (report.host.storybook) files.push(report.host.storybook.name);
  if (report.host.claudeMd) files.push('CLAUDE.md');

  console.log();
  console.log(
    c('bold', '@beautifulbits/lib sync') + c('dim', '  →  ') + report.hostRoot,
  );
  console.log(
    c('dim', `host: ${report.host.kind}${files.length ? ' (' + files.join(', ') + ')' : ''}`),
  );
  if (report.dryRun) console.log(c('yellow', 'mode: dry-run — no files will be written'));
  console.log();
}

function printDefaults(defaults: TSyncReport['defaults']): void {
  console.log(c('bold', 'tool defaults') + c('dim', '  (applied once per sync)'));
  printResults(defaults.results);
}

function printLibrary(lib: TSyncReport['libraries'][number]): void {
  // Skip libraries that produced zero output across all patchers — likely
  // a library that hasn't yet adopted the new manifest fields.
  const hasOutput = lib.results.some(
    (r) => r.changes.length > 0 || (r.reason && r.changes.length === 0),
  );
  if (!hasOutput) return;

  console.log(c('bold', `@${lib.name}`));
  printResults(lib.results);
}

function printResults(
  results: Array<{ patcher: string; reason?: string; changes: { kind: string; message: string }[] }>,
): void {
  // Width of "patcher" column for alignment
  const visible = results.filter(
    (r) => r.changes.length > 0 || (r.reason && r.changes.length === 0),
  );
  if (visible.length === 0) {
    console.log(c('dim', '  (nothing to do)'));
    console.log();
    return;
  }

  const labelWidth = Math.max(...visible.map((r) => r.patcher.length));

  for (const r of visible) {
    const patcherLabel = r.patcher.padEnd(labelWidth);

    if (r.reason && r.changes.length === 0) {
      console.log(`  ${c('dim', patcherLabel)}  ${c('dim', '· ' + r.reason)}`);
      continue;
    }

    let firstLine = true;
    for (const change of r.changes) {
      const sym = KIND_SYMBOL[change.kind as TChangeKind];
      const lead = firstLine ? c('dim', patcherLabel) : ' '.repeat(labelWidth);
      console.log(
        `  ${lead}  ${c(sym.color, sym.glyph)} ${
          change.kind === 'skip' ? c('dim', change.message) : change.message
        }`,
      );
      firstLine = false;
    }
  }
  console.log();
}

function printSummary(report: TSyncReport): void {
  const { changes, warnings, librariesProcessed } = report.totals;

  console.log(c('bold', 'summary'));
  console.log(`  ${librariesProcessed} ${pl(librariesProcessed, 'library')} processed`);

  if (changes === 0) {
    console.log(`  ${c('green', '✓')} host already up to date`);
  } else {
    const verb = report.dryRun ? 'would apply' : 'applied';
    console.log(`  ${c('green', '✓')} ${verb} ${changes} ${pl(changes, 'change')}`);
  }

  if (warnings > 0) {
    console.log(`  ${c('yellow', '!')} ${warnings} ${pl(warnings, 'warning')} (see above)`);
  }

  if (report.dryRun && changes > 0) {
    console.log();
    console.log(c('yellow', 'dry-run: nothing was written.'));
  }
  console.log();
}

function pl(n: number, word: string): string {
  if (n === 1) return word;
  // English pluralization quirks for the words we use
  if (word === 'library') return 'libraries';
  return word + 's';
}
