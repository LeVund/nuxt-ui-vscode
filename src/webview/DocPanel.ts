import * as vscode from 'vscode';
import type { ComponentTagFileContext, ComponentInfo } from '../core/types';
import { VersionService } from '../version/VersionService';
import { tagToSlug } from '../parsing/caseUtils';
import { renderHtml } from './html/renderHtml';
import { componentPath } from './urls';
import { resolveComponentInfo } from './resolveComponentInfo';
import { insertSlot } from '../insertions/insertSlot';
import { insertProp } from '../insertions/insertProp';
import { insertUiKey } from '../insertions/insertUiKey';

export class DocPanel {
  private static readonly VIEW_TYPE = 'nuxtUi.docs';
  private panel: vscode.WebviewPanel | undefined;
  private _currentContext: ComponentTagFileContext | undefined;
  private version: VersionService;

  private get currentContext(): ComponentTagFileContext {
    if (!this._currentContext) {
      throw new Error('No current context set for DocPanel.');
    }
    return this._currentContext;
  }
  private get title() {
    return `Nuxt UI — ${this.currentContext.tagName}`;
  }
  constructor(version: VersionService) {
    this.version = version;
  }

  async openComponent(context: ComponentTagFileContext): Promise<void> {
    this._currentContext = context;

    if (!this.panel) this.initPanel();
    this.updatePanel();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private initPanel(): void {
    if (!this.panel) {
      const title = `Nuxt UI — ${this.currentContext.tagName}`;

      this.panel = vscode.window.createWebviewPanel(DocPanel.VIEW_TYPE, title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });

      // Handle insert commands sent from the webview (slot, prop, ui key)
      this.panel.webview.onDidReceiveMessage(
        async (message: { command: string; slotName: string; propName: string; keyName: string }) => {
          if (!message || typeof message !== 'object') return;

          if (!this.currentContext) return;

          if (message.command === 'insertSlot' && typeof message.slotName === 'string') {
            await insertSlot(this.currentContext, message.slotName);
          } else if (message.command === 'insertProp' && typeof message.propName === 'string') {
            await insertProp(this.currentContext, message.propName);
          } else if (message.command === 'insertUiKey' && typeof message.keyName === 'string') {
            await insertUiKey(this.currentContext, message.keyName);
          }
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this._currentContext = undefined;
      });
    }
  }

  private async updatePanel(): Promise<void> {
    if (!this.panel) {
      throw new Error('Panel not initialized');
    }

    const nuxtUiWebSiteUrl = `${this.version.current.baseUrl}${componentPath(this.version.current.version, tagToSlug(this.currentContext.tagName))}`;
    const { slots, props, uiKeys } = await resolveComponentInfo(this.currentContext);

    const { tagName } = this.currentContext!;

    this.panel.title = this.title;
    this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);

    this.panel.webview.html = renderHtml(nuxtUiWebSiteUrl, tagName, slots, props, uiKeys);
  }
}
