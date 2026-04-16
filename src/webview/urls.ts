export function componentPath(version: 'v3' | 'v4', slug: string): string {
  return version === 'v4' ? `/docs/components/${slug}` : `/components/${slug}`;
}
