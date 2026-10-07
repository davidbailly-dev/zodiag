import { describe, expect, it } from 'vitest';
import { AUTO_COLLAPSE_THRESHOLD, collapseNewcomers, initiallyCollapsed, sourceColors } from './appearance.js';

const names = (count: number) => Array.from({ length: count }, (_, index) => `Entity${index}`);

describe('initiallyCollapsed', () => {
    it('keeps small graphs expanded', () => {
        expect(initiallyCollapsed(names(AUTO_COLLAPSE_THRESHOLD)).size).toBe(0);
    });

    it('collapses every card of a large graph', () => {
        const all = names(AUTO_COLLAPSE_THRESHOLD + 1);

        expect([...initiallyCollapsed(all)]).toEqual(all);
    });
});

describe('collapseNewcomers', () => {
    it('collapses the new cards of a large graph and keeps the existing choices', () => {
        const result = collapseNewcomers(new Set(['Old']), ['New'], AUTO_COLLAPSE_THRESHOLD + 1);

        expect([...result].sort()).toEqual(['New', 'Old']);
    });

    it('leaves the new cards of a small graph expanded', () => {
        expect([...collapseNewcomers(new Set(['Old']), ['New'], 3)]).toEqual(['Old']);
    });
});

describe('sourceColors', () => {
    it('gives no color when there is a single source', () => {
        expect(sourceColors(['schemas.ts']).size).toBe(0);
        expect(sourceColors([]).size).toBe(0);
    });

    it('gives each source its own color', () => {
        const colors = sourceColors(['order.ts', 'shop.ts', 'user.ts', 'billing.ts', 'stock.ts']);

        expect(colors.size).toBe(5);
        expect(new Set(colors.values()).size).toBe(5);
        expect(colors.get('order.ts')).toMatch(/^hsl\(\d+ 55% 50%\)$/);
    });

    it('is stable for the same sources', () => {
        const sources = ['a.ts', 'b.ts', 'c.ts'];

        expect(sourceColors(sources)).toEqual(sourceColors(sources));
    });
});
