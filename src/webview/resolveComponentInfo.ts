import * as vscode from 'vscode';
import type { ComponentTagFileContext, ComponentInfo } from '../core/types';
import { resolveDeclarationPath } from '../typeInfo/resolveDeclarationPath';
import { readComponentInfo } from '../typeInfo/readComponentInfo';

export async function resolveComponentInfo({ documentUri, tagOffset }: ComponentTagFileContext): Promise<ComponentInfo> {
  const empty: ComponentInfo = { slots: [], props: [], uiKeys: [] };

  const document = await vscode.workspace.openTextDocument(documentUri);
  const namePosition = document.positionAt(tagOffset + 1);

  // Get <component>.d.vue.ts path from the component usage position
  const locations = await vscode.commands.executeCommand<vscode.LocationLink[]>(
    'vscode.executeDefinitionProvider',
    documentUri,
    namePosition,
  );

  const rawPath = locations?.[0]?.targetUri.fsPath;

  // Definition provider often returns the `.vue` source file path; resolve it to the adjacent `.vue.d.ts` declaration file.
  const declarationPath = rawPath ? resolveDeclarationPath(rawPath) : undefined;

  if (!declarationPath) return empty;

  const info = await readComponentInfo(declarationPath);
  return info;
}
