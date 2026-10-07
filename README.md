# Zodiac

Visualize [Zod](https://zod.dev) schemas as diagrams.

Point Zodiac at a file or a folder of schemas (`order.ts`, `shop.ts`, `orderLine.ts`, ...) and it
builds a graph of your schemas, their fields and the relations between them, shown in a local web
viewer or exported as [Mermaid](https://mermaid.js.org).

> **Status: work in progress.** The schema extraction (domain model, Zod 4 reader, file loading)
> works and is tested, but there is no CLI command, Mermaid export or viewer yet. The features
> marked as *planned* are not implemented.

## Requirements

- Node.js >= 20
- Zod `^4.0.0` in the analyzed project (developed against 4.6.4)

## Getting started

```bash
npm install
npm run build
node dist/presentation/cli/main.js --version
```

## Usage (planned)

```bash
# Open the interactive viewer for a folder of schemas
zodiac ./src/schemas

# Export a Mermaid erDiagram
zodiac ./src/schemas --format mermaid
```

## How it works

1. **Extraction**: the schema files are loaded at runtime with [jiti](https://github.com/unjs/jiti)
   and the Zod objects are walked through their internal definition. Every exported object or enum
   schema becomes a node, so a field pointing to another exported schema becomes a relation.
2. **Model**: the result is a framework-agnostic `SchemaGraph` (nodes, fields, relations).
3. **Rendering** *(planned)*: the graph is exported as Mermaid text or displayed in an interactive
   viewer (React Flow).

What the extraction understands:

- Objects, enums, arrays, sets, tuples, records, unions, intersections, literals, nested objects and
  recursive schemas (`z.lazy`, getters).
- `optional`, `nullable`, `default` fields and their constraints (`>= 0`, `min 1`, `email`, `int`...).
- Composition: spread shapes, `.extend()`, `.pick()`, `.omit()`...
- `.describe()` descriptions.
- Enums are shown as field types, not as relations. Other exported schemas such as
  `z.array(ShopSchema)` are aliases, resolved to `Shop[]` where they are used instead of becoming nodes.
- Node names drop the `Schema` suffix (`ShopSchema` becomes `Shop`); on a name collision between two
  files the file name is prepended (`item.Item`).

Not supported yet: implicit relations such as `shopId` -> `Shop`, source comments, `export default`.

> **Note:** analyzing a file executes it (imports run their top-level code). Only point Zodiac at
> code you trust. Files that fail to load are reported and skipped.

## Architecture

Domain-Driven Design, dependencies pointing towards the domain:

```
src/
  domain/          pure model (SchemaGraph, SchemaNode, Field, Relation, TypeExpression)
  application/     use case (ExtractSchemaGraph) and ports (ModuleLoader, SchemaIntrospector)
  infrastructure/  adapters (jiti module loader, Zod v4 introspection)
  presentation/    CLI and viewer
```

The domain knows nothing about Zod: the Zod adapter recognizes schemas by their internal shape
rather than with `instanceof`, because the analyzed project ships its own copy of Zod.

## Scripts

| Script               | Description                    |
|----------------------|--------------------------------|
| `npm run build`      | Compile TypeScript to `dist/`  |
| `npm run typecheck`  | Type-check without emitting    |
| `npm test`           | Run the tests once (Vitest)    |
| `npm run test:watch` | Run the tests in watch mode    |

## Contributing

The project follows the original [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/):
`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Branch features from `develop`, never
commit directly on `main` or `develop`. Commits follow
[Conventional Commits](https://www.conventionalcommits.org) and are written in English.

## Roadmap

- [x] Project setup
- [x] Domain model and Zod v4 extractor
- [ ] Mermaid export and CLI command
- [ ] Interactive web viewer
- [ ] Source comments, watch mode, inferred relations (`shopId` -> `Shop`)
