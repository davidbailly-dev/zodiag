import { describe, expect, it } from 'vitest';
import { findReferences, formatTypeExpression } from './type-expression.js';
import type { TypeExpression } from './type-expression.js';

const string: TypeExpression = { kind: 'primitive', name: 'string' };
const shop: TypeExpression = { kind: 'reference', target: 'Shop' };
const order: TypeExpression = { kind: 'reference', target: 'Order' };

describe('formatTypeExpression', () => {
    it('formats primitives, literals and references', () => {
        expect(formatTypeExpression(string)).toBe('string');
        expect(formatTypeExpression({ kind: 'literal', value: 'paid' })).toBe('"paid"');
        expect(formatTypeExpression({ kind: 'literal', value: 3 })).toBe('3');
        expect(formatTypeExpression(shop)).toBe('Shop');
    });

    it('formats arrays and wraps compound items in parentheses', () => {
        expect(formatTypeExpression({ kind: 'array', item: shop })).toBe('Shop[]');
        expect(formatTypeExpression({ kind: 'array', item: { kind: 'union', members: [shop, string] } })).toBe(
            '(Shop | string)[]',
        );
    });

    it('formats tuples, records, unions and intersections', () => {
        expect(formatTypeExpression({ kind: 'tuple', items: [string, shop] })).toBe('[string, Shop]');
        expect(formatTypeExpression({ kind: 'record', key: string, value: shop })).toBe('Record<string, Shop>');
        expect(formatTypeExpression({ kind: 'union', members: [shop, order] })).toBe('Shop | Order');
        expect(
            formatTypeExpression({
                kind: 'intersection',
                members: [{ kind: 'union', members: [shop, order] }, string],
            }),
        ).toBe('(Shop | Order) & string');
    });

    it('formats inline objects with optional and nullable fields', () => {
        expect(formatTypeExpression({ kind: 'object', fields: [] })).toBe('{}');
        expect(
            formatTypeExpression({
                kind: 'object',
                fields: [
                    { name: 'id', type: string, optional: false, nullable: false, constraints: [] },
                    { name: 'note', type: string, optional: true, nullable: true, constraints: [] },
                ],
            }),
        ).toBe('{ id: string; note?: string | null }');
    });
});

describe('findReferences', () => {
    it('flags references reached through collections and alternatives', () => {
        expect(findReferences({ kind: 'array', item: shop })).toEqual([
            { target: 'Shop', many: true, alternative: false },
        ]);
        expect(findReferences({ kind: 'union', members: [shop, string] })).toEqual([
            { target: 'Shop', many: false, alternative: true },
        ]);
    });

    it('finds references inside inline objects', () => {
        const inline: TypeExpression = {
            kind: 'object',
            fields: [{ name: 'shop', type: shop, optional: false, nullable: false, constraints: [] }],
        };
        expect(findReferences(inline)).toEqual([{ target: 'Shop', many: false, alternative: false }]);
    });

    it('returns nothing for leaf types', () => {
        expect(findReferences(string)).toEqual([]);
    });
});
