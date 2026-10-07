import { describe, expect, it } from 'vitest';
import { DuplicateNodeNameError, UnknownReferenceError } from './errors.js';
import type { Field } from './field.js';
import { SchemaGraph } from './schema-graph.js';
import type { ObjectNode, SchemaNode } from './schema-node.js';
import type { TypeExpression } from './type-expression.js';

function field(name: string, type: TypeExpression, overrides: Partial<Field> = {}): Field {
    return { name, type, optional: false, nullable: false, constraints: [], ...overrides };
}

function objectNode(name: string, fields: Field[]): ObjectNode {
    return { kind: 'object', name, source: 'schemas.ts', fields };
}

const string: TypeExpression = { kind: 'primitive', name: 'string' };
const ref = (target: string): TypeExpression => ({ kind: 'reference', target });

describe('SchemaGraph', () => {
    it('derives relations with their cardinality', () => {
        const graph = SchemaGraph.create([
            objectNode('Shop', [field('id', string)]),
            objectNode('OrderLine', [field('quantity', string)]),
            objectNode('Order', [
                field('shop', ref('Shop')),
                field('referrer', ref('Shop'), { optional: true }),
                field('lines', { kind: 'array', item: ref('OrderLine') }),
            ]),
        ]);

        expect(graph.relations).toEqual([
            { source: 'Order', target: 'Shop', fieldName: 'shop', kind: 'explicit', cardinality: 'one' },
            { source: 'Order', target: 'Shop', fieldName: 'referrer', kind: 'explicit', cardinality: 'zero-or-one' },
            { source: 'Order', target: 'OrderLine', fieldName: 'lines', kind: 'explicit', cardinality: 'many' },
        ]);
    });

    it('treats nullable fields and union members as zero-or-one', () => {
        const graph = SchemaGraph.create([
            objectNode('Shop', []),
            objectNode('Customer', []),
            objectNode('Order', [
                field('shop', ref('Shop'), { nullable: true }),
                field('buyer', { kind: 'union', members: [ref('Customer'), string] }),
            ]),
        ]);

        expect(graph.relations.map((relation) => relation.cardinality)).toEqual(['zero-or-one', 'zero-or-one']);
    });

    it('does not create relations towards enums', () => {
        const status: SchemaNode = { kind: 'enum', name: 'Status', source: 'schemas.ts', values: ['open'] };
        const graph = SchemaGraph.create([status, objectNode('Order', [field('status', ref('Status'))])]);

        expect(graph.relations).toEqual([]);
    });

    it('supports self-references', () => {
        const graph = SchemaGraph.create([
            objectNode('Category', [field('children', { kind: 'array', item: ref('Category') })]),
        ]);

        expect(graph.relations).toEqual([
            { source: 'Category', target: 'Category', fieldName: 'children', kind: 'explicit', cardinality: 'many' },
        ]);
    });

    it('finds a node by name', () => {
        const shop = objectNode('Shop', []);
        const graph = SchemaGraph.create([shop]);

        expect(graph.findNode('Shop')).toBe(shop);
        expect(graph.findNode('Missing')).toBeUndefined();
    });

    it('rejects duplicate node names', () => {
        expect(() => SchemaGraph.create([objectNode('Shop', []), objectNode('Shop', [])])).toThrow(
            DuplicateNodeNameError,
        );
    });

    it('rejects references to unknown nodes', () => {
        expect(() => SchemaGraph.create([objectNode('Order', [field('shop', ref('Shop'))])])).toThrow(
            UnknownReferenceError,
        );
    });
});
