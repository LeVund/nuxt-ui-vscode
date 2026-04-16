/**
 * Resolves the `.vue.d.ts` declaration file path from a path returned by
 * `vscode.executeTypeDefinitionProvider`. Volar typically points to the `.vue`
 * source file; the adjacent `.vue.d.ts` holds the type declarations.
 *
 * Returns `undefined` when the input path cannot be mapped to a `.vue.d.ts`.
 */
export function resolveDeclarationPath(definitionFsPath: string): string | undefined {
  if (definitionFsPath.endsWith('.d.vue.ts')) {
    return definitionFsPath;
  }
  if (definitionFsPath.endsWith('.vue')) {
    return `${definitionFsPath}.d.ts`;
  }
  return undefined;
}
