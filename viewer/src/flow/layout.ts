import { Graph, layout } from '@dagrejs/dagre';
import type { Relation } from '../../../src/domain/index.js';
import { NODE_WIDTH, entityHeight } from './dimensions.js';
import type { EntityData } from './model.js';

export type Position = { x: number; y: number };

// Top-to-bottom layered layout: an entity is placed above the entities it points to. Fan-outs such as
// a dataset listing many schemas spread horizontally, which fits a landscape screen better.
// Returns the top-left corner of each entity, which is what React Flow expects.
export function computeLayout(
    entities: readonly EntityData[],
    relations: readonly Relation[],
): Map<string, Position> {
    const graph = new Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 110, marginx: 24, marginy: 24 });
    graph.setDefaultEdgeLabel(() => ({}));

    for (const entity of entities) {
        graph.setNode(entity.name, { width: NODE_WIDTH, height: entityHeight(entity.fields.length) });
    }
    for (const relation of relations) {
        // Self-references do not influence the ranking.
        if (relation.source !== relation.target && graph.hasNode(relation.source) && graph.hasNode(relation.target)) {
            graph.setEdge(relation.source, relation.target);
        }
    }
    layout(graph);

    const positions = new Map<string, Position>();
    for (const entity of entities) {
        const placed = graph.node(entity.name);
        positions.set(entity.name, {
            x: placed.x - NODE_WIDTH / 2,
            y: placed.y - entityHeight(entity.fields.length) / 2,
        });
    }
    return positions;
}
