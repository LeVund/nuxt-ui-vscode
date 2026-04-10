import * as vscode from 'vscode';
import { VersionService } from '../version';
import { tagToSlug, toKebabCase } from '../components';
import { readComponentSlots, readComponentProps } from '../slots';

/**
 * Contextual information about the source component tag that triggered the
 * panel open. Used to locate the tag in the document when inserting slots.
 */
export interface ComponentContext {
  /** URI of the .vue file containing the component tag. */
  documentUri: vscode.Uri;
  /** Character offset of the `<` of the opening tag in the document. */
  tagOffset: number;
  /** Full tag name including the `U` prefix (e.g. `UCard`). */
  tagName: string;
}

/**
 * Manages a single reusable webview panel that displays the Nuxt UI
 * documentation inside an iframe, along with a slot insertion panel.
 *
 * A second call to `openComponent` or `openHome` while a panel is already
 * open reuses it and navigates / refreshes.
 */
export class DocPanel {
  private static readonly VIEW_TYPE = 'nuxtUi.docs';
  private panel: vscode.WebviewPanel | undefined;
  private currentUrl: string | undefined;
  private currentContext: ComponentContext | undefined;

  constructor(private readonly version: VersionService) {
    version.onDidChange(() => {
      if (this.panel && this.currentUrl) {
        const p = extractPath(this.currentUrl);
        this.navigate(`${this.version.current.baseUrl}${p}`);
      }
    });
  }

  openHome(): void {
    this.currentContext = undefined;
    const url = `${this.version.current.baseUrl}${homePath(this.version.current.version)}`;
    this.show('Nuxt UI — Docs', url, undefined);
  }

  /**
   * Open or focus the documentation page for a given component tag.
   * When `context` is provided the panel also shows a slot-insertion panel.
   *
   * `tagName` must include the `U` prefix (e.g. `UButton`).
   */
  openComponent(tagName: string, context?: ComponentContext): void {
    const slug = tagToSlug(tagName);
    if (!slug) {
      void vscode.window.showWarningMessage(`"${tagName}" is not a known Nuxt UI component.`);
      return;
    }
    const url = `${this.version.current.baseUrl}${componentPath(this.version.current.version, slug)}`;
    this.show(`Nuxt UI — ${tagName}`, url, context);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private show(title: string, url: string, context: ComponentContext | undefined): void {
    this.currentContext = context;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(DocPanel.VIEW_TYPE, title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });

      this.panel.webview.onDidReceiveMessage(async (msg: unknown) => {
        if (!msg || typeof msg !== 'object') return;
        const m = msg as Record<string, unknown>;
        if (m.command === 'insertSlot') {
          const slotName = m.slotName as string;
          if (typeof slotName === 'string' && slotName.length > 0) {
            await this.handleInsertSlot(slotName);
          }
        } else if (m.command === 'insertProp') {
          const propName = m.propName as string;
          if (typeof propName === 'string' && propName.length > 0) {
            await this.handleInsertProp(propName);
          }
        }
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentUrl = undefined;
        this.currentContext = undefined;
      });
    } else {
      this.panel.title = title;
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);
    }

    this.navigate(url, context);
  }

  private navigate(url: string, context?: ComponentContext): void {
    if (!this.panel) {
      return;
    }
    this.currentUrl = url;

    // Read slots and props only when we have component context.
    const componentName = context !== undefined ? context.tagName.slice(1) : '';
    const slots = context !== undefined ? readComponentSlots(componentName) : [];
    const props = context !== undefined ? readComponentProps(componentName) : [];

    this.panel.webview.html = renderHtml(url, context, slots, props);
  }

  private async handleInsertSlot(slotName: string): Promise<void> {
    const context = this.currentContext;
    if (!context) {
      return;
    }
    await insertSlot(context, slotName);
  }

  private async handleInsertProp(propName: string): Promise<void> {
    const context = this.currentContext;
    if (!context) {
      return;
    }
    await insertProp(context, propName);
  }
}

// =============================================================================
// Slot insertion
// =============================================================================

