import { describe, expect, it } from 'vitest';
import { SchemaGraph } from '../../domain/index.js';
import type { Field, ObjectNode, SchemaNode, TypeExpression } from '../../domain/index.js';
import { MermaidRenderer } from './mermaid-renderer.js';

const string: TypeExpression = { kind: 'primitive', name: 'string' };
const number: TypeExpression = { kind: 'primitive', name: 'number' };
const ref = (target: string): TypeExpression => ({ kind: 'reference', target });

function field(name: string, type: TypeExpression, overrides: Partial<Field> = {}): Field {
    return { name, type, optional: false, nullable: false, constraints: [], ...overrides };
}

function objectNode(name: string, fields: Field[]): ObjectNode {
    return { kind: 'object', name, source: 'schemas.ts', fields };
}

function render(nodes: SchemaNode[]): string {
    return new MermaidRenderer().render(SchemaGraph.create(nodes));
}

function attributeLines(output: string): string[] {
    return output
        .split('\n')
        .filter((line) => line.startsWith('        '))
        .map((line) => line.trim());
}

describe('MermaidRenderer', () => {
    it('renders entities, attribute comments and relations', () => {
        const output = render([
            objectNode('Shop', [field('id', string, { description: 'Unique id' })]),
            { kind: 'enum', name: 'Status', source: 'schemas.ts', values: ['open', 'closed'] },
            objectNode('Order', [
                field('shop', ref('Shop')),
                field('status', ref('Status')),
                field('lines', { kind: 'array', item: ref('OrderLine') }, { constraints: ['min 1'] }),
                field('note', string, { optional: true, nullable: true }),
            ]),
            objectNode('OrderLine', [field('quantity', number, { constraints: ['int', '> 0'] })]),
        ]);

        expect(output).toBe(
            [
                'erDiagram',
                '    Shop {',
                '        string id "Unique id"',
                '    }',
                '    Order {',
                '        Shop shop',
                '        Status status "one of: open | closed"',
                '        OrderLine[] lines "min 1"',
                '        string_or_null note "optional"',
                '    }',
                '    OrderLine {',
                '        number quantity "int, > 0"',
                '    }',
                '    Order ||--|| Shop : "shop"',
                '    Order ||--o{ OrderLine : "lines"',
                '',
            ].join('\n'),
        );
    });

    it('maps every cardinality to a Mermaid symbol', () => {
        const output = render([
            objectNode('Shop', []),
            objectNode('Order', [
                field('shop', ref('Shop')),
                field('referrer', ref('Shop'), { optional: true }),
                field('shops', { kind: 'array', item: ref('Shop') }),
            ]),
        ]);

        expect(output).toContain('Order ||--|| Shop : "shop"');
        expect(output).toContain('Order ||--o| Shop : "referrer"');
        expect(output).toContain('Order ||--o{ Shop : "shops"');
    });

    it('draws inferred relations with a dashed line', () => {
        const graph = SchemaGraph.create([
            objectNode('Shop', [field('id', string)]),
            objectNode('Order', [field('shopId', string)]),
        ]).withInferredRelations();

        expect(new MermaidRenderer().render(graph)).toContain('Order ||..|| Shop : "shopId"');
    });

    it('flattens complex types into valid Mermaid attribute types', () => {
        const output = render([
            objectNode('Mixed', [
                field('choice', { kind: 'union', members: [string, number] }),
                field('kind', { kind: 'union', members: [{ kind: 'literal', value: 'a' }, { kind: 'literal', value: 'b' }] }),
                field('tags', { kind: 'record', key: string, value: { kind: 'primitive', name: 'boolean' } }),
                field('pair', { kind: 'tuple', items: [string, number] }),
                field('count', { kind: 'literal', value: 3 }),
                field('inline', { kind: 'object', fields: [field('a', string)] }),
            ]),
        ]);

        expect(attributeLines(output)).toEqual([
            'string_or_number choice',
            'a_or_b kind',
            'Record_string_boolean tags',
            '_[string_number] pair',
            '_3 count',
            'a_string inline',
        ]);
    });

    it('sanitizes names and quotes that Mermaid would reject', () => {
        const output = render([
            objectNode('item.Item', [field('2fast', string, { description: 'say "hi"' })]),
            objectNode('Other', [field('item', ref('item.Item'))]),
        ]);

        expect(output).toContain('    item_Item {');
        expect(output).toContain('string _2fast "say \'hi\'"');
        expect(output).toContain('Other ||--|| item_Item : "item"');
    });

    it('renders an object without fields as a bare entity', () => {
        expect(render([objectNode('Empty', [])])).toBe('erDiagram\n    Empty\n');
    });
});
