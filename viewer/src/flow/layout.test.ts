import { describe, expect, it } from 'vitest';
import type { Relation } from '../../../src/domain/index.js';
import { NODE_WIDTH, entityHeight } from './dimensions.js';
import { computeLayout } from './layout.js';
import type { EntityData } from './model.js';

function entity(name: string, fieldCount = 2): EntityData {
    return {
        name,
        source: 'schemas.ts',
        fields: Array.from({ length: fieldCount }, (_, index) => ({
            name: `field${index}`,
            type: 'string',
            optional: false,
            constraints: [],
            linked: false,
        })),
    };
}

const relation = (source: string, target: string): Relation => ({
    source,
    target,
    fieldName: 'link',
    cardinality: 'many',
});

describe('computeLayout', () => {
    it('places an entity above the entities it points to', () => {
        const positions = computeLayout(
            [entity('Order'), entity('OrderLine'), entity('Shop')],
            [relation('Order', 'OrderLine'), relation('Order', 'Shop')],
        );

        const order = positions.get('Order');
        const orderLine = positions.get('OrderLine');
        expect(order).toBeDefined();
        expect(orderLine?.y).toBeGreaterThanOrEqual((order?.y ?? 0) + entityHeight(2));
    });

    it('never overlaps two entities', () => {
        const entities = [entity('A', 12), entity('B', 3), entity('C', 7), entity('D')];
        const positions = computeLayout(entities, [relation('A', 'B'), relation('A', 'C')]);

        const boxes = entities.map((item) => {
            const position = positions.get(item.name);
            return { x: position?.x ?? 0, y: position?.y ?? 0, height: entityHeight(item.fields.length) };
        });
        for (const [index, a] of boxes.entries()) {
            for (const b of boxes.slice(index + 1)) {
                const overlapsHorizontally = a.x < b.x + NODE_WIDTH && b.x < a.x + NODE_WIDTH;
                const overlapsVertically = a.y < b.y + b.height && b.y < a.y + a.height;
                expect(overlapsHorizontally && overlapsVertically).toBe(false);
            }
        }
    });

    it('supports self-references, unknown relation ends and an empty graph', () => {
        expect(computeLayout([entity('Category')], [relation('Category', 'Category')]).size).toBe(1);
        expect(computeLayout([entity('Order')], [relation('Order', 'Hidden')]).size).toBe(1);
        expect(computeLayout([], []).size).toBe(0);
    });
});
