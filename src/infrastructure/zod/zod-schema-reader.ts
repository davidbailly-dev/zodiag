import type { Field, TypeExpression } from '../../domain/index.js';
import { describeConstraints } from './describe-constraints.js';
import type { ZodDef, ZodSchema } from './zod-schema.js';
import { enumValuesOf, schemaAt, schemaListAt, shapeOf } from './zod-schema.js';

const PRIMITIVE_TYPES = new Set([
    'string',
    'number',
    'boolean',
    'bigint',
    'date',
    'symbol',
    'null',
    'undefined',
    'void',
    'any',
    'unknown',
    'never',
    'nan',
]);

// Wrappers that do not change the shape of the data they wrap.
const TRANSPARENT_WRAPPERS = new Set(['default', 'prefault', 'readonly', 'catch', 'nonoptional']);

type Visiting = Set<ZodSchema>;

// Reads Zod schemas into domain types. `registry` maps the exported object and enum schemas to the
// name of their node: meeting one of these instances while walking a schema yields a reference
// instead of a copy of its structure.
export class ZodSchemaReader {
    private readonly registry: ReadonlyMap<ZodSchema, string>;

    constructor(registry: ReadonlyMap<ZodSchema, string>) {
        this.registry = registry;
    }

    readFields(schema: ZodSchema): Field[] {
        return shapeOf(schema._zod.def).map(([name, fieldSchema]) => this.readField(name, fieldSchema, new Set()));
    }

    private readField(name: string, schema: ZodSchema, visiting: Visiting): Field {
        let current = schema;
        let optional = false;
        let required = false;
        let nullable = false;
        let description = schema.description;
        const unwrapped = new Set<ZodSchema>();

        // Peel the wrappers that only describe how the field is provided, stopping on a registered
        // schema so that it stays a reference.
        while (!this.registry.has(current) && !unwrapped.has(current)) {
            unwrapped.add(current);
            const def = current._zod.def;
            let next: ZodSchema | undefined;
            if (def.type === 'optional') {
                optional = true;
                next = schemaAt(def, 'innerType');
            } else if (def.type === 'nullable') {
                nullable = true;
                next = schemaAt(def, 'innerType');
            } else if (def.type === 'default' || def.type === 'prefault') {
                optional = true;
                next = schemaAt(def, 'innerType');
            } else if (def.type === 'nonoptional') {
                required = true;
                next = schemaAt(def, 'innerType');
            } else if (def.type === 'readonly' || def.type === 'catch') {
                next = schemaAt(def, 'innerType');
            } else if (def.type === 'lazy') {
                next = lazyTarget(def);
            } else if (def.type === 'pipe') {
                next = schemaAt(def, 'in');
            }
            if (next === undefined) {
                break;
            }
            current = next;
            description ??= current.description;
        }

        const field: Field = {
            name,
            type: this.readTypeGuarded(current, visiting),
            optional: optional && !required,
            nullable,
            constraints: describeConstraints(current),
        };
        return description !== undefined && description !== '' ? { ...field, description } : field;
    }

    private readTypeGuarded(schema: ZodSchema, visiting: Visiting): TypeExpression {
        const target = this.registry.get(schema);
        if (target !== undefined) {
            return { kind: 'reference', target };
        }
        // A schema reached again while it is being read is recursive and has no finite expression.
        if (visiting.has(schema)) {
            return { kind: 'unknown', name: 'recursive' };
        }
        visiting.add(schema);
        try {
            return this.readDefinition(schema._zod.def, visiting);
        } finally {
            visiting.delete(schema);
        }
    }

    private readDefinition(def: ZodDef, visiting: Visiting): TypeExpression {
        const read = (schema: ZodSchema): TypeExpression => this.readTypeGuarded(schema, visiting);

        switch (def.type) {
            case 'object':
                return {
                    kind: 'object',
                    fields: shapeOf(def).map(([name, schema]) => this.readField(name, schema, visiting)),
                };
            case 'array':
                return { kind: 'array', item: read(schemaAt(def, 'element')) };
            case 'set':
                return { kind: 'array', item: read(schemaAt(def, 'valueType')) };
            case 'tuple':
                return { kind: 'tuple', items: schemaListAt(def, 'items').map(read) };
            case 'record':
            case 'map':
                return {
                    kind: 'record',
                    key: read(schemaAt(def, 'keyType')),
                    value: read(schemaAt(def, 'valueType')),
                };
            case 'union':
                return unionOf(schemaListAt(def, 'options').map(read));
            case 'intersection':
                return {
                    kind: 'intersection',
                    members: [read(schemaAt(def, 'left')), read(schemaAt(def, 'right'))],
                };
            case 'literal':
                return unionOf(literalValues(def).map(toLiteral));
            case 'enum':
                return unionOf(enumValuesOf(def).map((value) => ({ kind: 'literal', value })));
            case 'optional':
                return unionOf([read(schemaAt(def, 'innerType')), { kind: 'primitive', name: 'undefined' }]);
            case 'nullable':
                return unionOf([read(schemaAt(def, 'innerType')), { kind: 'primitive', name: 'null' }]);
            case 'lazy':
                return read(lazyTarget(def));
            case 'pipe':
                return read(schemaAt(def, 'in'));
            default:
                if (TRANSPARENT_WRAPPERS.has(def.type)) {
                    return read(schemaAt(def, 'innerType'));
                }
                return PRIMITIVE_TYPES.has(def.type)
                    ? { kind: 'primitive', name: def.type }
                    : { kind: 'unknown', name: def.type };
        }
    }
}

function lazyTarget(def: ZodDef): ZodSchema {
    const getter = def['getter'];
    if (typeof getter !== 'function') {
        throw new Error('Expected a getter in a "lazy" definition');
    }
    return schemaAt({ type: 'lazy', target: (getter as () => unknown)() }, 'target');
}

function literalValues(def: ZodDef): unknown[] {
    const values = def['values'];
    if (!Array.isArray(values)) {
        throw new Error('Expected values in a "literal" definition');
    }
    return values;
}

function toLiteral(value: unknown): TypeExpression {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return { kind: 'literal', value };
    }
    if (value === null) {
        return { kind: 'primitive', name: 'null' };
    }
    return { kind: 'primitive', name: typeof value };
}

// Builds a union, flattening nested unions and collapsing a single member.
function unionOf(members: readonly TypeExpression[]): TypeExpression {
    const flattened = members.flatMap((member) => (member.kind === 'union' ? member.members : [member]));
    const [first] = flattened;
    return flattened.length === 1 && first !== undefined ? first : { kind: 'union', members: flattened };
}
