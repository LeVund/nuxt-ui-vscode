# Plan d'intégration — Refactor structurel

> **⚠️ AUCUNE MODIFICATION FONCTIONNELLE.**
>
> Ce refactor est **strictement organisationnel**. La logique métier, les comportements,
> les messages, les conditions, les regex, les API VS Code appelées, les signatures
> publiques exposées et les **types existants** sont **préservés à l'identique**.
>
> On se contente de :
>
> - **déplacer** des fonctions vers de nouveaux fichiers,
> - **renommer** des fichiers et dossiers pour unifier les conventions,
> - **éclater** des grosses fonctions en sous-fonctions privées (même module),
> - **centraliser** les types existants (sans les modifier).
>
> Toute optimisation, refactor logique, changement de signature publique, ajout
> d'erreur ou modification de message **est hors scope** et doit faire l'objet
> d'un autre passage.

---

## Règles d'or pour chaque étape

1. **Aucun changement de comportement observable.** Si l'on hésite, on garde tel quel.
2. **Les types existants sont déplacés, jamais modifiés.** Pas d'ajout/retrait de
   champs, pas de changement de noms de propriétés.
3. **Les signatures publiques (fonctions exportées) restent identiques** : même
   nom, mêmes paramètres, même retour. Seul le chemin d'import change.
4. **Les sous-fonctions extraites sont privées au module** (non exportées) sauf si
   réutilisées ailleurs.
5. **Une étape = un commit** vérifiable individuellement (`bun run compile` doit passer).
6. **`bun run compile` passe à la fin de chaque étape**, jamais d'étape laissée
   en état rouge.

---

## Étape 1 — Nettoyage du code mort

> Aucun déplacement. On supprime uniquement ce qui est inutilisé.

