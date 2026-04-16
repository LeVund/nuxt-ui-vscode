import * as vscode from 'vscode';
import { VersionService } from '../version';
import { tagToSlug } from '../utils/syntaxUtils';
import { readComponentInfo, resolveDeclarationPath } from '../utils/typeFileResolver';
import { renderHtml, componentPath, extractPath } from './html';
import { insertSlot, insertProp, insertUiKey } from '../editor-actions/InsertInComponents';

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
