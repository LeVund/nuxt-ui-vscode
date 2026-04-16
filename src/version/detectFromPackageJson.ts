import * as vscode from 'vscode';
import * as path from 'path';
import type { VersionInfo } from '../core/types';
import { parseMajor } from './parseMajor';

const V4_BASE = 'https://ui.nuxt.com';
const V3_BASE = 'https://ui3.nuxt.com';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readPackageJson(folderUri: vscode.Uri): Promise<PackageJson | undefined> {
  const pkgUri = vscode.Uri.file(path.join(folderUri.fsPath, 'package.json'));
  try {
    const content = await vscode.workspace.fs.readFile(pkgUri);
    return JSON.parse(Buffer.from(content).toString('utf-8')) as PackageJson;
  } catch {
    return undefined;
  }
}

function detectVersionFromDeps(pkg: PackageJson): VersionInfo | undefined {
  const raw = pkg.dependencies?.['@nuxt/ui'] ?? pkg.devDependencies?.['@nuxt/ui'];
  if (!raw) return undefined;

  const version = parseMajor(raw);
  if (version === 3) return { version: 'v3', baseUrl: V3_BASE, raw, fallback: false };
  if (version === 4) return { version: 'v4', baseUrl: V4_BASE, raw, fallback: false };
  // Unknown / unsupported major — fall back to latest but keep the raw
  return { version: 'v4', baseUrl: V4_BASE, raw, fallback: true };
}

export async function detectFromPackageJson(): Promise<VersionInfo | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  for (const folder of folders) {
    const pkg = await readPackageJson(folder.uri);
    if (!pkg) continue;
    const detected = detectVersionFromDeps(pkg);
    if (detected) return detected;
  }
  return undefined;
}
