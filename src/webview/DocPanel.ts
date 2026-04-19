import type { ComponentTagFileContext } from '../core/types';
import { VersionService } from '../version/VersionService';
import { tagToSlug } from '../parsing/caseUtils';
import { componentPath } from './urls';
import { resolveComponentInfo } from './resolveComponentInfo';
import { ComponentTreeProvider } from '../views/ComponentTreeProvider';
import { DocWebviewProvider } from '../views/DocWebviewProvider';

export class DocPanel {
  readonly treeProvider = new ComponentTreeProvider();
  readonly docWebviewProvider = new DocWebviewProvider();

  private _currentContext: ComponentTagFileContext | undefined;
  private version: VersionService;

  get currentContext(): ComponentTagFileContext | undefined {
    return this._currentContext;
  }

  constructor(version: VersionService) {
    this.version = version;
  }

  async openComponent(context: ComponentTagFileContext): Promise<void> {
    this._currentContext = context;

    const info = await resolveComponentInfo(context);
    this.treeProvider.update(context, info);

    const url = `${this.version.current.baseUrl}${componentPath(this.version.current.version, tagToSlug(context.tagName))}`;
    this.docWebviewProvider.update(url);
  }
}
