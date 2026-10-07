import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { BODY_PADDING, HEADER_HEIGHT, ROW_HEIGHT, entityHeight } from '../flow/dimensions.js';
import type { EntityData } from '../flow/model.js';

export type EntityFlowNode = Node<EntityData, 'entity'>;

export function EntityNode({ data }: NodeProps<EntityFlowNode>) {
    return (
        <div className="entity" style={{ height: entityHeight(data.fields.length) }}>
            <header className="entity__header" style={{ height: HEADER_HEIGHT }} title={data.description}>
                <Handle type="target" position={Position.Top} id="in" />
                <span className="entity__name">{data.name}</span>
                <span className="entity__source">{data.source}</span>
            </header>
            <ul className="entity__fields" style={{ paddingBlock: BODY_PADDING / 2 }}>
                {data.fields.map((field) => (
                    <li key={field.name} className="field" style={{ height: ROW_HEIGHT }} title={field.description}>
                        <span className={field.optional ? 'field__name field__name--optional' : 'field__name'}>
                            {field.name}
                            {field.optional ? '?' : ''}
                        </span>
                        <span
                            className={field.enumValues === undefined ? 'field__type' : 'field__type field__type--enum'}
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
        </div>
    );
}
