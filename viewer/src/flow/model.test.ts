import { describe, expect, it } from 'vitest';
import { SchemaGraph } from '../../../src/domain/index.js';
import type { Field, SchemaNode, TypeExpression } from '../../../src/domain/index.js';
import { buildEntities, cardinalityLabel } from './model.js';

const string: TypeExpression = { kind: 'primitive', name: 'string' };
const ref = (target: string): TypeExpression => ({ kind: 'reference', target });

function field(name: string, type: TypeExpression, overrides: Partial<Field> = {}): Field {
    return { name, type, optional: false, nullable: false, constraints: [], ...overrides };
}

const nodes: SchemaNode[] = [
    { kind: 'enum', name: 'Status', source: 'order.ts', values: ['open', 'closed'] },
    { kind: 'object', name: 'Shop', source: 'shop.ts', description: 'A shop', fields: [field('id', string)] },
    {
        kind: 'object',
        name: 'Order',
        source: 'order.ts',
        fields: [
            field('shop', ref('Shop')),
            field('status', ref('Status')),
            field('note', string, { optional: true, nullable: true, constraints: ['min 2'], description: 'Free text' }),
        ],
    },
];

describe('buildEntities', () => {
    const entities = buildEntities(SchemaGraph.create(nodes));

    it('creates one entity per object schema and folds enums into their fields', () => {
        expect(entities.map((entity) => entity.name)).toEqual(['Shop', 'Order']);
        expect(entities[0]).toMatchObject({ source: 'shop.ts', description: 'A shop' });
    });

    it('describes fields with their display type, flags and constraints', () => {
        const order = entities[1];
        expect(order?.fields).toEqual([
            { name: 'shop', type: 'Shop', optional: false, constraints: [], linked: true },
            {
                name: 'status',
                type: 'Status',
                optional: false,
                constraints: [],
                linked: false,
                enumValues: ['open', 'closed'],
            },
            {
                name: 'note',
                type: 'string | null',
                optional: true,
                constraints: ['min 2'],
                linked: false,
                description: 'Free text',
            },
        ]);
    });
});

describe('cardinalityLabel', () => {
    it('uses the UML multiplicity notation', () => {
        expect(cardinalityLabel('one')).toBe('1');
        expect(cardinalityLabel('zero-or-one')).toBe('0..1');
        expect(cardinalityLabel('many')).toBe('0..*');
    });
});
