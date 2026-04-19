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

function buildInsertSlotSnippet(
  slotName: string,
  binding: string | undefined,
  indentation: string,
  slotIndent: string,
): vscode.SnippetString {
  const destructure = binding ? `="{ ${binding} }"` : '';
  const snippet = new vscode.SnippetString();
  snippet.appendText(`\n${slotIndent}<template #${slotName}${destructure}>`);
  snippet.appendTabstop(0);
  snippet.appendText(`</template>\n${indentation}`);
  return snippet;
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
  const editor = await vscode.window.showTextDocument(document);

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
    const snippet = buildInsertSlotSnippet(slotName, binding, indentation, slotIndent);
    await editor.insertSnippet(snippet, document.positionAt(closingTagIdx));
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
