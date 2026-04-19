import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { VersionService } from '../version/VersionService';
import { tagToSlug } from '../parsing/caseUtils';
import { renderHtml } from './html/renderHtml';
import { renderPlaceholder } from './html/renderPlaceholder';
import { componentPath } from './urls';
import { resolveComponentInfo } from './resolveComponentInfo';
import { insertSlot } from '../insertions/insertSlot';
import { insertProp } from '../insertions/insertProp';
import { insertUiKey } from '../insertions/insertUiKey';

export class DocPanel implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'nuxtUi.docView';
  private view: vscode.WebviewView | undefined;
  private _currentContext: ComponentTagFileContext | undefined;
  private version: VersionService;

  private get currentContext(): ComponentTagFileContext {
    if (!this._currentContext) {
      throw new Error('No current context set for DocPanel.');
    }
    return this._currentContext;
  }

  constructor(version: VersionService) {
    this.version = version;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(
      async (message: { command: string; slotName: string; propName: string; keyName: string }) => {
        if (!message || typeof message !== 'object') return;
        if (!this._currentContext) return;

        if (message.command === 'insertSlot' && typeof message.slotName === 'string') {
          await insertSlot(this._currentContext, message.slotName);
        } else if (message.command === 'insertProp' && typeof message.propName === 'string') {
          await insertProp(this._currentContext, message.propName);
        } else if (message.command === 'insertUiKey' && typeof message.keyName === 'string') {
          await insertUiKey(this._currentContext, message.keyName);
        }
      },
    );

    // If a component was already requested before the view was ready, render it now
    if (this._currentContext) this.updatePanel();
    else webviewView.webview.html = renderPlaceholder();
  }

  async openComponent(context: ComponentTagFileContext): Promise<void> {
    this._currentContext = context;

    // Reveal the sidebar view
    await vscode.commands.executeCommand(`${DocPanel.VIEW_ID}.focus`);

    if (this.view) {
      this.updatePanel();
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async updatePanel(): Promise<void> {
    if (!this.view) return;

    const nuxtUiWebSiteUrl = `${this.version.current.baseUrl}${componentPath(this.version.current.version, tagToSlug(this.currentContext.tagName))}`;
    const { slots, props, uiKeys } = await resolveComponentInfo(this.currentContext);

    const { tagName } = this.currentContext;

    this.view.title = `Nuxt UI — ${tagName}`;
    this.view.webview.html = renderHtml(nuxtUiWebSiteUrl, tagName, slots, props, uiKeys);
  }
}
