import type { Field } from './field.js';
import type { Relation } from './relation.js';
import type { ObjectNode, SchemaNode } from './schema-node.js';
import type { TypeExpression } from './type-expression.js';

const SINGLE_IDENTIFIER = /^(.+?)(?:Id|_id)$/;
const IDENTIFIER_LIST = /^(.+?)(?:Ids|_ids)$/;

// Zod cannot express foreign keys, so a field is assumed to point to a schema when it holds a plain
// identifier (a string or a number) and its name is that schema's name followed by `Id`
// (`shopId` -> `Shop`, `order_line_id` -> `OrderLine`). A list of identifiers (`productIds`) points to
// many. The match is ambiguity-proof: the name must designate exactly one other object schema.
export function inferRelations(nodes: readonly SchemaNode[]): Relation[] {
    const objects = nodes.filter((node): node is ObjectNode => node.kind === 'object');
    const relations: Relation[] = [];

    for (const source of objects) {
        for (const field of source.fields) {
            const target = findTarget(source, field, objects);
            if (target === undefined) {
                continue;
            }
            relations.push({
                source: source.name,
                target: target.name,
                fieldName: field.name,
                cardinality: isIdentifierList(field.type)
                    ? 'many'
                    : field.optional || field.nullable
                      ? 'zero-or-one'
                      : 'one',
                kind: 'inferred',
            });
        }
    }
    return relations;
}

function findTarget(source: ObjectNode, field: Field, objects: readonly ObjectNode[]): ObjectNode | undefined {
    const pattern = isIdentifierList(field.type)
        ? IDENTIFIER_LIST
        : isIdentifier(field.type)
          ? SINGLE_IDENTIFIER
          : undefined;
    const prefix = pattern?.exec(field.name)?.[1];
    if (prefix === undefined) {
        return undefined;
    }
    const candidates = objects.filter(
        (node) => node.name !== source.name && normalize(node.name) === normalize(prefix),
    );
    return candidates.length === 1 ? candidates[0] : undefined;
}

function isIdentifier(type: TypeExpression): boolean {
    return type.kind === 'primitive' && (type.name === 'string' || type.name === 'number');
}

function isIdentifierList(type: TypeExpression): boolean {
    return type.kind === 'array' && isIdentifier(type.item);
}

function normalize(name: string): string {
    return name.replace(/[_-]/g, '').toLowerCase();
}
