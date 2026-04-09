import * as vscode from 'vscode';
import { VersionService } from '../version';
import { tagToSlug } from '../components';

/**
 * Manages a single reusable webview panel that displays the Nuxt UI
 * documentation inside an iframe. A second call to `openComponent` or
 * `openHome` while a panel is already open reuses it and navigates.
 */
export class DocPanel {
  private static readonly VIEW_TYPE = 'nuxtUi.docs';
  private panel: vscode.WebviewPanel | undefined;
  private currentUrl: string | undefined;

  constructor(private readonly version: VersionService) {
    // When the version switches (e.g. user edits package.json),
    // refresh the currently displayed page so the URL origin updates.
    version.onDidChange(() => {
      if (this.panel && this.currentUrl) {
        const path = extractPath(this.currentUrl);
        const nextUrl = `${this.version.current.baseUrl}${path}`;
        this.navigate(nextUrl);
      }
    });
  }

  /**
   * Open or focus the documentation home page.
   */
  openHome(): void {
    const url = `${this.version.current.baseUrl}${homePath(this.version.current.version)}`;
    this.show('Nuxt UI — Docs', url);
  }

  /**
   * Open or focus the documentation page for a given component tag.
   * `tagName` must include the `U` prefix (e.g. `UButton`).
   */
  openComponent(tagName: string): void {
    const slug = tagToSlug(tagName);
    if (!slug) {
      void vscode.window.showWarningMessage(
        `"${tagName}" is not a known Nuxt UI component.`,
      );
      return;
    }
    const url = `${this.version.current.baseUrl}${componentPath(this.version.current.version, slug)}`;
    this.show(`Nuxt UI — ${tagName}`, url);
  }

  private show(title: string, url: string): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        DocPanel.VIEW_TYPE,
        title,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.currentUrl = undefined;
      });
    } else {
      this.panel.title = title;
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);
    }
    this.navigate(url);
  }

  private navigate(url: string): void {
    if (!this.panel) {
      return;
    }
    this.currentUrl = url;
    this.panel.webview.html = renderHtml(url);
  }
}

function homePath(version: 'v3' | 'v4'): string {
  return version === 'v4' ? '/docs/getting-started' : '/getting-started';
}

function componentPath(version: 'v3' | 'v4', slug: string): string {
  return version === 'v4'
    ? `/docs/components/${slug}`
    : `/components/${slug}`;
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

/**
 * Build the HTML for the webview. We inject a full-viewport iframe
 * pointing at the Nuxt UI docs URL. The CSP allows framing the target
 * origins explicitly.
 */
function renderHtml(url: string): string {
  const origin = new URL(url).origin;
  // A permissive CSP that only allows framing the two known doc origins.
  const csp = [
    "default-src 'none'",
    `frame-src ${origin}`,
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Nuxt UI Docs</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
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
  <iframe src="${escapeAttr(url)}" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
