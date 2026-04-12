import * as vscode from 'vscode';
import { VersionService } from '../version';
import { tagToSlug, toKebabCase } from '../components';
import { readComponentInfo, resolveDeclarationPath } from '../slots';
import { renderHtml, homePath, componentPath, extractPath } from './html';

export interface ComponentContext {
  documentUri: vscode.Uri;
  tagOffset: number;
  tagName: string;
}

export class DocPanel {
  private static readonly VIEW_TYPE = 'nuxtUi.docs';
  private panel: vscode.WebviewPanel | undefined;
  private currentUrl: string | undefined;
  private currentContext: ComponentContext | undefined;
  private version: VersionService;

  constructor(version: VersionService) {
    this.version = version;
  }

  // openHome(): void {
  //   this.currentContext = undefined;
  //   const url = `${this.version.current.baseUrl}${homePath(this.version.current.version)}`;
  //   this.openComponent('Nuxt UI — Docs', url, undefined, { slots: [], props: [], uiKeys: [] });
  // }

  async openComponent(tagName: string, context?: ComponentContext): Promise<void> {
    this.currentContext = context;
    const slug = tagToSlug(tagName);
    if (!slug) {
      void vscode.window.showWarningMessage(`"${tagName}" is not a known Nuxt UI component.`);
      return;
    }
    const url = `${this.version.current.baseUrl}${componentPath(this.version.current.version, slug)}`;
    const info = context ? await resolveComponentInfo(context) : { slots: [], props: [], uiKeys: [] };
    const title = context ? `Nuxt UI — ${tagName}` : 'Nuxt UI — Component';

    if (!this.panel) this.initPanel(title);
    this.updatePanel(title, url, info);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private initPanel(title: string): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(DocPanel.VIEW_TYPE, title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });

      this.panel.webview.onDidReceiveMessage(async (msg: unknown) => {
        if (!msg || typeof msg !== 'object') return;
        const m = msg as Record<string, unknown>;

        if (!this.currentContext) return;

        if (m.command === 'insertSlot' && typeof m.slotName === 'string') {
          await insertSlot(this.currentContext, m.slotName);
        } else if (m.command === 'insertProp' && typeof m.propName === 'string') {
          await insertProp(this.currentContext, m.propName);
        } else if (m.command === 'insertUiKey' && typeof m.keyName === 'string') {
          await insertUiKey(this.currentContext, m.keyName);
        }
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentUrl = undefined;
        this.currentContext = undefined;
      });
    }
  }

  private updatePanel(title: string, url: string, info: { slots: string[]; props: string[]; uiKeys: string[] }): void {
    if (!this.panel || !this.currentContext) return;
    const { tagName } = this.currentContext!;

    this.panel.title = title;
    this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);

    this.currentUrl = url;
    this.panel.webview.html = renderHtml(url, tagName, info.slots, info.props, info.uiKeys);
  }
}

// =============================================================================
// Declaration path resolution
// =============================================================================

async function resolveComponentInfo({
  documentUri,
  tagOffset,
  tagName,
}: ComponentContext): Promise<{ slots: string[]; props: string[]; uiKeys: string[] }> {
  const empty = { slots: [], props: [], uiKeys: [] };
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

// =============================================================================
// Tag parsing helpers
// =============================================================================

interface ParsedTag {
  /** Index right after the closing `>` or `/>` */
  openTagEnd: number;
  /** Whether the tag is self-closing (`/>`) */
  selfClosing: boolean;
  /** Index of the `>` (or `/` for `/>`) */
  closeCharIdx: number;
}

function parseOpeningTag(text: string, tagStart: number, tagName: string): ParsedTag | undefined {
  let i = tagStart + 1 + tagName.length;
  let inString: string | null = null;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      return { openTagEnd: i + 2, selfClosing: true, closeCharIdx: i };
    } else if (ch === '>') {
      return { openTagEnd: i + 1, selfClosing: false, closeCharIdx: i };
    }
    i++;
  }
  return undefined;
}

