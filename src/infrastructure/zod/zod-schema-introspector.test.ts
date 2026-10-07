import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { LoadedModule } from '../../application/ports/module-loader.js';
import type { ObjectNode } from '../../domain/index.js';
import { formatTypeExpression } from '../../domain/index.js';
import { ZodSchemaIntrospector } from './zod-schema-introspector.js';

function introspect(exports: Record<string, unknown>, filePath = 'schemas.ts') {
    return new ZodSchemaIntrospector().introspect([{ filePath, exports }]);
}

function objectNode(graph: ReturnType<typeof introspect>, name: string): ObjectNode {
    const node = graph.findNode(name);
    if (node?.kind !== 'object') {
        throw new Error(`Expected an object node named ${name}`);
    }
    return node;
}

function fieldOf(node: ObjectNode, name: string) {
    const field = node.fields.find((candidate) => candidate.name === name);
    if (field === undefined) {
        throw new Error(`Expected a field named ${name}`);
    }
    return field;
}

describe('ZodSchemaIntrospector', () => {
    it('creates one node per exported object or enum schema and strips the Schema suffix', () => {
        const graph = introspect({
            ShopSchema: z.object({ id: z.string() }),
            StatusSchema: z.enum(['open', 'closed']),
            ShopListSchema: z.array(z.string()),
            notASchema: 42,
        });

        expect(graph.nodes.map((node) => [node.name, node.kind])).toEqual([
            ['Shop', 'object'],
            ['Status', 'enum'],
        ]);
        expect(graph.findNode('Status')).toMatchObject({ values: ['open', 'closed'], source: 'schemas.ts' });
    });

    it('turns fields that point to exported schemas into references and relations', () => {
        const ShopSchema = z.object({ id: z.string() });
        const OrderLineSchema = z.object({ quantity: z.number() });
        const StatusSchema = z.enum(['open', 'closed']);
        const OrderSchema = z.object({
            shop: ShopSchema,
            lines: z.array(OrderLineSchema).min(1),
            status: StatusSchema,
        });
        const graph = introspect({ ShopSchema, OrderLineSchema, StatusSchema, OrderSchema });

        const order = objectNode(graph, 'Order');
        expect(order.fields.map((field) => [field.name, formatTypeExpression(field.type)])).toEqual([
            ['shop', 'Shop'],
            ['lines', 'OrderLine[]'],
            ['status', 'Status'],
        ]);
        expect(fieldOf(order, 'lines').constraints).toEqual(['min 1']);
        expect(graph.relations).toEqual([
            { source: 'Order', target: 'Shop', fieldName: 'shop', kind: 'explicit', cardinality: 'one' },
            { source: 'Order', target: 'OrderLine', fieldName: 'lines', kind: 'explicit', cardinality: 'many' },
        ]);
    });

    it('resolves exported aliases where they are used instead of creating nodes', () => {
        const ShopSchema = z.object({ id: z.string() });
        const ShopListSchema = z.array(ShopSchema);
        const DatasetSchema = z.object({ shops: ShopListSchema });
        const graph = introspect({ ShopSchema, ShopListSchema, DatasetSchema });

        expect(graph.nodes.map((node) => node.name)).toEqual(['Shop', 'Dataset']);
        expect(formatTypeExpression(fieldOf(objectNode(graph, 'Dataset'), 'shops').type)).toBe('Shop[]');
    });

    it('detects optional, nullable and defaulted fields', () => {
        const graph = introspect({
            ItemSchema: z.object({
                plain: z.string(),
                optional: z.string().optional(),
                nullable: z.string().nullable(),
                withDefault: z.number().default(1),
                both: z.string().nullable().optional(),
                required: z.string().optional().nonoptional(),
            }),
        });
        const item = objectNode(graph, 'Item');
        const flags = (name: string) => {
            const { optional, nullable } = fieldOf(item, name);
            return { optional, nullable };
        };

        expect(flags('plain')).toEqual({ optional: false, nullable: false });
        expect(flags('optional')).toEqual({ optional: true, nullable: false });
        expect(flags('nullable')).toEqual({ optional: false, nullable: true });
        expect(flags('withDefault')).toEqual({ optional: true, nullable: false });
        expect(flags('both')).toEqual({ optional: true, nullable: true });
        expect(flags('required')).toEqual({ optional: false, nullable: false });
    });

    it('keeps a reference when an exported schema is wrapped as optional', () => {
        const ShopSchema = z.object({ id: z.string() });
        const OrderSchema = z.object({ shop: ShopSchema.optional() });
        const graph = introspect({ ShopSchema, OrderSchema });

        expect(graph.relations).toEqual([
            { source: 'Order', target: 'Shop', fieldName: 'shop', kind: 'explicit', cardinality: 'zero-or-one' },
        ]);
    });

    it('reads constraints from checks and standalone formats', () => {
        const graph = introspect({
            ProductSchema: z.object({
                price: z.number().positive(),
                stock: z.number().int().nonnegative(),
                email: z.string().email(),
                code: z.string().min(2).max(8),
                rate: z.number().min(0).max(1),
                contact: z.email(),
                count: z.int(),
                free: z.string(),
            }),
        });
        const product = objectNode(graph, 'Product');

        expect(fieldOf(product, 'price').constraints).toEqual(['> 0']);
        expect(fieldOf(product, 'stock').constraints).toEqual(['int', '>= 0']);
        expect(fieldOf(product, 'email').constraints).toEqual(['email']);
        expect(fieldOf(product, 'code').constraints).toEqual(['min 2', 'max 8']);
        expect(fieldOf(product, 'rate').constraints).toEqual(['>= 0', '<= 1']);
        expect(fieldOf(product, 'contact').constraints).toEqual(['email']);
        expect(fieldOf(product, 'count').constraints).toEqual(['int']);
        expect(fieldOf(product, 'free').constraints).toEqual([]);
    });

    it('resolves spread shapes, extend and pick', () => {
        const shared = { path: z.string(), views: z.number() };
        const PageSchema = z.object(shared);
        const PageRowSchema = z.object({ date: z.string(), ...shared });
        const ExtendedSchema = PageSchema.extend({ title: z.string() });
        const PickedSchema = ExtendedSchema.pick({ title: true });
        const graph = introspect({ PageSchema, PageRowSchema, ExtendedSchema, PickedSchema });
        const names = (node: string) => objectNode(graph, node).fields.map((field) => field.name);

        expect(names('Page')).toEqual(['path', 'views']);
        expect(names('PageRow')).toEqual(['date', 'path', 'views']);
        expect(names('Extended')).toEqual(['path', 'views', 'title']);
        expect(names('Picked')).toEqual(['title']);
    });

    it('describes inline structures, unions, literals and records', () => {
        const graph = introspect({
            MixedSchema: z.object({
                inline: z.object({ lat: z.number(), lng: z.number().optional() }),
                choice: z.union([z.string(), z.number()]),
                kind: z.literal('mixed'),
                inlineEnum: z.enum(['a', 'b']),
                tags: z.record(z.string(), z.boolean()),
                pair: z.tuple([z.string(), z.number()]),
                ids: z.set(z.string()),
                date: z.date(),
                piped: z.string().transform((value) => value.length),
            }),
        });
        const mixed = objectNode(graph, 'Mixed');
        const formatted = (name: string) => formatTypeExpression(fieldOf(mixed, name).type);

        expect(formatted('inline')).toBe('{ lat: number; lng?: number }');
        expect(formatted('choice')).toBe('string | number');
        expect(formatted('kind')).toBe('"mixed"');
        expect(formatted('inlineEnum')).toBe('"a" | "b"');
        expect(formatted('tags')).toBe('Record<string, boolean>');
        expect(formatted('pair')).toBe('[string, number]');
        expect(formatted('ids')).toBe('string[]');
        expect(formatted('date')).toBe('date');
        expect(formatted('piped')).toBe('string');
    });

    it('resolves lazy references to exported schemas and survives recursive structures', () => {
        type Category = { name: string; children: Category[] };
        const CategorySchema: z.ZodType<Category> = z.object({
            name: z.string(),
            get children() {
                return z.array(CategorySchema);
            },
        });
        const Node: z.ZodType = z.object({
            value: z.string(),
            next: z.lazy(() => Node).optional(),
        });
        const graph = introspect({ CategorySchema, NodeSchema: Node });

        expect(formatTypeExpression(fieldOf(objectNode(graph, 'Category'), 'children').type)).toBe('Category[]');
        expect(fieldOf(objectNode(graph, 'Node'), 'next')).toMatchObject({ optional: true });
        expect(graph.relations).toContainEqual({
            source: 'Category',
            target: 'Category',
            fieldName: 'children',
            kind: 'explicit', cardinality: 'many',
        });
    });

    it('does not loop on a recursive structure that is not exported', () => {
        type Tree = { children: Tree[] };
        const tree: z.ZodType<Tree> = z.object({
            get children() {
                return z.array(tree);
            },
        });
        const graph = introspect({ RootSchema: z.object({ tree }) });

        expect(formatTypeExpression(fieldOf(objectNode(graph, 'Root'), 'tree').type)).toBe('{ children: recursive[] }');
    });

    it('keeps descriptions', () => {
        const graph = introspect({
            ShopSchema: z.object({ id: z.string().describe('Unique identifier') }).describe('A shop'),
        });

        expect(graph.findNode('Shop')).toMatchObject({ description: 'A shop' });
        expect(fieldOf(objectNode(graph, 'Shop'), 'id').description).toBe('Unique identifier');
    });

    it('registers a schema exported under two names only once', () => {
        const ShopSchema = z.object({ id: z.string() });
        const graph = introspect({ ShopSchema, AliasSchema: ShopSchema });

        expect(graph.nodes.map((node) => node.name)).toEqual(['Shop']);
    });

    it('disambiguates colliding names with the file name', () => {
        const modules: LoadedModule[] = [
            { filePath: 'billing/item.ts', exports: { ItemSchema: z.object({ price: z.number() }) } },
            { filePath: 'stock/item.ts', exports: { ItemSchema: z.object({ sku: z.string() }) } },
        ];
        const graph = new ZodSchemaIntrospector().introspect(modules);

        expect(graph.nodes.map((node) => [node.name, node.source])).toEqual([
            ['Item', 'billing/item.ts'],
            ['item.Item', 'stock/item.ts'],
        ]);
    });

    it('links schemas across files', () => {
        const ShopSchema = z.object({ id: z.string() });
        const OrderSchema = z.object({ shop: ShopSchema });
        const graph = new ZodSchemaIntrospector().introspect([
            { filePath: 'shop.ts', exports: { ShopSchema } },
            { filePath: 'order.ts', exports: { OrderSchema } },
        ]);

        expect(graph.relations).toEqual([
            { source: 'Order', target: 'Shop', fieldName: 'shop', kind: 'explicit', cardinality: 'one' },
        ]);
    });
});
