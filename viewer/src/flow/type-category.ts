import type { SchemaNode, TypeExpression } from '../../../src/domain/index.js';

// Family of a field type, used to color it. Arrays take the family of their items (`Shop[]` is an entity).
export type TypeCategory = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'entity' | 'other';

const PRIMITIVE_CATEGORIES: Readonly<Record<string, TypeCategory>> = {
    string: 'string',
    number: 'number',
    bigint: 'number',
    boolean: 'boolean',
    date: 'date',
};

// `null` and `undefined` only say that a value may be absent: they do not change what the value is.
const ABSENT_TYPES = new Set(['null', 'undefined']);

export function typeCategory(type: TypeExpression, nodesByName: ReadonlyMap<string, SchemaNode>): TypeCategory {
    switch (type.kind) {
        case 'primitive':
            return PRIMITIVE_CATEGORIES[type.name] ?? 'other';
        case 'literal':
            return PRIMITIVE_CATEGORIES[typeof type.value] ?? 'other';
        case 'reference':
            return nodesByName.get(type.target)?.kind === 'enum' ? 'enum' : 'entity';
        case 'array':
            return typeCategory(type.item, nodesByName);
        case 'union': {
            const categories = new Set(
                type.members
                    .filter((member) => !(member.kind === 'primitive' && ABSENT_TYPES.has(member.name)))
                    .map((member) => typeCategory(member, nodesByName)),
            );
            const [only] = categories;
            return categories.size === 1 && only !== undefined ? only : 'other';
        }
        case 'tuple':
        case 'record':
        case 'intersection':
        case 'object':
        case 'unknown':
            return 'other';
    }
}
