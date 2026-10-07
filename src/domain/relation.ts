export type Cardinality = 'one' | 'zero-or-one' | 'many';

// A link from an object schema to another object schema through one of its fields.
export interface Relation {
    readonly source: string;
    readonly target: string;
    readonly fieldName: string;
    readonly cardinality: Cardinality;
}
