import type { SchemaGraph } from '../../src/domain/index.js';

// What the server sends: the plain data of a SchemaGraph.
export type GraphData = Pick<SchemaGraph, 'nodes' | 'relations'>;

export async function fetchGraph(): Promise<GraphData> {
    const response = await fetch('/graph.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Could not load the schema graph (HTTP ${response.status})`);
    }
    return (await response.json()) as GraphData;
}
