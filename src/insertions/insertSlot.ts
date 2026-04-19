import * as vscode from 'vscode';
import type { ComponentTagFileContext, ParsedTag } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { findMatchingCloseTag } from '../parsing/findMatchingCloseTag';
import { getLineIndentation } from '../editor/indentation';

function fromSelfClosingToDoubleTag(
  document: vscode.TextDocument,
  tag: ParsedTag,
  tagName: string,
  indentation: string,
): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit();

  const slashGtPos = document.positionAt(tag.openTagEnd - 2);
  const afterGtPos = document.positionAt(tag.openTagEnd);
  const replacement = `>${indentation}</${tagName}>`;

  edit.replace(document.uri, new vscode.Range(slashGtPos, afterGtPos), replacement);
  return edit;
}

function buildInsertSlotEdit(
  document: vscode.TextDocument,
  closingTagIdx: number,
  slotName: string,
  binding: string | undefined,
  indentation: string,
  slotIndent: string,
): vscode.WorkspaceEdit {
  const destructure = binding ? `="{ ${binding} }"` : '';
  const insertion = `\n${slotIndent}<template #${slotName}${destructure}></template>\n${indentation}`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(closingTagIdx), insertion);
  return edit;
}

function buildAddBindingEdit(
  document: vscode.TextDocument,
  absoluteMatchIdx: number,
  fullMatch: string,
  existingDestructure: string | undefined,
  binding: string,
): vscode.WorkspaceEdit | undefined {
  if (existingDestructure === undefined) {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(absoluteMatchIdx + fullMatch.length), `="{ ${binding} }"`);
    return edit;
  }

  const existingBindings = existingDestructure
    .replace(/^\s*\{/, '')
    .replace(/\}\s*$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const newDestructure = `{ ${[...existingBindings, binding].join(', ')} }`;

  const destructureStartInMatch = fullMatch.indexOf(existingDestructure);
  if (destructureStartInMatch === -1) return undefined;

  const start = document.positionAt(absoluteMatchIdx + destructureStartInMatch);
  const end = document.positionAt(absoluteMatchIdx + destructureStartInMatch + existingDestructure.length);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(start, end), newDestructure);
  return edit;
}

export async function insertSlot(
  componentTagFileContext: ComponentTagFileContext,
  slotName: string,
  binding?: string,
): Promise<void> {
  const { tagOffset, tagName } = componentTagFileContext;
  const parsed = await getTagContext(componentTagFileContext);
  if (!parsed) return;

  const { document, tag } = parsed;
  const tagLine = document.positionAt(tagOffset).line;
  const indentation = getLineIndentation(document, tagLine);
  const slotIndent = indentation + '  ';

  if (tag.selfClosing) {
    await vscode.workspace.applyEdit(fromSelfClosingToDoubleTag(document, tag, tagName, indentation));
  }

  const text = document.getText();
  const closingTagIdx = findMatchingCloseTag(text, tagName, tag.openTagEnd);
  if (closingTagIdx === -1) {
    void vscode.window.showWarningMessage(`Could not find the closing </${tagName}> tag.`);
    return;
  }

  const innerStart = tag.openTagEnd;
  const innerContent = text.slice(innerStart, closingTagIdx);

  const slotRegex = new RegExp(`<template\\s+#${slotName}(?:\\s*=\\s*"([^"]*)")?`);
  const slotMatch = slotRegex.exec(innerContent);

  if (!slotMatch) {
    await vscode.workspace.applyEdit(buildInsertSlotEdit(document, closingTagIdx, slotName, binding, indentation, slotIndent));
    return;
  }

  if (!binding) {
    void vscode.window.showInformationMessage(`Slot #${slotName} is already used in <${tagName}>.`);
    return;
  }

  const existingDestructure = slotMatch[1];
  if (existingDestructure && new RegExp(`\\b${binding}\\b`).test(existingDestructure)) {
    void vscode.window.showInformationMessage(`Binding "${binding}" is already set on slot #${slotName}.`);
    return;
  }

  const absoluteMatchIdx = innerStart + slotMatch.index;
  const edit = buildAddBindingEdit(document, absoluteMatchIdx, slotMatch[0], existingDestructure, binding);
  if (!edit) {
    void vscode.window.showWarningMessage(`Could not update slot #${slotName} on <${tagName}>.`);
    return;
  }
  await vscode.workspace.applyEdit(edit);
}
