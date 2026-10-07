import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { BODY_PADDING, entityHeight, entityWidth, HEADER_HEIGHT, ROW_HEIGHT } from '../flow/dimensions.js';
import type { EntityData } from '../flow/model.js';

export type EntityNodeData = EntityData & {
    collapsed: boolean;
    // Accent of the source file, when the schemas come from several files.
    color?: string;
    onToggleCollapse(): void;
};

export type EntityFlowNode = Node<EntityNodeData, 'entity'>;

export function EntityNode({ data }: NodeProps<EntityFlowNode>) {
    const linkedFields = data.fields.filter((field) => field.linked);

    return (
        <div
            className="entity"
            style={{ width: entityWidth(data.collapsed), height: entityHeight(data.fields.length, data.collapsed) }}
        >
            <header
                className={data.collapsed ? 'entity__header entity__header--collapsed' : 'entity__header'}
                style={{
                    height: HEADER_HEIGHT,
                    ...(data.color === undefined ? {} : { borderLeft: `4px solid ${data.color}` }),
                }}
                title={data.description}
            >
                <Handle type="target" position={Position.Top} id="in" />
                <span className="entity__name">{data.name}</span>
                <span className="entity__source">
                    {data.source}
                    {data.collapsed && ` · ${data.fields.length} field${data.fields.length === 1 ? '' : 's'}`}
                </span>
                <button
                    type="button"
                    className="entity__toggle nodrag"
                    aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} ${data.name}`}
                    aria-expanded={!data.collapsed}
                    onClick={(event) => {
                        // Folding a card must not select it.
                        event.stopPropagation();
                        data.onToggleCollapse();
                    }}
                >
                    {data.collapsed ? '▸' : '▾'}
                </button>
                {/* A collapsed card has no rows, so the links start from its header instead. */}
                {data.collapsed &&
                    linkedFields.map((field) => (
                        <Handle key={field.name} type="source" position={Position.Right} id={field.name} />
                    ))}
            </header>
            {!data.collapsed && (
                <ul className="entity__fields" style={{ paddingBlock: BODY_PADDING / 2 }}>
                    {data.fields.map((field) => (
                        <li key={field.name} className="field" style={{ height: ROW_HEIGHT }} title={field.description}>
                            <span className={field.optional ? 'field__name field__name--optional' : 'field__name'}>
                                {field.name}
                                {field.optional ? '?' : ''}
                            </span>
                            <span
                                className={
                                    field.enumValues === undefined ? 'field__type' : 'field__type field__type--enum'
                                }
                                title={field.enumValues?.join(' | ')}
                            >
                                {field.type}
                            </span>
                            {field.constraints.length > 0 && (
                                <span className="field__constraints" title={field.constraints.join(', ')}>
                                    {field.constraints.join(', ')}
                                </span>
                            )}
                            {field.linked && <Handle type="source" position={Position.Right} id={field.name} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
