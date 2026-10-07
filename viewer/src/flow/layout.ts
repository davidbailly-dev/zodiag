import { Graph, layout } from '@dagrejs/dagre';
import type { Relation } from '../../../src/domain/index.js';
import { entityHeight, entityWidth } from './dimensions.js';
import type { EntityData } from './model.js';

export type Position = { x: number; y: number };

// Top-to-bottom layered layout: an entity is placed above the entities it points to. Fan-outs such as
// a dataset listing many schemas spread horizontally, which fits a landscape screen better.
// Collapsed entities take less room. Returns the top-left corner of each entity, which is what
// React Flow expects.
export function computeLayout(
    entities: readonly EntityData[],
    relations: readonly Relation[],
    collapsed: ReadonlySet<string> = new Set(),
): Map<string, Position> {
    const graph = new Graph();
    graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 110, marginx: 24, marginy: 24 });
    graph.setDefaultEdgeLabel(() => ({}));

    const heightOf = (entity: EntityData): number => entityHeight(entity.fields.length, collapsed.has(entity.name));
    const widthOf = (entity: EntityData): number => entityWidth(collapsed.has(entity.name));

    for (const entity of entities) {
        graph.setNode(entity.name, { width: widthOf(entity), height: heightOf(entity) });
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
            x: placed.x - widthOf(entity) / 2,
            y: placed.y - heightOf(entity) / 2,
        });
    }
    return positions;
}
