/* ========================================================================== */
/*                            MARKER BLOCK HELPER                             */
/* ========================================================================== */

/**
 * Bracket-managed text edits for executable JS/TS config files (next.config.*,
 * jest.config.*, .storybook/main.*, CLAUDE.md).
 *
 * Each block is identified by `(libName, scope)` so different libraries — and
 * different scopes within one library — never collide:
 *
 *   // [LIB-WIRING:schematic:alias-START]
 *   ...generated content...
 *   // [LIB-WIRING:schematic:alias-END]
 *
 * Use `'default'` as `libName` for tool-managed (non-per-library) blocks
 * such as default-workflow exclusions.
 */

const TAG = 'LIB-WIRING';

export type MarkerNames = {
  start: string;
  end: string;
};

export function markerNames(libName: string, scope: string): MarkerNames {
  return {
    start: `// [${TAG}:${libName}:${scope}-START]`,
    end: `// [${TAG}:${libName}:${scope}-END]`,
  };
}

/* -------------------------------------------------------------------------- */
/* upsertMarkerBlock — replace existing block, or insert at anchor            */
/* -------------------------------------------------------------------------- */

export type UpsertOptions = {
  /** Original file text. */
  text: string;
  /** Identifies the block. */
  libName: string;
  scope: string;
  /** Lines that go between the markers. May be multi-line. */
  content: string;
  /**
   * Regex matching the position to insert at if no existing markers found.
   * Insertion happens immediately after the match.
   * If null and no markers exist, returns `null` (caller decides what to do).
   */
  anchor: RegExp | null;
  /** Indentation prefix applied to markers and each content line. */
  indent: string;
};

/**
 * Returns:
 *   - new text if the block was inserted or updated;
 *   - the original text unchanged if the block exists and is identical;
 *   - `null` if no markers exist and no anchor matched (caller decides).
 */
export function upsertMarkerBlock(opts: UpsertOptions): string | null {
  const { text, libName, scope, content, anchor, indent } = opts;
  const { start, end } = markerNames(libName, scope);
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);

  const indentedContent = content
    .split('\n')
    .map((line) => (line.length ? indent + line : ''))
    .join('\n');
  const block = `${indent}${start}\n${indentedContent}\n${indent}${end}`;

  // Existing block — replace
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Find the start of the line containing the start marker
    const lineStart = text.lastIndexOf('\n', startIdx) + 1;
    const blockEnd = endIdx + end.length;
    const before = text.slice(0, lineStart);
    const after = text.slice(blockEnd);
    const next = before + block + after;
    return next === text ? text : next;
  }

  // No existing block — insert at anchor
  if (anchor) {
    const m = text.match(anchor);
    if (m && m.index !== undefined) {
      const insertAt = m.index + m[0].length;
      return text.slice(0, insertAt) + '\n' + block + text.slice(insertAt);
    }
  }

  // No markers, no anchor match — caller's problem
  return null;
}

/* -------------------------------------------------------------------------- */
/* removeMarkerBlock — used by uninstall flows (Phase 5+)                     */
/* -------------------------------------------------------------------------- */

export function removeMarkerBlock(
  text: string,
  libName: string,
  scope: string,
): string {
  const { start, end } = markerNames(libName, scope);
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return text;
  const lineStart = text.lastIndexOf('\n', startIdx) + 1;
  const blockEnd = endIdx + end.length;
  // Drop the trailing newline after the block too if present, to avoid blank lines
  const trailingNewline = text[blockEnd] === '\n' ? 1 : 0;
  return text.slice(0, lineStart) + text.slice(blockEnd + trailingNewline);
}

/* -------------------------------------------------------------------------- */
/* hasMarkerBlock — check without modifying                                   */
/* -------------------------------------------------------------------------- */

export function hasMarkerBlock(
  text: string,
  libName: string,
  scope: string,
): boolean {
  const { start, end } = markerNames(libName, scope);
  return text.includes(start) && text.includes(end);
}
