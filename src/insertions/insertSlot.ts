import * as vscode from 'vscode';
import type { ComponentTagFileContext, ParsedTag } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { findMatchingClose } from '../parsing/findMatchingClose';
import { getLineIndentation } from '../editor/indentation';

function buildSelfClosingSlotEdit(
  document: vscode.TextDocument,
  tag: ParsedTag,
  tagName: string,
  slotName: string,
  indentation: string,
  slotIndent: string,
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();

  const slashGtPos = document.positionAt(tag.openTagEnd - 2);
  const afterGtPos = document.positionAt(tag.openTagEnd);
  const replacement = `>\n${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}</${tagName}>`;

  edit.replace(document.uri, new vscode.Range(slashGtPos, afterGtPos), replacement);
  return edit;
}

function buildPairedSlotEdit(
  document: vscode.TextDocument,
  text: string,
  tag: ParsedTag,
  tagName: string,
  slotName: string,
  indentation: string,
  slotIndent: string,
): vscode.WorkspaceEdit | undefined {
  const closingIdx = findMatchingClose(text, tagName, tag.openTagEnd);
  if (closingIdx === -1) {
    void vscode.window.showWarningMessage(`Could not find the closing </${tagName}> tag.`);
    return undefined;
  }

  const innerContent = text.slice(tag.openTagEnd, closingIdx);
  if (new RegExp(`#${slotName}\\b`).test(innerContent)) {
    void vscode.window.showInformationMessage(`Slot #${slotName} is already used in <${tagName}>.`);
    return undefined;
  }

  const edit = new vscode.WorkspaceEdit();
  const insertPos = document.positionAt(closingIdx);
  const insertion = `${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}`;
  edit.insert(document.uri, insertPos, insertion);
  return edit;
}

export async function insertSlot(componentTagFileContext: ComponentTagFileContext, slotName: string): Promise<void> {
  const { tagOffset, tagName } = componentTagFileContext;
  const parsed = await getTagContext(componentTagFileContext);
  if (!parsed) return;

  const { document, text, tag } = parsed;
  const tagLine = document.positionAt(tagOffset).line;
  const indentation = getLineIndentation(document, tagLine);
  const slotIndent = indentation + '  ';

  const edit = tag.selfClosing
    ? buildSelfClosingSlotEdit(document, tag, tagName, slotName, indentation, slotIndent)
    : buildPairedSlotEdit(document, text, tag, tagName, slotName, indentation, slotIndent);

  if (edit) await vscode.workspace.applyEdit(edit);
}
