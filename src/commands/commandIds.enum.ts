/**
 * All VS Code command identifiers contributed or consumed by this extension.
 */
export enum Commands {
  /** Opens a component doc panel from a CodeLens click. */
  OpenDocPanel = 'nuxtUiHelper.openDocPanel',
  /** Insert a slot template into the component tag. */
  InsertSlot = 'nuxtUiHelper.insertSlot',
  /** Insert a prop attribute into the component tag. */
  InsertProp = 'nuxtUiHelper.insertProp',
  /** Insert a UI key into the component's :ui object. */
  InsertUiKey = 'nuxtUiHelper.insertUiKey',
}