async function insertSlot(context: ComponentContext, slotName: string): Promise<void> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(context.documentUri);
  } catch {
    void vscode.window.showErrorMessage('Could not open the source file.');
    return;
  }

  const text = document.getText();
  const tagStart = context.tagOffset;
  const tagName = context.tagName;

  // Scan forward from the end of the tag name to find the closing `>` or `/>`
  let i = tagStart + 1 + tagName.length; // right after `<UCard`
  let inString: string | null = null;
  let selfClosing = false;
  let openTagEnd = -1;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === inString) {
        inString = null;
      }
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      selfClosing = true;
      openTagEnd = i + 2;
      break;
    } else if (ch === '>') {
      openTagEnd = i + 1;
      break;
    }
    i++;
  }

  if (openTagEnd === -1) {
    void vscode.window.showWarningMessage(`Could not parse the opening tag of <${tagName}>.`);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const tagLine = document.positionAt(tagStart).line;
  const indentation = getLineIndentation(document, tagLine);
  const slotIndent = indentation + '  ';

  if (selfClosing) {
    // Replace `/>` at the end of the opening tag with an expanded form that
    // includes the new slot.
    const slashGtPos = document.positionAt(openTagEnd - 2);
    const afterGtPos = document.positionAt(openTagEnd);
    const replacement =
      `>\n${slotIndent}<template #${slotName}>\n` + `${slotIndent}</template>\n` + `${indentation}</${tagName}>`;
    edit.replace(document.uri, new vscode.Range(slashGtPos, afterGtPos), replacement);
  } else {
    // Find the matching closing tag. We use a simple depth counter to handle
    // nested same-name components.
    const closingIdx = findMatchingClose(text, tagName, openTagEnd);
    if (closingIdx === -1) {
      void vscode.window.showWarningMessage(`Could not find the closing </${tagName}> tag.`);
      return;
    }

    const innerContent = text.slice(openTagEnd, closingIdx);

    // Check if the slot is already present.
    if (new RegExp(`#${slotName}\\b`).test(innerContent)) {
      void vscode.window.showInformationMessage(`Slot #${slotName} is already used in <${tagName}>.`);
      return;
    }

    // Insert the new slot template just before the closing tag.
    const insertPos = document.positionAt(closingIdx);
    const insertion = `${slotIndent}<template #${slotName}>\n` + `${slotIndent}</template>\n` + `${indentation}`;
    edit.insert(document.uri, insertPos, insertion);
  }

  await vscode.workspace.applyEdit(edit);
}

// =============================================================================
// Prop insertion
// =============================================================================

async function insertProp(context: ComponentContext, propName: string): Promise<void> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(context.documentUri);
  } catch {
    void vscode.window.showErrorMessage('Could not open the source file.');
    return;
  }

  const text = document.getText();
  const tagStart = context.tagOffset;
  const tagName = context.tagName;

  // Scan forward from the end of the tag name to find the closing `>` or `/>`
  let i = tagStart + 1 + tagName.length;
  let inString: string | null = null;
  let insertBeforeIdx = -1;
  let isSelfClosing = false;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      insertBeforeIdx = i;
      isSelfClosing = true;
      break;
    } else if (ch === '>') {
      insertBeforeIdx = i;
      break;
    }
    i++;
  }

  if (insertBeforeIdx === -1) {
    void vscode.window.showWarningMessage(`Could not parse the opening tag of <${tagName}>.`);
    return;
  }

  const attrName = toKebabCase(propName);
  const openTagText = text.slice(tagStart, insertBeforeIdx + (isSelfClosing ? 2 : 1));

  // Check if the prop is already present in the opening tag
  if (new RegExp(`\\b:?${attrName}\\s*=|v-bind:${attrName}\\s*=`).test(openTagText)) {
    void vscode.window.showInformationMessage(`Prop "${attrName}" is already set on <${tagName}>.`);
    return;
  }

  // Insert `:attr-name=""` just before the closing `>` or `/>`.
  // Respect the character preceding so we never double-space.
  const charBefore = insertBeforeIdx > 0 ? text[insertBeforeIdx - 1] : '';
  const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';
  const attrStr = `:${attrName}=""`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(insertBeforeIdx), `${prefix}${attrStr}`);
  await vscode.workspace.applyEdit(edit);
}

/**
 * Find the character index of the closing `</tagName>` that matches the
 * opening tag, starting the search from `fromIndex`.
 *
 * Handles nested same-name components by counting open/close pairs.
 */
function findMatchingClose(text: string, tagName: string, fromIndex: number): number {
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`<\\/${tagName}>`, 'g');

  openRe.lastIndex = fromIndex;
  closeRe.lastIndex = fromIndex;

  let depth = 0;

  // Walk both regexes in parallel, advancing whichever matches first.
  let nextOpen = openRe.exec(text);
  let nextClose = closeRe.exec(text);

  while (nextClose !== null) {
    const openIdx = nextOpen ? nextOpen.index : Infinity;
    const closeIdx = nextClose.index;

    if (openIdx < closeIdx) {
      depth++;
      nextOpen = openRe.exec(text);
    } else {
      if (depth === 0) {
        return closeIdx;
      }
      depth--;
      nextClose = closeRe.exec(text);
    }
  }

  return -1;
}

