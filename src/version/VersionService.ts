import * as vscode from 'vscode';
import type { VersionInfo } from '../core/types';
import { detectFromPackageJson } from './detectFromPackageJson';

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
 *   1. Setting `nuxtUiCodeLens.version` if set to `v3` or `v4`
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
        if (e.affectsConfiguration('nuxtUiCodeLens.version')) {
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
      .getConfiguration('nuxtUiCodeLens')
      .get<string>('version', 'auto');

    if (configured === 'v3') {
      return { version: 'v3', baseUrl: V3_BASE, fallback: false };
    }
    if (configured === 'v4') {
      return { version: 'v4', baseUrl: V4_BASE, fallback: false };
    }

    // auto: read @nuxt/ui from workspace package.json
    const detected = await detectFromPackageJson();
    if (detected) {
      return detected;
    }
    return DEFAULT_INFO;
  }

  dispose(): void {
    this._onDidChange.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
