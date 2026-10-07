import type { SchemaGraph } from '../domain/index.js';
import type { LoadFailure, ModuleLoader } from './ports/module-loader.js';
import type { SchemaIntrospector } from './ports/schema-introspector.js';

export interface ExtractionOptions {
    // Link fields such as `shopId` to the `Shop` schema.
    readonly inferRelations?: boolean;
}

export interface ExtractionResult {
    readonly graph: SchemaGraph;
    // Files that could not be loaded; the graph is built from the others.
    readonly failures: readonly LoadFailure[];
}

export class ExtractSchemaGraph {
    private readonly loader: ModuleLoader;
    private readonly introspector: SchemaIntrospector;

    constructor(loader: ModuleLoader, introspector: SchemaIntrospector) {
        this.loader = loader;
        this.introspector = introspector;
    }

    async execute(target: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
        const { modules, failures } = await this.loader.load(target);
        const graph = this.introspector.introspect(modules);
        return { graph: options.inferRelations === true ? graph.withInferredRelations() : graph, failures };
    }
}
