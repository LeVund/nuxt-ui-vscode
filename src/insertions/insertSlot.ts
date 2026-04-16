import * as vscode from 'vscode';
import type { ComponentContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { findMatchingClose } from '../parsing/findMatchingClose';
import { getLineIndentation } from '../editor/indentation';

export async function insertSlot({ tagOffset, tagName, ...ctx }: ComponentContext, slotName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;

  const { document, text, tag } = parsed;

  const edit = new vscode.WorkspaceEdit();
  const tagLine = document.positionAt(tagOffset).line;
  const indentation = getLineIndentation(document, tagLine);
  const slotIndent = indentation + '  ';

  if (tag.selfClosing) {
    const slashGtPos = document.positionAt(tag.openTagEnd - 2);
    const afterGtPos = document.positionAt(tag.openTagEnd);
    const replacement = `>\n${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}</${tagName}>`;
    edit.replace(document.uri, new vscode.Range(slashGtPos, afterGtPos), replacement);
  } else {
    const closingIdx = findMatchingClose(text, tagName, tag.openTagEnd);
    if (closingIdx === -1) {
      void vscode.window.showWarningMessage(`Could not find the closing </${tagName}> tag.`);
      return;
    }

    const innerContent = text.slice(tag.openTagEnd, closingIdx);
    if (new RegExp(`#${slotName}\\b`).test(innerContent)) {
      void vscode.window.showInformationMessage(`Slot #${slotName} is already used in <${tagName}>.`);
      return;
    }

    const insertPos = document.positionAt(closingIdx);
    const insertion = `${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}`;
    edit.insert(document.uri, insertPos, insertion);
  }

  await vscode.workspace.applyEdit(edit);
}
