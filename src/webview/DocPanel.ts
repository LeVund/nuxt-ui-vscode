import * as vscode from 'vscode';
import type { ComponentContext, ComponentInfo } from '../core/types';
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
  private currentUrl: string | undefined;
  private currentContext: ComponentContext | undefined;
  private version: VersionService;

  constructor(version: VersionService) {
    this.version = version;
  }

  async openComponent(tagName: string, context?: ComponentContext): Promise<void> {
    if (!context) {
      void vscode.window.showWarningMessage(`No file context provided while fetching for "${tagName}".`);
      void vscode.window.showWarningMessage(
        `The feature to get component information without file context is not implemented yet.`,
      );
      return;
    }

    this.currentContext = context;
    const slug = tagToSlug(tagName);

    if (!slug) {
      void vscode.window.showWarningMessage(`"${tagName}" is not a known Nuxt UI component.`);
      return;
    }

    const nuxtUiWebSiteUrl = `${this.version.current.baseUrl}${componentPath(this.version.current.version, slug)}`;
    const interactiveProperties = context ? await resolveComponentInfo(context) : { slots: [], props: [], uiKeys: [] };
    const title = context ? `Nuxt UI — ${tagName}` : 'Nuxt UI — Component';

    if (!this.panel) this.initPanel(title);
    this.updatePanel(title, nuxtUiWebSiteUrl, interactiveProperties);
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

  private updatePanel(title: string, nuxtUiWebSiteUrl: string, { slots, props, uiKeys }: ComponentInfo): void {
    if (!this.panel || !this.currentContext) return;
    const { tagName } = this.currentContext!;

    this.panel.title = title;
    this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);

    this.currentUrl = nuxtUiWebSiteUrl;
    this.panel.webview.html = renderHtml(nuxtUiWebSiteUrl, tagName, slots, props, uiKeys);
  }
}
