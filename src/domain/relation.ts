export type Cardinality = 'one' | 'zero-or-one' | 'many';

// `explicit`: the field holds the target schema itself (`shop: ShopSchema`).
// `inferred`: guessed from a naming convention (`shopId: z.string()` points to `Shop`).
export type RelationKind = 'explicit' | 'inferred';

// A link from an object schema to another object schema through one of its fields.
export interface Relation {
    readonly source: string;
    readonly target: string;
    readonly fieldName: string;
    readonly cardinality: Cardinality;
    readonly kind: RelationKind;
}
