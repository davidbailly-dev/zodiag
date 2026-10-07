# Zodiac

Visualize [Zod](https://zod.dev) schemas as diagrams.

Point Zodiac at a file or a folder of schemas (`order.ts`, `shop.ts`, `orderLine.ts`, ...) and it
builds a graph of your schemas, their fields and the relations between them, shown in a local web
viewer or exported as [Mermaid](https://mermaid.js.org).

> **Status: work in progress.** Only the project setup is done. The features below marked as
> *planned* are not implemented yet.

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

## How it works (planned)

1. **Extraction**: the schema files are loaded at runtime with [jiti](https://github.com/unjs/jiti)
   and the Zod objects are walked through their internal definition. Every exported schema is
   registered by name, so a field pointing to another exported schema becomes a relation.
2. **Model**: the result is a framework-agnostic `SchemaGraph` (nodes, fields, relations).
3. **Rendering**: the graph is exported as Mermaid text or displayed in an interactive viewer
   (React Flow).

Shared schemas such as enums are shown as field types, and aliases like `z.array(ShopSchema)` are
resolved to `Shop[]` instead of becoming nodes.

## Architecture

Domain-Driven Design, dependencies pointing towards the domain:

```
src/
  domain/          pure model (SchemaGraph, SchemaNode, Field, Relation)
  application/     use cases
  infrastructure/  adapters (Zod v4 extraction, file loading, rendering)
  presentation/    CLI and viewer
```

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
- [ ] Domain model and Zod v4 extractor
- [ ] Mermaid export and CLI command
- [ ] Interactive web viewer
- [ ] Source comments, watch mode, inferred relations (`shopId` -> `Shop`)
