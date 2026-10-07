import type { Field } from './field.js';

interface BaseNode {
    readonly name: string;
    // Path of the file that exports the schema, relative to the analyzed target.
    readonly source: string;
    readonly description?: string;
}

export interface ObjectNode extends BaseNode {
    readonly kind: 'object';
    readonly fields: readonly Field[];
}

export interface EnumNode extends BaseNode {
    readonly kind: 'enum';
    readonly values: readonly (string | number)[];
}

export type SchemaNode = ObjectNode | EnumNode;
