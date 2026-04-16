import * as vscode from 'vscode';

// From src/webview/panel.ts
export interface ComponentTagFileContext {
  documentUri: vscode.Uri;
  tagOffset: number;
  tagName: string;
}

// From src/file-scanners/FileScanners.interface.ts
export interface ComponentMatch {
  /** Full tag name, including the `U` prefix (e.g. `UButton`). */
  tagName: string;
  /** Range covering the `<Tag` opening delimiter (without attributes). */
  range: vscode.Range;
  /** Position of the `<` character — useful as an inlay hint anchor. */
  start: vscode.Position;
}

// From src/utils/typeFileResolver.ts
export interface ComponentInfo {
  slots: string[];
  props: string[];
  uiKeys: string[];
}

// From src/utils/tagUtils.ts
export interface ParsedTag {
  /** Index right after the closing `>` or `/>` */
  openTagEnd: number;
  /** Whether the tag is self-closing (`/>`) */
  selfClosing: boolean;
  /** Index of the `>` (or `/` for `/>`) */
  closeCharIdx: number;
}

// From src/version.ts
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
