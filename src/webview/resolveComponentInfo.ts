import * as vscode from 'vscode';
import type { ComponentContext, ComponentInfo } from '../core/types';
import { resolveDeclarationPath } from '../typeInfo/resolveDeclarationPath';
import { readComponentInfo } from '../typeInfo/readComponentInfo';

export async function resolveComponentInfo({
  documentUri,
  tagOffset,
  tagName,
}: ComponentContext): Promise<ComponentInfo> {
  const empty: ComponentInfo = { slots: [], props: [], uiKeys: [] };
  const log = (msg: string, ...args: unknown[]) => console.log(`[nuxt-ui] ${msg}`, ...args);

  log('resolveComponentInfo for <%s> at offset %d in %s', tagName, tagOffset, documentUri.fsPath);

  const document = await vscode.workspace.openTextDocument(documentUri);
  const namePosition = document.positionAt(tagOffset + 1);
  const locations = await vscode.commands.executeCommand<vscode.LocationLink[]>(
    'vscode.executeDefinitionProvider',
    documentUri,
    namePosition,
  );

  const rawPath = locations?.[0]?.targetUri.fsPath;
  console.log({ rawPath });

  const declarationPath = rawPath ? resolveDeclarationPath(rawPath) : undefined;

  console.log({ declarationPath });

  if (!declarationPath) return empty;

  const info = await readComponentInfo(declarationPath);
  log('readComponentInfo result: slots=%o, props=%o, uiKeys=%o', info.slots, info.props, info.uiKeys);
  return info;
}
