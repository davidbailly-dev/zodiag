import type { LoadedModule } from '../../application/ports/module-loader.js';
import type { SchemaIntrospector } from '../../application/ports/schema-introspector.js';
import { SchemaGraph } from '../../domain/index.js';
import type { SchemaNode } from '../../domain/index.js';
import { enumValuesOf, isZodSchema } from './zod-schema.js';
import type { ZodSchema } from './zod-schema.js';
import { ZodSchemaReader } from './zod-schema-reader.js';

const SCHEMA_SUFFIX = 'Schema';

interface RegisteredSchema {
    readonly schema: ZodSchema;
    readonly name: string;
    readonly source: string;
}

// Builds a SchemaGraph from the exports of already-loaded modules. Every exported object or enum
// schema becomes a node; any other exported schema (arrays, unions...) is an alias that is resolved
// where it is used.
export class ZodSchemaIntrospector implements SchemaIntrospector {
    introspect(modules: readonly LoadedModule[]): SchemaGraph {
        const registered = this.register(modules);
        const registry = new Map(registered.map(({ schema, name }) => [schema, name] as const));
        const reader = new ZodSchemaReader(registry);

        const nodes = registered.map((entry): SchemaNode => {
            const base = {
                name: entry.name,
                source: entry.source,
                ...(entry.schema.description ? { description: entry.schema.description } : {}),
            };
            const def = entry.schema._zod.def;
            return def.type === 'enum'
                ? { ...base, kind: 'enum', values: enumValuesOf(def) }
                : { ...base, kind: 'object', fields: reader.readFields(entry.schema) };
        });

        return SchemaGraph.create(nodes);
    }

    private register(modules: readonly LoadedModule[]): RegisteredSchema[] {
        const registered: RegisteredSchema[] = [];
        const seenSchemas = new Set<ZodSchema>();
        const usedNames = new Set<string>();

        for (const { filePath, exports } of modules) {
            for (const [exportName, value] of Object.entries(exports)) {
                if (!isZodSchema(value) || seenSchemas.has(value)) {
                    continue;
                }
                const type = value._zod.def.type;
                if (type !== 'object' && type !== 'enum') {
                    continue;
                }
                seenSchemas.add(value);

                let name = stripSchemaSuffix(exportName);
                if (usedNames.has(name)) {
                    name = `${fileStem(filePath)}.${name}`;
                }
                usedNames.add(name);
                registered.push({ schema: value, name, source: filePath });
            }
        }
        return registered;
    }
}

function stripSchemaSuffix(exportName: string): string {
    return exportName.length > SCHEMA_SUFFIX.length && exportName.endsWith(SCHEMA_SUFFIX)
        ? exportName.slice(0, -SCHEMA_SUFFIX.length)
        : exportName;
}

function fileStem(filePath: string): string {
    const fileName = filePath.split('/').pop() ?? filePath;
    return fileName.replace(/\.[^.]+$/, '');
}
