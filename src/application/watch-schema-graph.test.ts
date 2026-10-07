import { describe, expect, it } from 'vitest';
import { SchemaGraph } from '../domain/index.js';
import type { ExtractionResult } from './extract-schema-graph.js';
import type { ChangeWatcher } from './ports/change-watcher.js';
import { WatchSchemaGraph } from './watch-schema-graph.js';

const emptyGraph = SchemaGraph.create([]);
const shopGraph = SchemaGraph.create([{ kind: 'object', name: 'Shop', source: 'shop.ts', fields: [] }]);

// A watcher the test triggers by hand.
function createWatcher() {
    let trigger: () => void = () => undefined;
    let closed = false;
    const watcher: ChangeWatcher = {
        watch: (_target, onChange) => {
            trigger = onChange;
            return { close: () => (closed = true) };
        },
    };
    return { watcher, change: () => trigger(), isClosed: () => closed };
}

function createListener() {
    const updates: ExtractionResult[] = [];
    const errors: string[] = [];
    return {
        updates,
        errors,
        listener: {
            onUpdate: (result: ExtractionResult) => updates.push(result),
            onError: (error: Error) => errors.push(error.message),
        },
    };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('WatchSchemaGraph', () => {
    it('extracts the graph again on each change and hands it to the listener', async () => {
        const { watcher, change } = createWatcher();
        const { listener, updates } = createListener();
        const calls: [string, unknown][] = [];
        const extract = {
            execute: async (target: string, options?: unknown) => {
                calls.push([target, options]);
                return { graph: shopGraph, failures: [] };
            },
        };

        new WatchSchemaGraph(extract, watcher).start('./schemas', { inferRelations: true }, listener);
        expect(calls).toEqual([]);

        change();
        await flush();
        change();
        await flush();

        expect(calls).toEqual([
            ['./schemas', { inferRelations: true }],
            ['./schemas', { inferRelations: true }],
        ]);
        expect(updates).toHaveLength(2);
        expect(updates[0]?.graph).toBe(shopGraph);
    });

    it('never runs two extractions at once and merges the changes that happen meanwhile', async () => {
        const { watcher, change } = createWatcher();
        const { listener, updates } = createListener();
        let active = 0;
        let maxActive = 0;
        let runs = 0;
        const release: (() => void)[] = [];
        const extract = {
            execute: async () => {
                runs += 1;
                active += 1;
                maxActive = Math.max(maxActive, active);
                await new Promise<void>((resolve) => release.push(resolve));
                active -= 1;
                return { graph: shopGraph, failures: [] };
            },
        };
        new WatchSchemaGraph(extract, watcher).start('./schemas', {}, listener);

        change();
        await flush();
        change();
        change();
        change();
        await flush();
        expect(runs).toBe(1);

        release.shift()?.();
        await flush();
        expect(runs).toBe(2);
        release.shift()?.();
        await flush();

        expect(runs).toBe(2);
        expect(maxActive).toBe(1);
        expect(updates).toHaveLength(2);
    });

    it('reports failures and empty results without losing the ability to recover', async () => {
        const { watcher, change } = createWatcher();
        const { listener, updates, errors } = createListener();
        const outcomes: (() => Promise<ExtractionResult>)[] = [
            async () => {
                throw new Error('Target not found: ./schemas');
            },
            async () => ({ graph: emptyGraph, failures: [] }),
            async () => ({ graph: shopGraph, failures: [] }),
        ];
        const extract = {
            execute: async () => {
                const next = outcomes.shift();
                if (!next) {
                    throw new Error('Unexpected extra extraction');
                }
                return next();
            },
        };
        new WatchSchemaGraph(extract, watcher).start('./schemas', {}, listener);

        for (let index = 0; index < 3; index += 1) {
            change();
            await flush();
        }

        expect(errors).toEqual(['Target not found: ./schemas', 'No Zod object or enum schema found in ./schemas']);
        expect(updates).toHaveLength(1);
    });

    it('stops watching and ignores an extraction that finishes afterwards', async () => {
        const { watcher, change, isClosed } = createWatcher();
        const { listener, updates, errors } = createListener();
        let finish: () => void = () => undefined;
        const extract = {
            execute: () =>
                new Promise<ExtractionResult>((resolve) => {
                    finish = () => resolve({ graph: shopGraph, failures: [] });
                }),
        };
        const handle = new WatchSchemaGraph(extract, watcher).start('./schemas', {}, listener);

        change();
        await flush();
        handle.close();
        finish();
        await flush();

        expect(isClosed()).toBe(true);
        expect(updates).toEqual([]);
        expect(errors).toEqual([]);
    });
});
