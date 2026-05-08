import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteJson } from './atomic-write.js';
import {
  emptyRegistry,
  USAGE_SCHEMA_VERSION,
  type TUsageRegistry,
  type TUsageProject,
  type TUsageLibrary,
} from './types.js';

/* ========================================================================== */
/*                              USAGE REGISTRY                                */
/* ========================================================================== */

/**
 * Read/write `<remoteLibraryPath>/_meta/usage.json`. Tracks which project
 * has which library at which version. Updated on `publish`, `install`,
 * `sync`, and `uninstall`.
 *
 * One JSON file. Atomic writes. No locking — project names are unique by
 * convention so the worst race is "last writer wins" on the timestamps.
 *
 * The denormalized `libraries` block is rebuilt from `projects` on every
 * write to keep them in sync.
 */
export class UsageRegistry {
  readonly remoteLibraryPath: string;
  readonly filePath: string;

  constructor(remoteLibraryPath: string) {
    this.remoteLibraryPath = remoteLibraryPath;
    this.filePath = path.join(remoteLibraryPath, '_meta', 'usage.json');
  }

  /* ------------------------------------------------------------------------ */
  /* Read / write                                                             */
  /* ------------------------------------------------------------------------ */

  async load(): Promise<TUsageRegistry> {
    let text: string;
    try {
      text = await fs.readFile(this.filePath, 'utf8');
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'ENOENT'
      ) {
        return emptyRegistry();
      }
      throw err;
    }

