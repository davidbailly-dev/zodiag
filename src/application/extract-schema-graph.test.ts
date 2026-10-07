import { describe, expect, it } from 'vitest';
import { SchemaGraph } from '../domain/index.js';
import { ExtractSchemaGraph } from './extract-schema-graph.js';
import type { LoadedModule, ModuleLoader } from './ports/module-loader.js';
import type { SchemaIntrospector } from './ports/schema-introspector.js';

describe('ExtractSchemaGraph', () => {
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
