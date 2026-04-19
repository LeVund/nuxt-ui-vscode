import * as vscode from 'vscode';
import { escapeAttr } from '../webview/html/escape';

export class DocWebviewProvider implements vscode.WebviewViewProvider {
  static readonly VIEW_ID = 'nuxtUi.docWebview';

  private view: vscode.WebviewView | undefined;
  private currentUrl: string | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    if (this.currentUrl) {
      this.renderIframe(this.currentUrl);
    }
  }

  update(url: string): void {
    this.currentUrl = url;
    if (this.view) {
      this.renderIframe(url);
      this.view.show?.(true);
    }
  }

  private renderIframe(url: string): void {
    if (!this.view) return;

    const origin = new URL(url).origin;
    const csp = [`default-src 'none'`, `frame-src ${origin}`, `style-src 'unsafe-inline'`].join('; ');

    this.view.webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe src="${escapeAttr(url)}" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`;
  }
}
