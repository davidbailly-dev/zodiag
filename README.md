# Zodiac

Visualize [Zod](https://zod.dev) schemas as diagrams.

Point Zodiac at a file or a folder of schemas (`order.ts`, `shop.ts`, `orderLine.ts`, ...) and it
builds a graph of your schemas, their fields and the relations between them, shown in a local web
viewer or exported as [Mermaid](https://mermaid.js.org).

> **Status: work in progress.** Schema extraction, the interactive viewer and the Mermaid export
> are available from the command line. Features marked as *planned* are not implemented.

## Requirements

- Node.js >= 20
- Zod `^4.0.0` in the analyzed project (developed against 4.6.4)

## Getting started

```bash
npm install
npm run build
node dist/presentation/cli/main.js ./path/to/schemas
```

To get the `zodiac` command on your path while developing, run `npm link` after the build.

## Usage

```bash
# Open the interactive viewer for a folder of schemas (or a single file)
zodiac ./src/schemas

# Print a Mermaid erDiagram instead
zodiac ./src/schemas --format mermaid

# Write the Mermaid diagram to a file (missing directories are created)
zodiac ./src/schemas --format mermaid --output docs/schemas.mmd
```

| Option                  | Description                                                              |
|-------------------------|--------------------------------------------------------------------------|
| `-f, --format <format>` | `viewer` (default) or `mermaid`                                          |
| `-o, --output <file>`   | Write a text format to a file instead of the stdout (not for the viewer) |
| `-p, --port <port>`     | Port of the viewer. Default: the first free port from 4000               |
| `--no-open`             | Do not open the viewer in the browser                                    |

Warnings (files that fail to load) go to the standard error, so the standard output stays a valid
diagram. The command exits with an error if the target does not exist or contains no schema.

### Viewer

`zodiac <target>` starts a small web server on `127.0.0.1` (never exposed on the network), prints
its address and opens it in your browser. Stop it with `Ctrl+C`.

- Each object schema is a card listing its fields, their types, `?` for optional fields and their
  constraints. Enum fields are shown in orange: hover one to see its values.
- Relations are arrows starting from the field that holds them, labelled with their multiplicity
  (`1`, `0..1`, `0..*`).
- Click a schema to highlight its links and fade the rest; click the background to reset.
- The sidebar filters schemas by name and by source file. Cards can be dragged; zoom and pan with
  the mouse, the controls or the minimap.
- The theme follows your system (light or dark).

### Mermaid output

The Mermaid text can be pasted into a Markdown file (GitHub renders ` ```mermaid ` blocks) or into
the [Mermaid Live Editor](https://mermaid.live).


- Each object schema is an entity whose attributes are the fields. Optional fields, constraints
  (`int, >= 0`) and descriptions go in the attribute comment.
- Enums are not entities: they appear as attribute types, with their values in the comment
  (`one of: completed | abandoned | refunded`).
- Complex types are flattened to what Mermaid accepts (`string | number` becomes `string_or_number`).
- A relation reads "a source has one / zero or one / zero or more targets":
  `Order ||--o{ OrderLine : "lines"`.

## How it works

1. **Extraction**: the schema files are loaded at runtime with [jiti](https://github.com/unjs/jiti)
   and the Zod objects are walked through their internal definition. Every exported object or enum
   schema becomes a node, so a field pointing to another exported schema becomes a relation.
2. **Model**: the result is a framework-agnostic `SchemaGraph` (nodes, fields, relations).
3. **Rendering**: the graph is either exported as Mermaid text, or served as JSON to the viewer, a
   static React app ([React Flow](https://reactflow.dev) with a [dagre](https://github.com/dagrejs/dagre)
   layout) that the CLI serves locally.

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
  application/     use case (ExtractSchemaGraph) and ports (ModuleLoader, SchemaIntrospector,
                   GraphRenderer, ViewerLauncher)
  infrastructure/  adapters (jiti module loader, Zod v4 introspection, Mermaid renderer,
                   local HTTP server for the viewer)
  presentation/    CLI
viewer/            the web viewer (Vite + React), built into dist/viewer
```

The domain knows nothing about Zod: the Zod adapter recognizes schemas by their internal shape
rather than with `instanceof`, because the analyzed project ships its own copy of Zod.

## Scripts

| Script               | Description                                              |
|----------------------|----------------------------------------------------------|
| `npm run build`      | Compile the CLI to `dist/` and build the viewer to `dist/viewer/` |
| `npm run typecheck`  | Type-check the CLI and the viewer without emitting       |
| `npm test`           | Run the tests once (Vitest)                              |
| `npm run test:watch` | Run the tests in watch mode                              |

The viewer is served from `dist/viewer`, so `npm run build` must have been run before using it.

## Contributing

The project follows the original [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/):
`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Branch features from `develop`, never
commit directly on `main` or `develop`. Commits follow
[Conventional Commits](https://www.conventionalcommits.org) and are written in English.

## Roadmap

- [x] Project setup
- [x] Domain model and Zod v4 extractor
- [x] Mermaid export and CLI command
- [x] Interactive web viewer
- [ ] Source comments, watch mode (reload the viewer when schemas change), inferred relations
  (`shopId` -> `Shop`)
