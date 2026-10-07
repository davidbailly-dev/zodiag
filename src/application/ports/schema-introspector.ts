import type { SchemaGraph } from '../../domain/index.js';
import type { LoadedModule } from './module-loader.js';

export interface SchemaIntrospector {
    introspect(modules: readonly LoadedModule[]): SchemaGraph;
}