function findMatchingClose(text: string, tagName: string, fromIndex: number): number {
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`<\\/${tagName}>`, 'g');

  openRe.lastIndex = fromIndex;
  closeRe.lastIndex = fromIndex;

  let depth = 0;
  let nextOpen = openRe.exec(text);
  let nextClose = closeRe.exec(text);

  while (nextClose !== null) {
    const openIdx = nextOpen ? nextOpen.index : Infinity;
    const closeIdx = nextClose.index;

    if (openIdx < closeIdx) {
      depth++;
      nextOpen = openRe.exec(text);
    } else {
      if (depth === 0) return closeIdx;
      depth--;
      nextClose = closeRe.exec(text);
    }
  }

  return -1;
}

function getLineIndentation(document: vscode.TextDocument, line: number): string {
  return document.lineAt(line).text.match(/^(\s*)/)?.[1] ?? '';
}

// =============================================================================
// Insertion commands
// =============================================================================

async function openContextDocument({
  documentUri,
  tagOffset,
  tagName,
}: ComponentContext): Promise<{ document: vscode.TextDocument; text: string; tag: ParsedTag } | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(documentUri);
  } catch {
    void vscode.window.showErrorMessage('Could not open the source file.');
    return undefined;
  }

  const text = document.getText();
  const tag = parseOpeningTag(text, tagOffset, tagName);
  if (!tag) {
    void vscode.window.showWarningMessage(`Could not parse the opening tag of <${tagName}>.`);
    return undefined;
  }

  return { document, text, tag };
}

async function insertSlot({ tagOffset, tagName, ...ctx }: ComponentContext, slotName: string): Promise<void> {
  const parsed = await openContextDocument({ tagOffset, tagName, ...ctx });
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

async function insertProp({ tagOffset, tagName, ...ctx }: ComponentContext, propName: string): Promise<void> {
  const parsed = await openContextDocument({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const attrName = toKebabCase(propName);
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (new RegExp(`\\b:?${attrName}\\s*=|v-bind:${attrName}\\s*=`).test(openTagText)) {
    void vscode.window.showInformationMessage(`Prop "${attrName}" is already set on <${tagName}>.`);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${prefix}:${attrName}=""`);
  await vscode.workspace.applyEdit(edit);
}

async function insertUiKey({ tagOffset, tagName, ...ctx }: ComponentContext, keyName: string): Promise<void> {
  const parsed = await openContextDocument({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const tagText = text.slice(tagOffset, tag.closeCharIdx);
  const uiAttrMatch = /(?::ui|v-bind:ui)\s*=\s*(["'])/.exec(tagText);

  if (!uiAttrMatch) {
    const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
    const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${prefix}:ui="{ ${keyName}: '' }"`);
    await vscode.workspace.applyEdit(edit);
    return;
  }

  const quoteChar = uiAttrMatch[1];
  const attrValueStart = tagOffset + uiAttrMatch.index + uiAttrMatch[0].length;

  let closingQuotePos = -1;
  for (let j = attrValueStart; j < text.length; j++) {
    if (text[j] === quoteChar) {
      closingQuotePos = j;
      break;
    }
  }

  if (closingQuotePos === -1) {
    void vscode.window.showWarningMessage(`Could not parse the :ui attribute value of <${tagName}>.`);
    return;
  }

  const attrValue = text.slice(attrValueStart, closingQuotePos);

  if (new RegExp(`\\b${keyName}\\s*:`).test(attrValue)) {
    void vscode.window.showInformationMessage(`UI key "${keyName}" is already set on <${tagName}>.`);
    return;
  }

  const lastBrace = attrValue.lastIndexOf('}');
  if (lastBrace === -1) {
    void vscode.window.showWarningMessage(`Could not locate the :ui object for <${tagName}>.`);
    return;
  }

  const innerContent = attrValue
    .slice(0, lastBrace)
    .replace(/^\s*\{/, '')
    .trim();
  const insertion = innerContent.length > 0 ? `, ${keyName}: ''` : `${keyName}: ''`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(attrValueStart + lastBrace), insertion);
  await vscode.workspace.applyEdit(edit);
}
