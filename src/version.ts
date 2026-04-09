import * as vscode from 'vscode';
import * as path from 'path';

export type NuxtUiVersion = 'v3' | 'v4';

export interface VersionInfo {
  version: NuxtUiVersion;
  /** Base URL for documentation (no trailing slash). */
  baseUrl: string;
  /** Raw semver string detected from package.json, if any. */
  raw?: string;
  /** True when resolution fell back to the default version. */
  fallback: boolean;
}

const V4_BASE = 'https://ui.nuxt.com';
const V3_BASE = 'https://ui3.nuxt.com';

const DEFAULT_INFO: VersionInfo = {
  version: 'v4',
  baseUrl: V4_BASE,
  fallback: true,
};

/**
 * Tracks the Nuxt UI version in use for the current workspace.
 *
 * Resolution order:
 *   1. Setting `nuxtUi.version` if set to `v3` or `v4`
 *   2. `@nuxt/ui` version declared in the nearest workspace package.json
 *   3. Default: v4 (latest)
 *
 * Re-resolves automatically when package.json or the setting changes.
 */
export class VersionService implements vscode.Disposable {
  private _current: VersionInfo = DEFAULT_INFO;
  private readonly _onDidChange = new vscode.EventEmitter<VersionInfo>();
  readonly onDidChange = this._onDidChange.event;

  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    // Watch workspace package.json files
    const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
    watcher.onDidChange(() => this.refresh(), null, this.disposables);
    watcher.onDidCreate(() => this.refresh(), null, this.disposables);
    watcher.onDidDelete(() => this.refresh(), null, this.disposables);
    this.disposables.push(watcher);

    // Watch the setting
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('nuxtUi.version')) {
          void this.refresh();
        }
      },
      null,
      this.disposables,
    );

    // Initial resolution
    void this.refresh();
  }

  get current(): VersionInfo {
    return this._current;
  }

  async refresh(): Promise<VersionInfo> {
    const next = await this.resolve();
    const changed =
      next.version !== this._current.version || next.baseUrl !== this._current.baseUrl;
    this._current = next;
    if (changed) {
      this._onDidChange.fire(next);
    }
    return next;
  }

  private async resolve(): Promise<VersionInfo> {
    const configured = vscode.workspace
      .getConfiguration('nuxtUi')
      .get<string>('version', 'auto');

    if (configured === 'v3') {
      return { version: 'v3', baseUrl: V3_BASE, fallback: false };
    }
    if (configured === 'v4') {
      return { version: 'v4', baseUrl: V4_BASE, fallback: false };
    }

    // auto: read @nuxt/ui from workspace package.json
    const detected = await this.detectFromPackageJson();
    if (detected) {
      return detected;
    }
    return DEFAULT_INFO;
  }

  private async detectFromPackageJson(): Promise<VersionInfo | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }

    // Check each root package.json (multi-root workspaces supported)
    for (const folder of folders) {
      const pkgUri = vscode.Uri.file(path.join(folder.uri.fsPath, 'package.json'));
      try {
        const content = await vscode.workspace.fs.readFile(pkgUri);
        const pkg = JSON.parse(Buffer.from(content).toString('utf-8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const raw =
          pkg.dependencies?.['@nuxt/ui'] ?? pkg.devDependencies?.['@nuxt/ui'];
        if (!raw) {
          continue;
        }
        const version = parseMajor(raw);
        if (version === 3) {
          return { version: 'v3', baseUrl: V3_BASE, raw, fallback: false };
        }
        if (version === 4) {
          return { version: 'v4', baseUrl: V4_BASE, raw, fallback: false };
        }
        // Unknown / unsupported major — fall back to latest but keep the raw
        return { version: 'v4', baseUrl: V4_BASE, raw, fallback: true };
      } catch {
        // Ignore missing or unreadable package.json
      }
    }
    return undefined;
  }

  dispose(): void {
    this._onDidChange.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * Extract the major version from a semver range string.
 * Handles `^4.0.0`, `~4.1.2`, `4.x`, `>=4.0.0 <5.0.0`, `npm:@nuxt/ui@4.0.0`, etc.
 */
function parseMajor(range: string): number | undefined {
  const match = range.match(/(\d+)/);
  if (!match) {
    return undefined;
  }
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : undefined;
}
