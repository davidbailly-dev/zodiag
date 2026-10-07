# Zodiag

Visualiser des schémas [Zod](https://zod.dev) sous forme de diagrammes.

Pointe Zodiag vers un fichier ou un dossier de schémas (`order.ts`, `shop.ts`, `orderLine.ts`, ...) et
il construit un graphe de tes schémas, de leurs champs et des relations entre eux, affiché dans un
viewer web local ou exporté en [Mermaid](https://mermaid.js.org).

> **Statut : en cours de développement.** L'extraction des schémas, le viewer interactif et l'export
> Mermaid sont disponibles en ligne de commande. Les fonctionnalités marquées *prévu* ne sont pas
> implémentées.

## Prérequis

- Node.js >= 20.11
- Zod `^4.0.0` dans le projet analysé (développé avec la 4.6.4)

## Démarrage

```bash
npm install
npm run build
node dist/presentation/cli/main.js ./chemin/vers/schemas
```

Pour avoir la commande `zodiag` dans ton PATH pendant le développement, lance `npm link` après le
build.

`npm pack` construit le projet et produit une archive installable (`zodiag-<version>.tgz`) qui contient
le CLI et le viewer ; son installation donne la commande `zodiag`. Les versions sont décrites dans le
[changelog](CHANGELOG.md).

## Utilisation

```bash
# Ouvrir le viewer interactif pour un dossier de schémas (ou un seul fichier)
zodiag ./src/schemas

# Afficher un erDiagram Mermaid à la place
zodiag ./src/schemas --format mermaid

# Écrire le diagramme Mermaid dans un fichier (les dossiers manquants sont créés)
zodiag ./src/schemas --format mermaid --output docs/schemas.mmd
```

| Option                    | Description                                                                      |
|---------------------------|----------------------------------------------------------------------------------|
| `-f, --format <format>`   | `viewer` (par défaut) ou `mermaid`                                               |
| `-o, --output <file>`     | Écrit un format texte dans un fichier au lieu de la sortie standard (pas pour le viewer) |
| `-p, --port <port>`       | Port du viewer. Par défaut : le premier port libre à partir de 4000              |
| `--no-open`               | N'ouvre pas le viewer dans le navigateur                                         |
| `--no-inferred-relations` | Ne relie pas les champs comme `shopId` au schéma `Shop`                          |
| `--no-watch`              | Ne recharge pas le viewer quand les fichiers de schémas changent                 |

Les avertissements (fichiers qui échouent au chargement) vont sur la sortie d'erreur, ce qui garde la
sortie standard sous forme de diagramme valide. La commande se termine en erreur si la cible n'existe
pas ou ne contient aucun schéma.

### Viewer

`zodiag <cible>` démarre un petit serveur web sur `127.0.0.1` (jamais exposé sur le réseau), affiche
son adresse et l'ouvre dans ton navigateur. Arrête-le avec `Ctrl+C`.

- Chaque schéma objet est une carte listant ses champs, leurs types, `?` pour les champs optionnels
  et leurs contraintes. Les champs enum sont affichés en orange : survole-en un pour voir ses valeurs.
- Les relations sont des flèches partant du champ qui les porte, étiquetées avec leur multiplicité
  (`1`, `0..1`, `0..*`). Les flèches en pointillé sont des [relations inférées](#relations-inférées) ;
  une case à cocher dans la barre latérale permet de les afficher ou de les masquer.
- Clique sur un schéma pour mettre ses liens en évidence et estomper le reste ; clique sur le fond
  pour réinitialiser.
- Les cartes se replient avec la flèche de leur en-tête (les liens partent alors de l'en-tête), ou
  toutes d'un coup depuis la barre latérale. Au-delà de 10 schémas, les cartes démarrent repliées pour
  que l'ensemble du graphe reste lisible ; sur un graphe de plus de 20 relations, les étiquettes de
  multiplicité ne s'affichent que sur les liens mis en évidence.
- Quand les schémas viennent de plusieurs fichiers, chaque fichier a sa propre couleur, visible sur
  les cartes et dans la barre latérale.
- La barre latérale filtre les schémas par nom et par fichier source. Les cartes peuvent être
  déplacées ; zoome et déplace la vue avec la souris, les contrôles ou la minimap.
- Le thème suit celui de ton système (clair ou sombre).

#### Rechargement automatique

Tant que le viewer tourne, Zodiag surveille les fichiers de schémas de la cible. Quand l'un d'eux est
ajouté, modifié ou supprimé, le diagramme se met à jour en environ une seconde, sans perdre ta
recherche, tes filtres de fichiers ni les cartes repliées (la barre latérale indique l'heure du dernier
rechargement). Désactive-le avec `--no-watch`.

- Un fichier qui ne se charge plus (une erreur de syntaxe, par exemple) est signalé dans le terminal et
  écarté ; les autres schémas restent affichés. Si rien ne peut être extrait, le diagramme précédent
  est conservé.
- Seuls les fichiers de la cible sont surveillés, pas les modules qu'ils importent depuis ailleurs :
  modifie l'un des fichiers de la cible, ou redémarre, après avoir changé un module partagé.
- Les fichiers sont interrogés une fois par seconde plutôt que surveillés via les notifications du
  système d'exploitation : le comportement est identique partout et ne descend jamais dans
  `node_modules`.

### Sortie Mermaid

Le texte Mermaid peut être collé dans un fichier Markdown (GitHub rend les blocs ` ```mermaid `) ou
dans le [Mermaid Live Editor](https://mermaid.live).

- Chaque schéma objet est une entité dont les attributs sont les champs. Les champs optionnels, les
  contraintes (`int, >= 0`) et les descriptions vont dans le commentaire de l'attribut.
- Les enums ne sont pas des entités : elles apparaissent comme types d'attribut, avec leurs valeurs
  dans le commentaire (`one of: completed | abandoned | refunded`).
- Les types complexes sont aplatis en ce que Mermaid accepte (`string | number` devient
  `string_or_number`).
- Une relation se lit « une source a un / zéro ou un / zéro ou plusieurs cibles » :
  `Order ||--o{ OrderLine : "lines"`. Les relations inférées utilisent un trait pointillé :
  `Order ||..|| Shop : "shopId"`.

## Fonctionnement

1. **Extraction** : les fichiers de schémas sont chargés à l'exécution avec
   [jiti](https://github.com/unjs/jiti) et les objets Zod sont parcourus via leur définition interne.
   Chaque schéma objet ou enum exporté devient un nœud : un champ qui pointe vers un autre schéma
   exporté devient donc une relation.
2. **Modèle** : le résultat est un `SchemaGraph` indépendant de tout framework (nœuds, champs,
   relations).
3. **Rendu** : le graphe est soit exporté en texte Mermaid, soit servi en JSON au viewer, une
   application React statique ([React Flow](https://reactflow.dev) avec une disposition
   [dagre](https://github.com/dagrejs/dagre)) que le CLI sert en local.

Ce que l'extraction comprend :

- Les objets, enums, tableaux, sets, tuples, records, unions, intersections, littéraux, objets
  imbriqués et schémas récursifs (`z.lazy`, getters).
- Les champs `optional`, `nullable`, `default` et leurs contraintes (`>= 0`, `min 1`, `email`,
  `int`...).
- La composition : spread de shapes, `.extend()`, `.pick()`, `.omit()`...
- Les descriptions `.describe()`.
- Les enums sont affichées comme types de champ, pas comme relations. Les autres schémas exportés,
  comme `z.array(ShopSchema)`, sont des alias, résolus en `Shop[]` là où ils sont utilisés au lieu de
  devenir des nœuds.
- Les noms de nœuds perdent le suffixe `Schema` (`ShopSchema` devient `Shop`) ; en cas de collision de
  noms entre deux fichiers, le nom du fichier est préfixé (`item.Item`).

Pas encore géré : les commentaires du source et `export default`.

### Relations inférées

Zod ne sait pas exprimer les clés étrangères : `shopId: z.string()` n'est qu'une chaîne. Zodiag devine
le lien lorsque toutes ces conditions sont réunies, et le dessine en relation pointillée (désactivable
avec `--no-inferred-relations`) :

- le champ contient un simple identifiant : un `string` ou un `number` (`shopIds: z.array(z.string())`
  est une liste d'identifiants et pointe vers plusieurs) ;
- son nom est un nom de schéma suivi de `Id` ou `_id` (`shopId`, `order_line_id` -> `OrderLine`), sans
  tenir compte de la casse ni des underscores ;
- ce nom désigne exactement un schéma objet, différent de celui qui porte le champ (un nom qui
  correspond à plusieurs schémas est ignoré). Les enums ne sont jamais des cibles.

Les identifiants optionnels et nullables donnent une relation `0..1`. Un simple champ `id`, ou un nom
comme `userId` sans schéma `User`, ne crée rien.

> **Note :** analyser un fichier l'exécute (les imports lancent leur code de premier niveau). Ne pointe
> Zodiag que vers du code de confiance. Les fichiers qui échouent au chargement sont signalés et
> ignorés.

## Architecture

Domain-Driven Design, avec des dépendances orientées vers le domaine :

```
src/
  domain/          modèle pur (SchemaGraph, SchemaNode, Field, Relation, TypeExpression)
  application/     cas d'usage (ExtractSchemaGraph) et ports (ModuleLoader, SchemaIntrospector,
                   GraphRenderer, ViewerLauncher)
  infrastructure/  adaptateurs (chargeur de modules jiti, introspection Zod v4, rendu Mermaid,
                   serveur HTTP local pour le viewer)
  presentation/    CLI
viewer/            le viewer web (Vite + React), construit dans dist/viewer
```

Le domaine ne connaît rien de Zod : l'adaptateur Zod reconnaît les schémas par leur forme interne
plutôt qu'avec `instanceof`, car le projet analysé embarque sa propre copie de Zod.

## Scripts

| Script               | Description                                                                |
|----------------------|----------------------------------------------------------------------------|
| `npm run build`      | Compile le CLI dans `dist/` et construit le viewer dans `dist/viewer/`     |
| `npm run typecheck`  | Vérifie les types du CLI et du viewer sans rien émettre                    |
| `npm test`           | Lance les tests une fois (Vitest)                                          |
| `npm run test:watch` | Lance les tests en mode watch                                              |
| `npm run lint`       | Analyse le code avec [Biome](https://biomejs.dev) (règles recommandées)    |
| `npm run format`     | Formate le code avec Biome (modifie les fichiers)                          |
| `npm run check`      | Lint, format et ordre des imports en lecture seule (utile en CI)           |

Le viewer est servi depuis `dist/viewer` : `npm run build` doit donc avoir été exécuté avant de
l'utiliser.

## Contribuer

Le projet suit le [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) original :
`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Crée les features depuis `develop`, ne
commite jamais directement sur `main` ou `develop`. Les commits suivent les
[Conventional Commits](https://www.conventionalcommits.org) et sont rédigés en anglais.

## Feuille de route

- [x] Mise en place du projet
- [x] Modèle de domaine et extracteur Zod v4
- [x] Export Mermaid et commande CLI
- [x] Viewer web interactif
- [x] Relations inférées (`shopId` -> `Shop`)
- [x] Mode watch (recharge le viewer quand les schémas changent)
- [ ] Commentaires du source