function getLineIndentation(document: vscode.TextDocument, line: number): string {
  const lineText = document.lineAt(line).text;
  return lineText.match(/^(\s*)/)?.[1] ?? '';
}

// =============================================================================
// HTML rendering
// =============================================================================

function homePath(version: 'v3' | 'v4'): string {
  return version === 'v4' ? '/docs/getting-started' : '/getting-started';
}

function componentPath(version: 'v3' | 'v4', slug: string): string {
  return version === 'v4' ? `/docs/components/${slug}` : `/components/${slug}`;
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function renderHtml(url: string, context: ComponentContext | undefined, slots: string[], props: string[]): string {
  const origin = new URL(url).origin;
  const csp = ["default-src 'none'", `frame-src ${origin}`, "style-src 'unsafe-inline'", "script-src 'unsafe-inline'"].join('; ');

  // Always show the props/slots sections when a component context is available.
  const propsSection = context !== undefined ? renderPropsSection(context.tagName, props) : '';
  const slotsSection = context !== undefined ? renderSlotsSection(context.tagName, slots) : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Nuxt UI Docs</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ---- Accordion shared ---- */
    .accordion {
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      flex-shrink: 0;
    }

    .accordion-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-editor-foreground));
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }

    .accordion-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .chevron {
      font-size: 9px;
      transition: transform 0.15s;
      display: inline-block;
      opacity: 0.7;
    }

    .accordion.is-open .chevron {
      transform: rotate(90deg);
    }

    .accordion-body {
      display: none;
    }

    .accordion.is-open .accordion-body {
      display: block;
    }

    /* ---- Slots section ---- */
    .slots-body {
      padding: 8px 12px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .slot-btn {
      background: var(--vscode-button-secondaryBackground, #3c3c3c);
      color: var(--vscode-button-secondaryForeground, #ccc);
      border: 1px solid transparent;
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.6;
      transition: background 0.1s;
    }

    .slot-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #505050);
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .slots-empty {
      font-size: 12px;
      opacity: 0.5;
      font-style: italic;
    }

    /* ---- Docs section ---- */
    .accordion.docs-accordion {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .accordion.docs-accordion.is-open .accordion-body {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .docs-body {
      flex: 1;
      overflow: hidden;
    }

    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="layout">
    ${propsSection}
    ${slotsSection}
    <div class="accordion docs-accordion is-open" id="docs-accordion">
      <div class="accordion-header" data-target="docs-accordion">
        <span class="chevron">▶</span>
        Documentation
      </div>
      <div class="accordion-body docs-body">
        <iframe src="${escapeAttr(url)}" allow="clipboard-read; clipboard-write"></iframe>
      </div>
    </div>
  </div>
  <script>
    // Accordion toggle
    document.querySelectorAll('.accordion-header').forEach(function(header) {
      header.addEventListener('click', function() {
        var targetId = header.dataset.target;
        var accordion = document.getElementById(targetId);
        if (accordion) {
          accordion.classList.toggle('is-open');
        }
      });
    });

    // Slot insertion
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('.slot-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertSlot', slotName: btn.dataset.slot });
      });
    });

    // Prop insertion
    document.querySelectorAll('.prop-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertProp', propName: btn.dataset.prop });
      });
    });
  </script>
</body>
</html>`;
}

function renderSlotsSection(tagName: string, slots: string[]): string {
  const body =
    slots.length > 0
      ? slots
          .map((slot) => `<button class="slot-btn" data-slot="${escapeAttr(slot)}">#${escapeHtml(slot)}</button>`)
          .join('\n        ')
      : // No declaration file found or component has no named slots.
        `<span class="slots-empty">No slots found for ${escapeHtml(tagName)}</span>`;

  return /* html */ `
    <div class="accordion is-open" id="slots-accordion">
      <div class="accordion-header" data-target="slots-accordion">
        <span class="chevron">▶</span>
        Slots — ${escapeHtml(tagName)}
      </div>
      <div class="accordion-body slots-body">
        ${body}
      </div>
    </div>`;
}

function renderPropsSection(tagName: string, props: string[]): string {
  const body =
    props.length > 0
      ? props
          .map((prop) => {
            const attr = toKebabCase(prop);
            return `<button class="prop-btn slot-btn" data-prop="${escapeAttr(prop)}">:${escapeHtml(attr)}</button>`;
          })
          .join('\n        ')
      : `<span class="slots-empty">No props found for ${escapeHtml(tagName)}</span>`;

  return /* html */ `
    <div class="accordion is-open" id="props-accordion">
      <div class="accordion-header" data-target="props-accordion">
        <span class="chevron">▶</span>
        Props — ${escapeHtml(tagName)}
      </div>
      <div class="accordion-body slots-body">
        ${body}
      </div>
    </div>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