    const parsed = JSON.parse(text) as Partial<TUsageRegistry>;
    if (parsed.schemaVersion !== USAGE_SCHEMA_VERSION) {
      throw new Error(
        `usage.json schemaVersion ${parsed.schemaVersion} not supported ` +
          `(this tool understands v${USAGE_SCHEMA_VERSION}). ` +
          `Upgrade @beautifulbits/lib or migrate the file.`,
      );
    }
    return {
      schemaVersion: USAGE_SCHEMA_VERSION,
      updatedAt: parsed.updatedAt ?? '',
      projects: parsed.projects ?? {},
      libraries: parsed.libraries ?? {},
    };
  }

  async save(data: TUsageRegistry): Promise<void> {
    const refreshed: TUsageRegistry = {
      ...data,
      schemaVersion: USAGE_SCHEMA_VERSION,
      updatedAt: nowIso(),
      libraries: rebuildLibrariesIndex(data.projects, data.libraries),
    };
    await atomicWriteJson(this.filePath, refreshed);
  }

  /* ------------------------------------------------------------------------ */
  /* Mutations — each loads, mutates, saves                                   */
  /* ------------------------------------------------------------------------ */

  /**
   * Record that a project has a particular library at a particular version
   * installed. Used by `install` and `sync` flows.
   */
  async recordInstall(args: {
    projectName: string;
    projectPath: string;
    libName: string;
    version: string;
  }): Promise<void> {
    const { projectName, projectPath, libName, version } = args;
    const data = await this.load();
    const now = nowIso();

    const project = ensureProject(data, projectName, projectPath);
    project.lastSeen = now;

    const existing = project.libraries[libName];
    project.libraries[libName] = {
      version,
      installedAt:
        existing && existing.version === version ? existing.installedAt : now,
    };

    await this.save(data);
  }

  /**
   * Record that a library has a new latest version. Used by `publish`.
   * Doesn't touch any project record.
   */
  async recordPublish(args: { libName: string; version: string }): Promise<void> {
    const { libName, version } = args;
    const data = await this.load();
    // The denormalized libraries block is rebuilt on save; we only need to
    // ensure the entry exists with the right currentVersion. We update via
    // a temporary mark and let `rebuildLibrariesIndex` keep it consistent.
    data.libraries[libName] = {
      currentVersion: version,
      consumers: data.libraries[libName]?.consumers ?? [],
    };
    await this.save(data);
  }

  /**
   * Record that a project ran a sync against itself. Updates `lastSeen`
   * but leaves library versions alone (sync doesn't change versions).
   * Records the project's set of currently-installed libraries via the
   * given list.
   */
  async recordSync(args: {
    projectName: string;
    projectPath: string;
    libraries: Array<{ name: string; version: string }>;
  }): Promise<void> {
    const { projectName, projectPath, libraries } = args;
    const data = await this.load();
    const now = nowIso();

    const project = ensureProject(data, projectName, projectPath);
    project.lastSeen = now;
    project.path = projectPath; // refresh in case the project moved

    // Reconcile: ensure every passed-in library has an entry; preserve
    // installedAt timestamps where the version is unchanged.
    const next: Record<string, { version: string; installedAt: string }> = {};
    for (const lib of libraries) {
      const existing = project.libraries[lib.name];
      next[lib.name] = {
        version: lib.version,
        installedAt:
          existing && existing.version === lib.version
            ? existing.installedAt
            : now,
      };
    }
    project.libraries = next;

    await this.save(data);
  }

  async recordUninstall(args: {
    projectName: string;
    libName: string;
  }): Promise<void> {
    const { projectName, libName } = args;
    const data = await this.load();
    const project = data.projects[projectName];
    if (!project) return;
    delete project.libraries[libName];
    project.lastSeen = nowIso();
    // If the project has no libraries left, drop it.
    if (Object.keys(project.libraries).length === 0) {
      delete data.projects[projectName];
    }
    await this.save(data);
  }

  /* ------------------------------------------------------------------------ */
  /* Reads                                                                    */
  /* ------------------------------------------------------------------------ */

  async getProject(name: string): Promise<TUsageProject | null> {
    const data = await this.load();
    return data.projects[name] ?? null;
  }

  async getLibrary(name: string): Promise<TUsageLibrary | null> {
    const data = await this.load();
    return data.libraries[name] ?? null;
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function ensureProject(
  data: TUsageRegistry,
  name: string,
  projectPath: string,
): TUsageProject {
  if (!data.projects[name]) {
    data.projects[name] = {
      path: projectPath,
      lastSeen: nowIso(),
      libraries: {},
    };
  }
  return data.projects[name];
}

/**
 * Rebuilds the denormalized `libraries` block from project installations,
 * preserving `currentVersion` from any existing entries set by
 * `recordPublish` (which is authoritative about the latest published
 * version, independent of consumers).
 */
function rebuildLibrariesIndex(
  projects: Record<string, TUsageProject>,
  existing: Record<string, TUsageLibrary>,
): Record<string, TUsageLibrary> {
  const index: Record<string, TUsageLibrary> = {};

  // Seed with existing libraries so `currentVersion` is preserved even when
  // no project has the library installed (e.g., just-published-not-yet-consumed).
  for (const [libName, lib] of Object.entries(existing)) {
    index[libName] = { currentVersion: lib.currentVersion, consumers: [] };
  }

  // Walk projects, attribute consumers, and bump currentVersion if a
  // consumer is on a newer version than what was published-recorded.
  for (const [projectName, project] of Object.entries(projects)) {
    for (const [libName, entry] of Object.entries(project.libraries)) {
      const lib =
        index[libName] ?? { currentVersion: entry.version, consumers: [] };
      if (compareVersions(entry.version, lib.currentVersion) > 0) {
        lib.currentVersion = entry.version;
      }
      if (!lib.consumers.includes(projectName)) {
        lib.consumers.push(projectName);
      }
      index[libName] = lib;
    }
  }

  for (const lib of Object.values(index)) {
    lib.consumers.sort();
  }
  return index;
}

function compareVersions(a: string, b: string): number {
  // Best-effort numeric comparison of dotted versions; falls back to lex.
  const ap = a.split('.').map((n) => Number.parseInt(n, 10));
  const bp = b.split('.').map((n) => Number.parseInt(n, 10));
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = Number.isFinite(ap[i] ?? NaN) ? (ap[i] as number) : -1;
    const bv = Number.isFinite(bp[i] ?? NaN) ? (bp[i] as number) : -1;
    if (av !== bv) return av - bv;
  }
  return a.localeCompare(b);
}

function nowIso(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Re-exports                                                                 */
/* -------------------------------------------------------------------------- */

export type {
  TUsageRegistry,
  TUsageProject,
  TUsageLibrary,
  TUsageLibraryEntry,
} from './types.js';
export { USAGE_SCHEMA_VERSION, emptyRegistry } from './types.js';
