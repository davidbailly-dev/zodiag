import { describe, expect, it } from 'vitest';
import type { SchemaNode, TypeExpression } from '../../../src/domain/index.js';
import { typeCategory } from './type-category.js';

const primitive = (name: string): TypeExpression => ({ kind: 'primitive', name });
const ref = (target: string): TypeExpression => ({ kind: 'reference', target });

const nodes: SchemaNode[] = [
    { kind: 'enum', name: 'Status', source: 'order.ts', values: ['open', 'closed'] },
    { kind: 'object', name: 'Shop', source: 'shop.ts', fields: [] },
];
const nodesByName = new Map(nodes.map((node) => [node.name, node] as const));

describe('typeCategory', () => {
    it('groups the primitives by family', () => {
        expect(typeCategory(primitive('string'), nodesByName)).toBe('string');
        expect(typeCategory(primitive('number'), nodesByName)).toBe('number');
        expect(typeCategory(primitive('bigint'), nodesByName)).toBe('number');
        expect(typeCategory(primitive('boolean'), nodesByName)).toBe('boolean');
        expect(typeCategory(primitive('date'), nodesByName)).toBe('date');
        expect(typeCategory(primitive('any'), nodesByName)).toBe('other');
    });

    it('tells enums from references to other schemas', () => {
        expect(typeCategory(ref('Status'), nodesByName)).toBe('enum');
        expect(typeCategory(ref('Shop'), nodesByName)).toBe('entity');
    });

    it('uses the family of the items for an array', () => {
        expect(typeCategory({ kind: 'array', item: ref('Shop') }, nodesByName)).toBe('entity');
        expect(typeCategory({ kind: 'array', item: primitive('string') }, nodesByName)).toBe('string');
    });

    it('uses the family of a literal value', () => {
        expect(typeCategory({ kind: 'literal', value: 'open' }, nodesByName)).toBe('string');
        expect(typeCategory({ kind: 'literal', value: 3 }, nodesByName)).toBe('number');
    });

    it('ignores null and undefined in a union, and falls back to other when the members differ', () => {
        const nullable: TypeExpression = { kind: 'union', members: [primitive('string'), primitive('null')] };
        const mixed: TypeExpression = { kind: 'union', members: [primitive('string'), primitive('number')] };
        expect(typeCategory(nullable, nodesByName)).toBe('string');
        expect(typeCategory(mixed, nodesByName)).toBe('other');
    });

    it('leaves structured types uncolored', () => {
        expect(
            typeCategory({ kind: 'record', key: primitive('string'), value: primitive('number') }, nodesByName),
        ).toBe('other');
        expect(typeCategory({ kind: 'unknown', name: 'custom' }, nodesByName)).toBe('other');
    });
});
