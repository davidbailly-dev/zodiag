import { describe, expect, it } from 'vitest';
import type { Field } from './field.js';
import { inferRelations } from './infer-relations.js';
import { SchemaGraph } from './schema-graph.js';
import type { ObjectNode, SchemaNode } from './schema-node.js';
import type { TypeExpression } from './type-expression.js';

const string: TypeExpression = { kind: 'primitive', name: 'string' };
const number: TypeExpression = { kind: 'primitive', name: 'number' };

function field(name: string, type: TypeExpression = string, overrides: Partial<Field> = {}): Field {
    return { name, type, optional: false, nullable: false, constraints: [], ...overrides };
}

function objectNode(name: string, fields: Field[]): ObjectNode {
    return { kind: 'object', name, source: 'schemas.ts', fields };
}

const shop = objectNode('Shop', [field('id')]);

function infer(...nodes: SchemaNode[]) {
    return inferRelations([shop, ...nodes]).map(
        ({ source, target, fieldName, cardinality }) => `${source}.${fieldName} -> ${target} (${cardinality})`,
    );
}

describe('inferRelations', () => {
    it('links a field named after a schema and suffixed with Id', () => {
        expect(infer(objectNode('Order', [field('id'), field('shopId')]))).toEqual(['Order.shopId -> Shop (one)']);
    });

    it('marks every relation as inferred', () => {
        const [relation] = inferRelations([shop, objectNode('Order', [field('shopId')])]);

        expect(relation?.kind).toBe('inferred');
    });

    it('accepts numeric identifiers and snake_case names', () => {
        const orderLine = objectNode('OrderLine', [field('id')]);

        expect(
            infer(
                orderLine,
                objectNode('Delivery', [field('shop_id', number), field('orderLineId'), field('order_line_id')]),
            ),
        ).toEqual([
            'Delivery.shop_id -> Shop (one)',
            'Delivery.orderLineId -> OrderLine (one)',
            'Delivery.order_line_id -> OrderLine (one)',
        ]);
    });

    it('matches the schema name regardless of case', () => {
        expect(infer(objectNode('Order', [field('SHOPId')]))).toEqual(['Order.SHOPId -> Shop (one)']);
    });

    it('uses zero-or-one for optional and nullable identifiers', () => {
        expect(
            infer(
                objectNode('Order', [
                    field('shopId', string, { optional: true }),
                    field('otherShopId', string, { nullable: true }),
                ]),
                objectNode('OtherShop', []),
            ),
        ).toEqual(['Order.shopId -> Shop (zero-or-one)', 'Order.otherShopId -> OtherShop (zero-or-one)']);
    });

    it('uses many for a list of identifiers', () => {
        expect(infer(objectNode('Group', [field('shopIds', { kind: 'array', item: string })]))).toEqual([
            'Group.shopIds -> Shop (many)',
        ]);
    });

    it('ignores fields that cannot be foreign keys', () => {
        expect(
            infer(
                objectNode('Order', [
                    field('id'),
                    field('paid'),
                    field('valid', string),
                    field('shopId', { kind: 'primitive', name: 'boolean' }),
                    field('userId'),
                    field('shopIds'),
                    field('Id'),
                    field('shop', { kind: 'reference', target: 'Shop' }),
                ]),
            ),
        ).toEqual([]);
    });

    it('does not link a schema to itself nor to enums', () => {
        const status: SchemaNode = { kind: 'enum', name: 'Status', source: 'schemas.ts', values: ['open'] };

        expect(infer(status, objectNode('Order', [field('orderId'), field('statusId')]))).toEqual([]);
    });

    it('skips an ambiguous name that designates several schemas', () => {
        const nodes = [objectNode('Item', []), objectNode('ITEM', []), objectNode('Order', [field('itemId')])];

        expect(inferRelations(nodes)).toEqual([]);
    });
});

describe('SchemaGraph.withInferredRelations', () => {
    const nodes: SchemaNode[] = [shop, objectNode('Order', [field('shopId')])];

    it('adds the inferred relations after the explicit ones', () => {
        const order = objectNode('Order', [
            field('shopId'),
            field('lines', { kind: 'array', item: { kind: 'reference', target: 'Line' } }),
        ]);
        const graph = SchemaGraph.create([shop, objectNode('Line', []), order]).withInferredRelations();

        expect(graph.relations.map((relation) => [relation.fieldName, relation.kind])).toEqual([
            ['lines', 'explicit'],
            ['shopId', 'inferred'],
        ]);
    });

    it('is idempotent and leaves the original graph untouched', () => {
        const original = SchemaGraph.create(nodes);

        const once = original.withInferredRelations();
        const twice = once.withInferredRelations();

        expect(original.relations).toEqual([]);
        expect(twice.relations).toEqual(once.relations);
        expect(once.relations).toHaveLength(1);
    });
});
