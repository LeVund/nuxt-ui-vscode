import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { VersionService } from '../version/VersionService';
import { tagToSlug } from '../parsing/caseUtils';
import { detectUsed, parseAttributes, type AttributeKind, type UsedAttrs } from '../parsing/parseAttributes';
import { getParsedTag } from '../parsing/getParseTag';
import { renderHtml } from './html/renderHtml';
import { renderPlaceholder } from './html/renderPlaceholder';
import { componentPath } from './urls';
import { resolveComponentInfo } from './resolveComponentInfo';
import { insertSlot } from '../insertions/insertSlot';
import { insertProp } from '../insertions/insertProp';
import { insertUiKey } from '../insertions/insertUiKey';
import { insertEvent } from '../insertions/insertEvent';
import { insertVModel } from '../insertions/insertVModel';
import { removeAttribute } from '../insertions/removeAttribute';

const SYNC_DEBOUNCE_MS = 120;

export class DocPanel implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'nuxtUi.docView';
  private view: vscode.WebviewView | undefined;
  private _currentContext: ComponentTagFileContext | undefined;
  private version: VersionService;
  private _changeListener: vscode.Disposable | undefined;
  private _syncTimeout: ReturnType<typeof setTimeout> | undefined;

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
      async (message: {
        command: string;
        slotName: string;
        propName: string;
        eventName: string;
        keyName: string;
        kind?: AttributeKind;
        key?: string;
        value?: string;
        binding?: string;
      }) => {
        if (!message || typeof message !== 'object') return;
        if (!this._currentContext) return;

        if (message.command === 'insertSlot' && typeof message.slotName === 'string') {
          await insertSlot(this._currentContext, message.slotName, message.binding);
        } else if (message.command === 'insertProp' && typeof message.propName === 'string') {
          await insertProp(this._currentContext, message.propName, message.value);
        } else if (message.command === 'insertEvent' && typeof message.eventName === 'string') {
          await insertEvent(this._currentContext, message.eventName);
        } else if (message.command === 'insertVModel' && typeof message.propName === 'string') {
          await insertVModel(this._currentContext, message.propName);
        } else if (message.command === 'insertUiKey' && typeof message.keyName === 'string') {
          await insertUiKey(this._currentContext, message.keyName);
        } else if (
          message.command === 'removeAttr' &&
          (message.kind === 'prop' || message.kind === 'event' || message.kind === 'vmodel') &&
          typeof message.key === 'string'
        ) {
          await removeAttribute(this._currentContext, message.kind, message.key);
        }
      },
    );

    webviewView.onDidDispose(() => {
      this.disposeListeners();
    });

    if (this._currentContext) this.updatePanel();
    else webviewView.webview.html = renderPlaceholder();
  }

  async openComponent(context: ComponentTagFileContext): Promise<void> {
    this._currentContext = context;
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
    const { slots, props, events, vModels, uiKeys } = await resolveComponentInfo(this.currentContext);

    const { tagName } = this.currentContext;
    const used = this.computeUsedSync();

    this.view.title = `Nuxt UI — ${tagName}`;
    this.view.webview.html = renderHtml(nuxtUiWebSiteUrl, tagName, slots, props, events, vModels, uiKeys, used);

    this.setupChangeListener();
  }

  private setupChangeListener(): void {
    this.disposeListeners();
    if (!this._currentContext) return;

    const watchedUri = this._currentContext.documentUri.toString();
    this._changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (!this._currentContext) return;
      if (event.document.uri.toString() !== watchedUri) return;
      if (event.contentChanges.length === 0) return;

      for (const change of event.contentChanges) {
        const ctx = this._currentContext;
        if (!ctx) break;
        const changeEnd = change.rangeOffset + change.rangeLength;
        if (changeEnd <= ctx.tagOffset) {
          ctx.tagOffset += change.text.length - change.rangeLength;
        }
      }
      this.scheduleSync();
    });
  }

  private scheduleSync(): void {
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      this._syncTimeout = undefined;
      void this.syncUsed();
    }, SYNC_DEBOUNCE_MS);
  }

  private async syncUsed(): Promise<void> {
    if (!this.view || !this._currentContext) return;
    const used = this.computeUsedSync();
    if (!used) return;
    this.view.webview.postMessage({
      command: 'syncUsed',
      used: {
        props: Array.from(used.props),
        events: Array.from(used.events),
        vModels: Array.from(used.vModels),
      },
    });
  }

  private computeUsedSync(): UsedAttrs {
    const empty: UsedAttrs = { props: new Set(), events: new Set(), vModels: new Set() };
    if (!this._currentContext) return empty;

    const { documentUri, tagOffset, tagName } = this._currentContext;
    const document = vscode.workspace.textDocuments.find((d) => d.uri.toString() === documentUri.toString());
    if (!document) return empty;

    const text = document.getText();
    const expectedPrefix = `<${tagName}`;
    if (text.slice(tagOffset, tagOffset + expectedPrefix.length) !== expectedPrefix) return empty;

    const tag = getParsedTag(text, tagOffset, tagName);
    if (!tag) return empty;

    const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));
    return detectUsed(parseAttributes(openTagText, tagName));
  }

  private disposeListeners(): void {
    this._changeListener?.dispose();
    this._changeListener = undefined;
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
      this._syncTimeout = undefined;
    }
  }
}
