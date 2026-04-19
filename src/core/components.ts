/**
 * Static list of Nuxt UI v4 component names (without the `U` prefix).
 *
 * This list is used for:
 *  - Fuzzy-matching component tags inside .vue files
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
export const NUXT_UI_TAG_NAMES: readonly string[] = NUXT_UI_COMPONENTS.map((name) => `U${name}`);

const TAG_SET = new Set(NUXT_UI_TAG_NAMES);

/**
 * Returns true if the given tag name is a known Nuxt UI component.
 * @deprecated should find the components from package.json
 */
export function isNuxtUiTag(tagName: string): boolean {
  return TAG_SET.has(tagName);
}
