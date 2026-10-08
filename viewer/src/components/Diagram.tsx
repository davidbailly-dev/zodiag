import type { Edge } from '@xyflow/react';
import { Background, Controls, MarkerType, MiniMap, ReactFlow, useNodesState } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import type { Relation } from '../../../src/domain/index.js';
import { DENSE_RELATION_THRESHOLD } from '../flow/appearance.js';
import { computeLayout } from '../flow/layout.js';
import type { EntityData } from '../flow/model.js';
import { cardinalityLabel } from '../flow/model.js';
import type { EntityFlowNode } from './EntityNode.js';
import { EntityNode } from './EntityNode.js';

const nodeTypes = { entity: EntityNode };

interface DiagramProps {
    entities: readonly EntityData[];
    relations: readonly Relation[];
    collapsed: ReadonlySet<string>;
    colors: ReadonlyMap<string, string>;
    onToggleCollapse(name: string): void;
}

export function Diagram({ entities, relations, collapsed, colors, onToggleCollapse }: DiagramProps) {
    const initialNodes = useMemo(() => {
        const positions = computeLayout(entities, relations, collapsed);
        return entities.map((entity): EntityFlowNode => {
            const color = colors.get(entity.source);
            return {
                id: entity.name,
                type: 'entity',
                position: positions.get(entity.name) ?? { x: 0, y: 0 },
                data: {
                    ...entity,
                    collapsed: collapsed.has(entity.name),
                    ...(color === undefined ? {} : { color }),
                    onToggleCollapse: () => onToggleCollapse(entity.name),
                },
            };
        });
    }, [entities, relations, collapsed, colors, onToggleCollapse]);
    // Positions are owned by React Flow so that entities can be dragged. Folding a card changes the
    // layout, which replaces the positions (the viewport is left alone).
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
    const [selected, setSelected] = useState<string | null>(null);

    const visibleNames = useMemo(() => new Set(entities.map((entity) => entity.name)), [entities]);

    const edges = useMemo(
        () =>
            relations
                .filter((relation) => visibleNames.has(relation.source) && visibleNames.has(relation.target))
                .map((relation): Edge => {
                    const isActive =
                        selected !== null && (relation.source === selected || relation.target === selected);
                    return {
                        id: `${relation.source}.${relation.fieldName}->${relation.target}`,
                        source: relation.source,
                        sourceHandle: relation.fieldName,
                        target: relation.target,
                        targetHandle: 'in',
                        label: cardinalityLabel(relation.cardinality),
                        markerEnd: { type: MarkerType.ArrowClosed },
                        className: [
                            relation.kind === 'inferred' ? 'edge--inferred' : '',
                            selected === null ? '' : isActive ? 'edge--active' : 'edge--dimmed',
                        ]
                            .filter(Boolean)
                            .join(' '),
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
            className={edges.length > DENSE_RELATION_THRESHOLD ? 'diagram diagram--dense' : 'diagram'}
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