- [ ] Supprimer `src/file-scanners/GetComponent.ts` (fichier ne contenant qu'un import inutilisé).
- [ ] Supprimer `src/utils/getTagContext.ts` (duplique `getTagContext` déjà exporté par `tagUtils.ts`, et la version locale n'est même pas exportée).
- [ ] Dans `src/commands/componentMenu.ts` : supprimer le tableau `items` mort (jamais passé à `showQuickPick`).
- [ ] Dans `src/extension.ts` : retirer le commentaire `// panel.openHome();` du handler `Commands.OpenHome` (le handler reste un no-op — comportement actuel préservé).
- [ ] Retirer l'import inutilisé `isNuxtUiTag` dans `src/file-scanners/scanner.ts`.
- [ ] Retirer l'import inutilisé `extractPath` dans `src/webview/panel.ts`.
- [ ] Supprimer la fonction `homePath` dans `src/webview/html.ts` si elle n'est référencée nulle part (vérifier d'abord).

**Vérif** : `bun run compile` OK, comportement identique.

---

## Étape 2 — Centralisation des types existants

> On déplace les types **sans les modifier**. Les définitions sont identiques au caractère près.

Créer `src/core/types.ts` qui ré-exporte/contient :

| Type               | Origine actuelle                              | Destination         |
| ------------------ | --------------------------------------------- | ------------------- |
| `ComponentContext` | `src/webview/panel.ts`                        | `src/core/types.ts` |
| `ComponentMatch`   | `src/file-scanners/FileScanners.interface.ts` | `src/core/types.ts` |
| `ComponentInfo`    | `src/utils/typeFileResolver.ts`               | `src/core/types.ts` |
| `ParsedTag`        | `src/utils/tagUtils.ts`                       | `src/core/types.ts` |
| `NuxtUiVersion`    | `src/version.ts`                              | `src/core/types.ts` |
| `VersionInfo`      | `src/version.ts`                              | `src/core/types.ts` |

**Actions** :

- [ ] Créer `src/core/types.ts` avec les types ci-dessus, copiés à l'identique.
- [ ] Mettre à jour les imports dans tous les consommateurs.
- [ ] Supprimer les définitions originales dans leurs fichiers d'origine.
- [ ] Supprimer `src/file-scanners/FileScanners.interface.ts` (vide après migration).

**Vérif** : `bun run compile` OK, aucune modification d'attribut ni de nom de type.

---

## Étape 3 — Restructuration des dossiers et fichiers

> Déplacements + renommages uniquement. Le contenu des fonctions n'est pas touché.

### Cible

```
src/
├── extension.ts                  # activate() seulement
├── activation/
│   ├── registerCommands.ts       # extrait depuis extension.ts (déplacement, pas de logique nouvelle)
│   └── registerProviders.ts      # extrait depuis extension.ts
│
├── core/
│   ├── types.ts                  # (créé en étape 2)
│   └── components.ts             # NUXT_UI_COMPONENTS, NUXT_UI_TAG_NAMES, isNuxtUiTag
│
├── version/
│   ├── VersionService.ts         # la classe seule
│   ├── detectFromPackageJson.ts  # méthode privée déplacée
│   └── parseMajor.ts             # fonction déplacée
│
├── parsing/                      # parsing pur, sans VS Code
│   ├── caseUtils.ts              # toKebabCase, tagToSlug
│   ├── parseTag.ts               # getParsedTag
│   ├── findMatchingClose.ts
│   └── scanComponents.ts
│
├── editor/                       # wrappers VS Code (I/O)
│   ├── getTagContext.ts          # ouverture document + parseTag (déplacé depuis tagUtils.ts)
│   ├── findComponentAt.ts        # ex-scanner.ts
│   └── indentation.ts            # getLineIndentation
│
├── insertions/                   # 1 fichier par insertion
│   ├── insertSlot.ts
│   ├── insertProp.ts
│   └── insertUiKey.ts
│
├── typeInfo/                     # ex-typeFileResolver
│   ├── resolveDeclarationPath.ts
│   ├── readComponentInfo.ts
│   └── resolveUiKeys.ts
│
├── providers/
│   ├── HoverProvider.ts          # ex hover.ts
│   └── InlayHintsProvider.ts     # ex InlayHints.ts (déplacé depuis inlay-hints/)
│
├── commands/
│   ├── commandIds.ts             # suffixe .enum retiré
│   ├── pickAndOpenComponent.ts   # ex openComponent.ts
│   └── showComponentMenu.ts      # ex componentMenu.ts
│
└── webview/
    ├── DocPanel.ts               # la classe seule (renommé depuis panel.ts)
    ├── resolveComponentInfo.ts   # extrait depuis panel.ts
    ├── urls.ts                   # componentPath, extractPath
    └── html/
        ├── renderHtml.ts         # composition uniquement
        ├── renderSection.ts
        ├── escape.ts             # escapeAttr, escapeHtml
        ├── styles.ts             # CSS exporté en const string
        └── webviewScript.ts      # JS du webview exporté en const string
```

### Convention de nommage appliquée

- **Dossiers** en `kebab-case` ou en mot simple. Pas de mélange.
- **Fichiers** en `camelCase`, sauf si le fichier exporte une **classe**, auquel cas le fichier prend le nom **PascalCase** de la classe (`DocPanel.ts`, `VersionService.ts`).
- **Pas de suffixes** `.enum.ts` / `.interface.ts`.
- **Un export public principal par fichier**, fichier nommé d'après cet export.

### Plan de déplacement (table de correspondance)

| Avant                                         | Après                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/version.ts`                              | `src/version/VersionService.ts` + helpers                                                                             |
| `src/utils/syntaxUtils.ts`                    | éclaté → `core/components.ts` + `parsing/caseUtils.ts`                                                                |
| `src/utils/tagUtils.ts`                       | éclaté → `parsing/parseTag.ts` + `parsing/findMatchingClose.ts` + `editor/indentation.ts` + `editor/getTagContext.ts` |
| `src/utils/typeFileResolver.ts`               | éclaté → `typeInfo/resolveDeclarationPath.ts` + `typeInfo/readComponentInfo.ts` + `typeInfo/resolveUiKeys.ts`         |
| `src/file-scanners/ScanComponents.ts`         | `src/parsing/scanComponents.ts`                                                                                       |
| `src/file-scanners/scanner.ts`                | `src/editor/findComponentAt.ts`                                                                                       |
| `src/file-scanners/FileScanners.interface.ts` | supprimé (étape 2)                                                                                                    |
| `src/inlay-hints/InlayHints.ts`               | `src/providers/InlayHintsProvider.ts`                                                                                 |
| `src/providers/hover.ts`                      | `src/providers/HoverProvider.ts`                                                                                      |
| `src/commands/commandIds.enum.ts`             | `src/commands/commandIds.ts`                                                                                          |
| `src/commands/openComponent.ts`               | `src/commands/pickAndOpenComponent.ts`                                                                                |
| `src/commands/componentMenu.ts`               | `src/commands/showComponentMenu.ts`                                                                                   |
| `src/editor-actions/InsertInComponents.ts`    | éclaté → `insertions/insertSlot.ts` + `insertProp.ts` + `insertUiKey.ts`                                              |
| `src/webview/panel.ts`                        | éclaté → `webview/DocPanel.ts` + `webview/resolveComponentInfo.ts`                                                    |
| `src/webview/html.ts`                         | éclaté → `webview/urls.ts` + `webview/html/*`                                                                         |

### Procédure recommandée

Pour chaque ligne du tableau, dans cet ordre :

1. Créer le nouveau fichier avec le contenu copié (pas modifié).
2. Mettre à jour tous les imports des consommateurs.
3. Supprimer le fichier d'origine.
4. `bun run compile` doit passer.
5. Commit unitaire.

**Recommandation** : avancer par couches, du moins couplé au plus couplé :

1. `core/` (types + components)
2. `parsing/` (purs)
3. `editor/` (wrappers VS Code)
4. `typeInfo/`
5. `version/`
6. `providers/`
7. `commands/`
8. `insertions/`
9. `webview/`
10. `activation/` + `extension.ts`

---

## Étape 4 — Éclatement des grosses fonctions

> Les fonctions publiques exportées **gardent leur signature et leur comportement**.
> On extrait des **sous-fonctions privées** (non exportées) au sein du même module
> pour améliorer la lisibilité. **Aucune nouvelle abstraction publique.**

### `renderHtml` — `webview/html/renderHtml.ts`

Extraction sans changement visuel :

- [ ] Déplacer la grande string CSS dans `webview/html/styles.ts` comme `export const STYLES = ...`.
- [ ] Déplacer le bloc `<script>` dans `webview/html/webviewScript.ts` comme `export const WEBVIEW_SCRIPT = ...`.
- [ ] Déplacer `escapeAttr` / `escapeHtml` dans `webview/html/escape.ts`.
- [ ] Déplacer `renderSection` dans `webview/html/renderSection.ts`.
- [ ] `renderHtml` ne fait plus que la composition.

### `insertSlot` — `insertions/insertSlot.ts`

- [ ] Extraire `buildSelfClosingSlotEdit(...)` (privée, branche `tag.selfClosing === true`).
- [ ] Extraire `buildPairedSlotEdit(...)` (privée, branche `else`).
- [ ] La fonction publique `insertSlot` orchestre uniquement.

### `insertUiKey` — `insertions/insertUiKey.ts`

- [ ] Extraire `findUiAttribute(text, tagOffset)` (privée).
- [ ] Extraire `parseUiObject(text, attrValueStart, quoteChar)` (privée).
- [ ] Extraire `buildNewUiAttributeEdit(...)` (cas pas de `:ui` existant).
- [ ] Extraire `buildAppendKeyEdit(...)` (cas `:ui` existant).
- [ ] La fonction publique `insertUiKey` orchestre uniquement.

### `insertProp` — `insertions/insertProp.ts`

Suffisamment petit, **aucun éclatement** nécessaire (juste déplacé).

### `activate` — `extension.ts`

- [ ] Extraire `registerProviders(context, panel, version)` dans `activation/registerProviders.ts`.
- [ ] Extraire `registerCommands(context, panel)` dans `activation/registerCommands.ts`.
- [ ] `activate` ne fait plus qu'instancier les services et déléguer.

### `detectFromPackageJson` — `version/detectFromPackageJson.ts`

- [ ] Extraire `readPackageJson(folderUri)` (privée).
- [ ] Extraire `detectVersionFromDeps(pkg)` (privée).
- [ ] La fonction publique orchestre.

### `readComponentInfo` — `typeInfo/readComponentInfo.ts`

- [ ] Extraire `loadDocumentSymbols(uri)` (privée, encapsule les deux try/catch).
- [ ] Le reste reste tel quel.

---

## Étape 5 — Vérification finale

- [ ] `bun run compile` passe.
- [ ] Lancer manuellement l'extension dans VS Code et vérifier :
  - [ ] Inlay hints `⚡` apparaissent sur les `<UButton>` etc.
  - [ ] Le hover fonctionne et propose les liens.
  - [ ] Le clic sur l'inlay hint ouvre le panneau et le panneau affiche bien props/slots/UI keys.
  - [ ] L'insertion de slot/prop/UI key écrit bien dans le fichier source.
  - [ ] `nuxtUiHelper.openComponent` (palette) propose bien la liste.
  - [ ] Le changement de version (`nuxtUi.version` setting ou `package.json`) re-render le panneau.
- [ ] Mettre à jour `ARCHITECTURE.md` pour refléter la nouvelle arborescence.

---

## Hors scope (à faire dans un autre passage)

- Détection dynamique des composants via `package.json` (le `@deprecated` sur `isNuxtUiTag` reste, comportement inchangé).
- Implémentation de `Commands.OpenHome` (reste un no-op).
- Ajout de tests unitaires.
- Refactor de la gestion d'erreurs ou des messages utilisateur.
- Optimisation des regex ou du scan de document.
