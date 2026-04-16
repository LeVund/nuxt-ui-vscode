/**
 * Extract the major version from a semver range string.
 * Handles `^4.0.0`, `~4.1.2`, `4.x`, `>=4.0.0 <5.0.0`, `npm:@nuxt/ui@4.0.0`, etc.
 */
export function parseMajor(range: string): number | undefined {
  const match = range.match(/(\d+)/);
  if (!match) {
    return undefined;
  }
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : undefined;
}
