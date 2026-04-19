import { log } from 'console';
import * as vscode from 'vscode';

/**
 * Resolves the keys of the `ui` prop by finding the `theme` import in the
 * declaration file, following it to the actual theme file via the definition
 * provider, and extracting the `slots` object keys via document symbols.
 */
export async function resolveUiKeys(declarationUri: vscode.Uri): Promise<string[]> {
  const document = await vscode.workspace.openTextDocument(declarationUri);
  const text = document.getText();

  const themeImportMatch = text.match(/import\s+theme\s+from\s+['"](.+)['"]/);
  if (!themeImportMatch) return [];

  const themePosition = document.positionAt(text.indexOf(themeImportMatch[0]) + themeImportMatch[0].indexOf('theme'));

  const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
    'vscode.executeDefinitionProvider',
    declarationUri,
    themePosition,
  );
  if (!locations?.length) return [];

  const loc = locations[0];
  const themeUri = 'targetUri' in loc ? loc.targetUri : loc.uri;

  try {
    await vscode.workspace.openTextDocument(themeUri);
  } catch {
    return [];
  }

  const symbols =
    (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', themeUri)) ?? [];

  const defaultSymbol = symbols.find((s) => s.name === 'default');
  const slotsSymbol = defaultSymbol?.children?.find((s) => s.name === '"slots"')?.children ?? [];

  return slotsSymbol.map((c) => c.name.replaceAll('"', ''));
}
