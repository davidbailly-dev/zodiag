import type { Field } from './field.js';

export type TypeExpression =
    | { readonly kind: 'primitive'; readonly name: string }
    | { readonly kind: 'literal'; readonly value: string | number | boolean }
    | { readonly kind: 'reference'; readonly target: string }
    | { readonly kind: 'array'; readonly item: TypeExpression }
    | { readonly kind: 'tuple'; readonly items: readonly TypeExpression[] }
    | { readonly kind: 'record'; readonly key: TypeExpression; readonly value: TypeExpression }
    | { readonly kind: 'union'; readonly members: readonly TypeExpression[] }
    | { readonly kind: 'intersection'; readonly members: readonly TypeExpression[] }
    | { readonly kind: 'object'; readonly fields: readonly Field[] }
    | { readonly kind: 'unknown'; readonly name: string };

export interface TypeReference {
    readonly target: string;
    // The reference is reached through an array, a tuple or a record.
    readonly many: boolean;
    // The reference is one of several possible types (union or intersection).
    readonly alternative: boolean;
}

export function findReferences(type: TypeExpression, many = false, alternative = false): TypeReference[] {
    switch (type.kind) {
        case 'reference':
            return [{ target: type.target, many, alternative }];
        case 'array':
            return findReferences(type.item, true, alternative);
        case 'tuple':
            return type.items.flatMap((item) => findReferences(item, true, alternative));
        case 'record':
            return findReferences(type.value, true, alternative);
        case 'union':
        case 'intersection':
            return type.members.flatMap((member) => findReferences(member, many, true));
        case 'object':
            return type.fields.flatMap((field) => findReferences(field.type, many, alternative));
        case 'primitive':
        case 'literal':
        case 'unknown':
            return [];
    }
}

export function formatTypeExpression(type: TypeExpression): string {
    switch (type.kind) {
        case 'primitive':
        case 'unknown':
            return type.name;
        case 'literal':
            return typeof type.value === 'string' ? JSON.stringify(type.value) : String(type.value);
        case 'reference':
            return type.target;
        case 'array': {
            const item = formatTypeExpression(type.item);
            return isCompound(type.item) ? `(${item})[]` : `${item}[]`;
        }
        case 'tuple':
            return `[${type.items.map(formatTypeExpression).join(', ')}]`;
        case 'record':
            return `Record<${formatTypeExpression(type.key)}, ${formatTypeExpression(type.value)}>`;
        case 'union':
            return type.members.map(formatTypeExpression).join(' | ');
        case 'intersection':
            return type.members
                .map((member) => {
                    const formatted = formatTypeExpression(member);
                    return member.kind === 'union' ? `(${formatted})` : formatted;
                })
                .join(' & ');
        case 'object': {
            if (type.fields.length === 0) {
                return '{}';
            }
            const fields = type.fields.map((field) => {
                const optional = field.optional ? '?' : '';
                const nullable = field.nullable ? ' | null' : '';
                return `${field.name}${optional}: ${formatTypeExpression(field.type)}${nullable}`;
            });
            return `{ ${fields.join('; ')} }`;
        }
    }
}

function isCompound(type: TypeExpression): boolean {
    return type.kind === 'union' || type.kind === 'intersection';
}
