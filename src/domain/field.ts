import type { TypeExpression } from './type-expression.js';

export interface Field {
    readonly name: string;
    readonly type: TypeExpression;
    readonly optional: boolean;
    readonly nullable: boolean;
    // Human-readable constraints such as ">= 0", "min 1" or "email".
    readonly constraints: readonly string[];
    readonly description?: string;
}
