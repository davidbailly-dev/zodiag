import type { Cardinality, Field, SchemaNode } from '../../../src/domain/index.js';
import { findReferences, formatTypeExpression } from '../../../src/domain/index.js';
import type { GraphData } from '../graph-data.js';
import type { TypeCategory } from './type-category.js';
import { typeCategory } from './type-category.js';

export type EntityField = {
    name: string;
    // Display form of the type, `| null` included.
    type: string;
    // Family of the type, which drives its color.
    category: TypeCategory;
    optional: boolean;
    constraints: string[];
    description?: string;
    // Set when the field is an enum: the values it accepts.
    enumValues?: (string | number)[];
    // The field points to another entity, so it is the origin of an edge.
    linked: boolean;
};

export type EntityData = {
    name: string;
    source: string;
    description?: string;
    fields: EntityField[];
};

const CARDINALITY_LABELS: Record<Cardinality, string> = {
    one: '1',
    'zero-or-one': '0..1',
    many: '0..*',
};

export function cardinalityLabel(cardinality: Cardinality): string {
    return CARDINALITY_LABELS[cardinality];
}

// One entity per object schema. Enums are not entities: they are folded into the fields that use them.
export function buildEntities(graph: GraphData): EntityData[] {
    const nodesByName = new Map(graph.nodes.map((node) => [node.name, node] as const));
    const linkedFields = new Set(graph.relations.map((relation) => linkKey(relation.source, relation.fieldName)));

    return graph.nodes.flatMap((node) => {
        if (node.kind !== 'object') {
            return [];
        }
        const entity: EntityData = {
            name: node.name,
            source: node.source,
            fields: node.fields.map((field) => toEntityField(node.name, field, nodesByName, linkedFields)),
        };
        return [node.description === undefined ? entity : { ...entity, description: node.description }];
    });
}

function toEntityField(
    entityName: string,
    field: Field,
    nodesByName: ReadonlyMap<string, SchemaNode>,
    linkedFields: ReadonlySet<string>,
): EntityField {
    const entityField: EntityField = {
        name: field.name,
        type: `${formatTypeExpression(field.type)}${field.nullable ? ' | null' : ''}`,
        category: typeCategory(field.type, nodesByName),
        optional: field.optional,
        constraints: [...field.constraints],
        linked: linkedFields.has(linkKey(entityName, field.name)),
    };
    const enumValues = findEnumValues(field, nodesByName);
    return {
        ...entityField,
        ...(field.description === undefined ? {} : { description: field.description }),
        ...(enumValues === undefined ? {} : { enumValues }),
    };
}

function findEnumValues(field: Field, nodesByName: ReadonlyMap<string, SchemaNode>): (string | number)[] | undefined {
    for (const { target } of findReferences(field.type)) {
        const node = nodesByName.get(target);
        if (node?.kind === 'enum') {
            return [...node.values];
        }
    }
    return undefined;
}

function linkKey(entityName: string, fieldName: string): string {
    return `${entityName}\u0000${fieldName}`;
}
