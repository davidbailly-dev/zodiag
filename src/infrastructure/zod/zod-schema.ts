// Minimal structural view of a Zod 4 schema. The analyzed project ships its own copy of Zod, so
// `instanceof` can never match: schemas are recognized by the shape of their internals instead.

export interface ZodDef {
    readonly type: string;
    readonly [key: string]: unknown;
}

export interface ZodSchema {
    readonly _zod: { readonly def: ZodDef };
    readonly description?: string | undefined;
}

export function isZodSchema(value: unknown): value is ZodSchema {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const internals = (value as { _zod?: unknown })._zod;
    if (typeof internals !== 'object' || internals === null) {
        return false;
    }
    const def = (internals as { def?: unknown }).def;
    return typeof def === 'object' && def !== null && typeof (def as { type?: unknown }).type === 'string';
}

export function schemaAt(def: ZodDef, key: string): ZodSchema {
    const value = def[key];
    if (!isZodSchema(value)) {
        throw new Error(`Expected a Zod schema at "${key}" in a "${def.type}" definition`);
    }
    return value;
}

export function schemaListAt(def: ZodDef, key: string): ZodSchema[] {
    const value = def[key];
    if (!Array.isArray(value) || !value.every(isZodSchema)) {
        throw new Error(`Expected a list of Zod schemas at "${key}" in a "${def.type}" definition`);
    }
    return value;
}

export function shapeOf(def: ZodDef): [string, ZodSchema][] {
    const shape = def['shape'];
    if (typeof shape !== 'object' || shape === null) {
        throw new Error(`Expected a shape in a "${def.type}" definition`);
    }
    return Object.entries(shape).map(([name, schema]) => {
        if (!isZodSchema(schema)) {
            throw new Error(`Shape key "${name}" is not a Zod schema`);
        }
        return [name, schema];
    });
}

// Values of a Zod enum. Native numeric enums also expose reverse mappings (value -> key) that
// must be left out.
export function enumValuesOf(def: ZodDef): (string | number)[] {
    const entries = def['entries'];
    if (typeof entries !== 'object' || entries === null) {
        throw new Error('Expected entries in an "enum" definition');
    }
    const record = entries as Record<string, string | number>;
    return Object.keys(record)
        .filter((key) => typeof record[record[key] as string] !== 'number')
        .map((key) => record[key] as string | number);
}
