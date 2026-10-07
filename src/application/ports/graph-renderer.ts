import type { SchemaGraph } from '../../domain/index.js';

export interface GraphRenderer {
    render(graph: SchemaGraph): string;
}
