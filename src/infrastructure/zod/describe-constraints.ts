import type { ZodDef, ZodSchema } from './zod-schema.js';

// Turns the checks attached to a schema (`.min(1)`, `.email()`, `.positive()`...) into short
// human-readable labels. Checks without a useful label (custom refinements, transforms) are left out.
export function describeConstraints(schema: ZodSchema): string[] {
    const def = schema._zod.def;
    const checkDefs: ZodDef[] = [];

    // Standalone formats such as `z.email()` or `z.int()` carry their check on the schema itself.
    if (typeof def['check'] === 'string') {
        checkDefs.push(def);
    }
    const checks = def['checks'];
    if (Array.isArray(checks)) {
        for (const check of checks) {
            const checkDef = (check as { _zod?: { def?: ZodDef } })._zod?.def;
            if (checkDef !== undefined) {
                checkDefs.push(checkDef);
            }
        }
    }

    const labels = checkDefs.map(describeCheck).filter((label): label is string => label !== undefined);
    return [...new Set(labels)];
}

function describeCheck(def: ZodDef): string | undefined {
    switch (def['check']) {
        case 'greater_than':
            return `${def['inclusive'] === true ? '>=' : '>'} ${String(def['value'])}`;
        case 'less_than':
            return `${def['inclusive'] === true ? '<=' : '<'} ${String(def['value'])}`;
        case 'multiple_of':
            return `multiple of ${String(def['value'])}`;
        case 'min_length':
            return `min ${String(def['minimum'])}`;
        case 'max_length':
            return `max ${String(def['maximum'])}`;
        case 'length_equals':
            return `length ${String(def['length'])}`;
        case 'min_size':
            return `min size ${String(def['minimum'])}`;
        case 'max_size':
            return `max size ${String(def['maximum'])}`;
        case 'size_equals':
            return `size ${String(def['size'])}`;
        case 'string_format':
            return String(def['format']);
        case 'number_format':
            return def['format'] === 'safeint' ? 'int' : String(def['format']);
        case 'bigint_format':
            return String(def['format']);
        default:
            return undefined;
    }
}
