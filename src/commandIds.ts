/**
 * All VS Code command identifiers contributed or consumed by this extension.
 * Using this enum avoids scattering raw strings across the codebase.
 */
export enum Commands {
  /** Opens the extension home panel (command palette). */
  OpenHome = 'nuxtUiHelper.openHome',
  /** Opens a component picker (command palette). */
  OpenComponent = 'nuxtUiHelper.openComponent',
  /** Shows the component action menu (inlay hint / hover / code lens). */
  ShowComponentMenu = 'nuxtUiHelper.showComponentMenu',
  /** Opens a component doc panel by tag name (internal — not in palette). */
  OpenComponentByName = 'nuxtUi.openComponentByName',
}
