# Changelog

All notable changes to Zodiag are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-08

### Changed

- The project is renamed from Zodiac to Zodiag: the package, the `zodiag` command and the viewer title.
- The viewer uses the SalesPulse palette: its dark theme is the palette itself and the light theme is
  derived from it. The controls, the minimap and the background follow the same colors.
- Field types are colored by family (string, number, boolean, date, enum, link to another schema)
  so that they can be told apart at a glance.
- The README is written in French and opens with a screenshot of the viewer.

### Fixed

- The link handles keep the default cursor instead of the crosshair of React Flow.

### Development

- Biome handles the linting and the formatting of the code base (`npm run check`).

## [0.1.0] - 2026-10-07

First release.

### Added

- `zodiag <target>` command that reads the Zod 4 schemas of a file or of a whole directory.
- Extraction of objects, enums, arrays, sets, tuples, records, unions, intersections, literals,
  nested objects, recursive schemas, optional / nullable / default fields, constraints, spread
  shapes, `.extend()` / `.pick()` / `.omit()` and `.describe()` descriptions.
- Relations between schemas, including relations inferred from identifier fields (`shopId` points
  to `Shop`), shown as dashed links and disabled with `--no-inferred-relations`.
- Interactive local viewer, the default format: schema cards, field-level links with their
  multiplicity, search, file filters, link highlighting, light and dark themes.
- Foldable cards, folded by default beyond 10 schemas, and one color per source file.
- Live reload: the viewer follows the schema files while it runs (`--no-watch` to disable).
- Mermaid `erDiagram` export (`--format mermaid`, `--output <file>`).

### Notes

- Analyzing a file executes it. Only point Zodiag at code you trust.
- Requires Node.js 20.11 or later. The analyzed project needs Zod 4.
