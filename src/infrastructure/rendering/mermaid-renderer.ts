import type { GraphRenderer } from '../../application/ports/graph-renderer.js';
import { findReferences, formatTypeExpression } from '../../domain/index.js';
import type { Cardinality, EnumNode, Field, ObjectNode, SchemaGraph } from '../../domain/index.js';

// Right-hand side of a relation: "a source has one / zero or one / zero or more targets".
const CARDINALITY_SYMBOLS: Record<Cardinality, string> = {
    one: '||',
    'zero-or-one': 'o|',
    many: 'o{',
};

// Renders a SchemaGraph as a Mermaid `erDiagram`. Object schemas become entities and relations
// become links; enums have no Mermaid equivalent, so they appear as attribute types and their
// values are listed in the attribute comment.
export class MermaidRenderer implements GraphRenderer {
    render(graph: SchemaGraph): string {
        const enums = new Map<string, EnumNode>();
        for (const node of graph.nodes) {
            if (node.kind === 'enum') {
                enums.set(node.name, node);
            }
        }

        const lines = ['erDiagram'];
        for (const node of graph.nodes) {
            if (node.kind === 'object') {
                lines.push(...renderEntity(node, enums));
            }
        }
        for (const relation of graph.relations) {
            const symbol = CARDINALITY_SYMBOLS[relation.cardinality];
            lines.push(
                `    ${toIdentifier(relation.source)} ||--${symbol} ${toIdentifier(relation.target)} : "${relation.fieldName}"`,
            );
        }
        return `${lines.join('\n')}\n`;
    }
}

function renderEntity(node: ObjectNode, enums: ReadonlyMap<string, EnumNode>): string[] {
    const name = toIdentifier(node.name);
    if (node.fields.length === 0) {
        return [`    ${name}`];
    }
    return [
        `    ${name} {`,
        ...node.fields.map((field) => {
            const comment = describeField(field, enums);
            const suffix = comment === '' ? '' : ` "${comment}"`;
            return `        ${toMermaidType(field)} ${toIdentifier(field.name)}${suffix}`;
        }),
        '    }',
    ];
}

function describeField(field: Field, enums: ReadonlyMap<string, EnumNode>): string {
    const parts: string[] = [];
    if (field.description !== undefined) {
        parts.push(field.description);
    }
    if (field.optional) {
        parts.push('optional');
    }
    parts.push(...field.constraints);
    for (const { target } of findReferences(field.type)) {
        const enumNode = enums.get(target);
        if (enumNode !== undefined) {
            parts.push(`one of: ${enumNode.values.join(' | ')}`);
        }
    }
    return parts.join(', ').replaceAll('"', "'").replace(/\s+/g, ' ');
}

// Mermaid attribute types only accept letters, digits, `_`, `-`, brackets and parentheses, so a type
// such as `"a" | "b"` or `Record<string, boolean>` is flattened into an identifier-like label.
function toMermaidType(field: Field): string {
    const type = `${formatTypeExpression(field.type)}${field.nullable ? ' | null' : ''}`;
    const flattened = type
        .replace(/\s*\|\s*/g, '_or_')
        .replace(/\s*&\s*/g, '_and_')
        .replace(/[^A-Za-z0-9_\-[\]()]+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');
    if (flattened === '') {
        return 'unknown';
    }
    return /^[A-Za-z_]/.test(flattened) ? flattened : `_${flattened}`;
}

function toIdentifier(name: string): string {
    const identifier = name.replace(/[^A-Za-z0-9_-]/g, '_');
    return /^[A-Za-z_]/.test(identifier) ? identifier : `_${identifier}`;
}
