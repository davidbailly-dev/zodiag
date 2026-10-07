import {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    ReactFlow,
    useNodesState,
} from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import { useMemo, useState } from 'react';
import type { Relation } from '../../../src/domain/index.js';
import { computeLayout } from '../flow/layout.js';
import { cardinalityLabel } from '../flow/model.js';
import type { EntityData } from '../flow/model.js';
import { EntityNode } from './EntityNode.js';
import type { EntityFlowNode } from './EntityNode.js';

const nodeTypes = { entity: EntityNode };

interface DiagramProps {
    entities: readonly EntityData[];
    relations: readonly Relation[];
}

export function Diagram({ entities, relations }: DiagramProps) {
    const initialNodes = useMemo(() => {
        const positions = computeLayout(entities, relations);
        return entities.map(
            (entity): EntityFlowNode => ({
                id: entity.name,
                type: 'entity',
                position: positions.get(entity.name) ?? { x: 0, y: 0 },
                data: entity,
            }),
        );
    }, [entities, relations]);
    // Positions are owned by React Flow so that entities can be dragged.
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [selected, setSelected] = useState<string | null>(null);

    const visibleNames = useMemo(() => new Set(entities.map((entity) => entity.name)), [entities]);

    const edges = useMemo(
        () =>
            relations
                .filter((relation) => visibleNames.has(relation.source) && visibleNames.has(relation.target))
                .map((relation): Edge => {
                    const isActive = selected !== null && (relation.source === selected || relation.target === selected);
                    return {
                        id: `${relation.source}.${relation.fieldName}->${relation.target}`,
                        source: relation.source,
                        sourceHandle: relation.fieldName,
                        target: relation.target,
                        targetHandle: 'in',
                        label: cardinalityLabel(relation.cardinality),
                        markerEnd: { type: MarkerType.ArrowClosed },
                        className: selected === null ? '' : isActive ? 'edge--active' : 'edge--dimmed',
                    };
                }),
        [relations, visibleNames, selected],
    );

    const displayedNodes = useMemo(() => {
        if (selected === null) {
            return nodes;
        }
        const connected = new Set([selected]);
        for (const edge of edges) {
            if (edge.source === selected || edge.target === selected) {
                connected.add(edge.source);
                connected.add(edge.target);
            }
        }
        return nodes.map((node) => ({ ...node, className: connected.has(node.id) ? '' : 'entity--dimmed' }));
    }, [nodes, edges, selected]);

    return (
        <ReactFlow
            nodes={displayedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_event, node) => setSelected((current) => (current === node.id ? null : node.id))}
            onPaneClick={() => setSelected(null)}
            nodesConnectable={false}
            elementsSelectable={false}
            colorMode="system"
            minZoom={0.05}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            proOptions={{ hideAttribution: true }}
        >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
        </ReactFlow>
    );
}
