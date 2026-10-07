import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtractSchemaGraph } from '../application/extract-schema-graph.js';
import { JitiModuleLoader } from './jiti-module-loader.js';
import { ZodSchemaIntrospector } from './zod/zod-schema-introspector.js';

const fixtures = path.resolve(import.meta.dirname, '../../tests/fixtures');

describe('JitiModuleLoader', () => {
    it('loads every TypeScript file of a directory, barrel files last', async () => {
        const { modules, failures } = await new JitiModuleLoader().load(path.join(fixtures, 'shop'));

        expect(failures).toEqual([]);
        expect(modules.map((module) => module.filePath)).toEqual([
            'order.ts',
            'orderLine.ts',
            'shop.ts',
            'index.ts',
        ]);
        expect(Object.keys(modules[0]?.exports ?? {})).toContain('OrderSchema');
    });

    it('loads a single file', async () => {
        const { modules } = await new JitiModuleLoader().load(path.join(fixtures, 'shop/shop.ts'));

        expect(modules.map((module) => module.filePath)).toEqual(['shop.ts']);
    });

    it('reports files that fail to load and keeps the others', async () => {
        const { modules, failures } = await new JitiModuleLoader().load(path.join(fixtures, 'broken'));

        expect(modules.map((module) => module.filePath)).toEqual(['valid.ts']);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatchObject({ filePath: 'broken.ts' });
        expect(failures[0]?.message).toContain('Cannot load this module');
    });

    it('reads a modified file again on the next load, even one imported by another file', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'zodiac-reload-'));
        try {
            await writeFile(path.join(directory, 'shared.ts'), 'export const shared = 1;');
            await writeFile(path.join(directory, 'main.ts'), "import { shared } from './shared';\nexport const value = shared;");
            const loader = new JitiModuleLoader();
            const valueOf = async () => {
                const { modules } = await loader.load(directory);
                return modules.find((module) => module.filePath === 'main.ts')?.exports['value'];
            };

            expect(await valueOf()).toBe(1);

            await writeFile(path.join(directory, 'shared.ts'), 'export const shared = 2;');
            expect(await valueOf()).toBe(2);
        } finally {
            await rm(directory, { recursive: true });
        }
    });

    it('rejects a target that does not exist', async () => {
        await expect(new JitiModuleLoader().load(path.join(fixtures, 'missing'))).rejects.toThrow('Target not found');
    });
});

describe('schema extraction from files', () => {
    it('builds a graph across several files and attributes schemas to their defining file', async () => {
        const extract = new ExtractSchemaGraph(new JitiModuleLoader(), new ZodSchemaIntrospector());

        const { graph, failures } = await extract.execute(path.join(fixtures, 'shop'));

        expect(failures).toEqual([]);
        expect(graph.nodes.map((node) => [node.name, node.kind, node.source])).toEqual([
            ['Order', 'object', 'order.ts'],
            ['OrderStatus', 'enum', 'order.ts'],
            ['OrderLine', 'object', 'orderLine.ts'],
            ['Shop', 'object', 'shop.ts'],
        ]);
        expect(graph.relations).toEqual([
            { source: 'Order', target: 'Shop', fieldName: 'shop', kind: 'explicit', cardinality: 'one' },
            { source: 'Order', target: 'OrderLine', fieldName: 'lines', kind: 'explicit', cardinality: 'many' },
        ]);
    });
});
