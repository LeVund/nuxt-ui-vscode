export { NUXT_UI_COMPONENTS, NUXT_UI_TAG_NAMES, isNuxtUiTag } from '../core/components';
import { isNuxtUiTag } from '../core/components';

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
