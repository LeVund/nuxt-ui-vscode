/**
 * Static list of Nuxt UI v4 component names (without the `U` prefix).
 *
 * This list is used for:
 *  - Fuzzy-matching component tags inside .vue files
 *  - Populating the "Open Component Docs..." QuickPick
 *  - Building documentation URLs
 *
 * If a component is missing, add it here. The list does not need to be
 * exhaustive for the extension to work — unknown `<U...>` tags are simply
 * ignored by the providers.
 */
export const NUXT_UI_COMPONENTS: readonly string[] = [
  // Elements
  'Accordion',
  'Alert',
  'Avatar',
  'AvatarGroup',
  'Badge',
  'Breadcrumb',
  'Button',
  'ButtonGroup',
  'Calendar',
  'Card',
  'Carousel',
  'Checkbox',
  'Chip',
  'Collapsible',
  'ColorPicker',
  'CommandPalette',
  'ContextMenu',
  'Drawer',
  'DropdownMenu',
  'Form',
  'FormField',
  'Input',
  'InputMenu',
  'InputNumber',
  'InputTags',
  'Kbd',
  'Link',
  'Modal',
  'NavigationMenu',
  'Pagination',
  'PinInput',
  'Popover',
  'Progress',
  'RadioGroup',
  'Select',
  'SelectMenu',
  'Separator',
  'Skeleton',
  'Slideover',
  'Slider',
  'Stepper',
  'Switch',
  'Table',
  'Tabs',
  'Textarea',
  'Toast',
  'Tooltip',
  'Tree',
  // Content
  'ContentSearch',
  'ContentSearchButton',
  'ContentSurround',
  'ContentToc',
  // Page
  'Page',
  'PageAccordion',
  'PageAnchors',
  'PageAside',
  'PageBody',
  'PageCard',
  'PageColumns',
  'PageCTA',
  'PageFeature',
  'PageGrid',
  'PageHeader',
  'PageHero',
  'PageLink',
  'PageLinks',
  'PageList',
  'PageLogos',
  'PageMarquee',
  'PageSection',
  // Dashboard
  'DashboardGroup',
  'DashboardNavbar',
  'DashboardPanel',
  'DashboardResizeHandle',
  'DashboardSearch',
  'DashboardSearchButton',
  'DashboardSidebar',
  'DashboardSidebarCollapse',
  'DashboardSidebarToggle',
  'DashboardToolbar',
];

/**
 * Component names as they appear in .vue templates (with the `U` prefix).
 * e.g. `UButton`, `UCommandPalette`.
 */
export const NUXT_UI_TAG_NAMES: readonly string[] = NUXT_UI_COMPONENTS.map(
  (name) => `U${name}`,
);

const TAG_SET = new Set(NUXT_UI_TAG_NAMES);

/**
 * Returns true if the given tag name is a known Nuxt UI component.
 */
export function isNuxtUiTag(tagName: string): boolean {
  return TAG_SET.has(tagName);
}

/**
 * Converts a PascalCase component name (without the `U` prefix) to the
 * kebab-case slug used in documentation URLs.
 *
 * `CommandPalette` → `command-palette`
 * `Button`         → `button`
 */
export function toKebabCase(componentName: string): string {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Converts a full tag name (e.g. `UButton`) to its kebab-case slug
 * (e.g. `button`). Returns `undefined` for non-Nuxt UI tags.
 */
export function tagToSlug(tagName: string): string | undefined {
  if (!isNuxtUiTag(tagName)) {
    return undefined;
  }
  return toKebabCase(tagName.slice(1));
}
