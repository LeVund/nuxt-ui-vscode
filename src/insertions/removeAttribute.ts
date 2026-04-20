import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { classifyAttribute, parseAttributes, type AttributeKind } from '../parsing/parseAttributes';

export async function removeAttribute(
  ctx: ComponentTagFileContext,
  kind: AttributeKind,
  targetKey: string,
): Promise<void> {
  const parsed = await getTagContext(ctx);
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const { tagOffset, tagName } = ctx;
  const openTagEndInclusive = tag.closeCharIdx + (tag.selfClosing ? 2 : 1);
  const openTagText = text.slice(tagOffset, openTagEndInclusive);
  const attrs = parseAttributes(openTagText, tagName);

  const match = attrs.find((a) => {
    const c = classifyAttribute(a.rawName);
    return c !== undefined && c.kind === kind && c.key === targetKey;
  });

  if (!match) {
    void vscode.window.showInformationMessage(`Attribute not found on <${tagName}>.`);
    return;
  }

  const editor = await vscode.window.showTextDocument(document);
  const start = document.positionAt(tagOffset + match.fullStart);
  const end = document.positionAt(tagOffset + match.fullEnd);
  await editor.edit((b) => b.delete(new vscode.Range(start, end)));

  const cursor = document.positionAt(tagOffset + 1 + tagName.length);
  editor.selection = new vscode.Selection(cursor, cursor);
  editor.revealRange(new vscode.Range(cursor, cursor));
}
