import * as vscode from 'vscode';
import type { ComponentInfo, ComponentTagFileContext } from '../core/types';
import { toKebabCase } from '../parsing/caseUtils';
import { Commands } from '../commands/commandIds.enum';

type ItemCategory = 'props' | 'slots' | 'uiKeys';

class ComponentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly category: ItemCategory,
    public readonly value: string,
    context: ComponentTagFileContext,
  ) {
    const label = formatLabel(category, value);
    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = category;
    this.iconPath = new vscode.ThemeIcon(categoryIcon(category));
    this.command = {
      title: 'Insert',
      command: categoryCommand(category),
      arguments: [context, value],
    };
  }
}

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly category: ItemCategory,
    private readonly count: number,
  ) {
    super(categoryLabel(category), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `category:${category}`;
    this.iconPath = new vscode.ThemeIcon(categoryIcon(category));
    this.description = `${count}`;
  }
}

export class ComponentTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private context: ComponentTagFileContext | undefined;
  private info: ComponentInfo = { slots: [], props: [], uiKeys: [] };

  update(context: ComponentTagFileContext, info: ComponentInfo): void {
    this.context = context;
    this.info = info;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!this.context) return [];

    // Root level: show the 3 categories
    if (!element) {
      return (['props', 'slots', 'uiKeys'] as const).map(
        (cat) => new CategoryItem(cat, this.info[cat].length),
      );
    }

    // Children of a category
    if (element instanceof CategoryItem) {
      const values = this.info[element.category];
      return values.map((v) => new ComponentTreeItem(element.category, v, this.context!));
    }

    return [];
  }
}

function formatLabel(category: ItemCategory, value: string): string {
  switch (category) {
    case 'props':
      return `:${toKebabCase(value)}`;
    case 'slots':
      return `#${value}`;
    case 'uiKeys':
      return value;
  }
}

function categoryLabel(category: ItemCategory): string {
  switch (category) {
    case 'props':
      return 'Props';
    case 'slots':
      return 'Slots';
    case 'uiKeys':
      return 'UI Keys';
  }
}

function categoryIcon(category: ItemCategory): string {
  switch (category) {
    case 'props':
      return 'symbol-property';
    case 'slots':
      return 'symbol-snippet';
    case 'uiKeys':
      return 'paintcan';
  }
}

function categoryCommand(category: ItemCategory): string {
  switch (category) {
    case 'props':
      return Commands.InsertProp;
    case 'slots':
      return Commands.InsertSlot;
    case 'uiKeys':
      return Commands.InsertUiKey;
  }
}
