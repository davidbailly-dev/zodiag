import { describe, expect, it } from 'vitest';
import type { Field } from '../domain/index.js';
import { SchemaGraph } from '../domain/index.js';
import { ExtractSchemaGraph } from './extract-schema-graph.js';
import type { LoadedModule, ModuleLoader } from './ports/module-loader.js';
import type { SchemaIntrospector } from './ports/schema-introspector.js';

describe('ExtractSchemaGraph', () => {
    it('adds the inferred relations only when asked to', async () => {
        const field = (name: string): Field => ({
            name,
            type: { kind: 'primitive', name: 'string' },
            optional: false,
            nullable: false,
            constraints: [],
        });
        const graph = SchemaGraph.create([
            { kind: 'object', name: 'Shop', source: 'schemas.ts', fields: [field('id')] },
            { kind: 'object', name: 'Order', source: 'schemas.ts', fields: [field('shopId')] },
        ]);
        const extract = new ExtractSchemaGraph(
            { load: async () => ({ modules: [], failures: [] }) },
            { introspect: () => graph },
        );

        expect((await extract.execute('./schemas')).graph.relations).toEqual([]);
        expect((await extract.execute('./schemas', { inferRelations: false })).graph.relations).toEqual([]);
        const inferred = (await extract.execute('./schemas', { inferRelations: true })).graph.relations;
        expect(inferred.map((relation) => [relation.fieldName, relation.kind])).toEqual([['shopId', 'inferred']]);
    });

    it('introspects the loaded modules and reports the load failures', async () => {
        const modules: LoadedModule[] = [{ filePath: 'shop.ts', exports: {} }];
        const failures = [{ filePath: 'broken.ts', message: 'boom' }];
        const graph = SchemaGraph.create([]);

        const loadedTargets: string[] = [];
        const loader: ModuleLoader = {
            load: async (target) => {
                loadedTargets.push(target);
                return { modules, failures };
            },
        };
        const introspectedModules: (readonly LoadedModule[])[] = [];
        const introspector: SchemaIntrospector = {
            introspect: (received) => {
                introspectedModules.push(received);
                return graph;
            },
        };

        const result = await new ExtractSchemaGraph(loader, introspector).execute('./schemas');

        expect(loadedTargets).toEqual(['./schemas']);
        expect(introspectedModules).toEqual([modules]);
        expect(result).toEqual({ graph, failures });
    });
});
