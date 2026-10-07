import { DuplicateNodeNameError, UnknownReferenceError } from './errors.js';
import { inferRelations } from './infer-relations.js';
import type { Cardinality, Relation } from './relation.js';
import type { SchemaNode } from './schema-node.js';
import { findReferences } from './type-expression.js';

export class SchemaGraph {
    readonly nodes: readonly SchemaNode[];
    readonly relations: readonly Relation[];

    private constructor(nodes: readonly SchemaNode[], relations: readonly Relation[]) {
        this.nodes = nodes;
        this.relations = relations;
    }

    static create(nodes: readonly SchemaNode[]): SchemaGraph {
        const nodesByName = new Map<string, SchemaNode>();
        for (const node of nodes) {
            if (nodesByName.has(node.name)) {
                throw new DuplicateNodeNameError(node.name);
            }
            nodesByName.set(node.name, node);
        }

        const relations = new Map<string, Relation>();
        for (const node of nodes) {
            if (node.kind !== 'object') {
                continue;
            }
            for (const field of node.fields) {
                for (const reference of findReferences(field.type)) {
                    const target = nodesByName.get(reference.target);
                    if (target === undefined) {
                        throw new UnknownReferenceError(node.name, field.name, reference.target);
                    }
                    // Enums are displayed as field types, only object-to-object links are relations.
                    if (target.kind !== 'object') {
                        continue;
                    }
                    const cardinality: Cardinality = reference.many
                        ? 'many'
                        : field.optional || field.nullable || reference.alternative
                          ? 'zero-or-one'
                          : 'one';
                    const relation: Relation = {
                        source: node.name,
                        target: target.name,
                        fieldName: field.name,
                        cardinality,
                        kind: 'explicit',
                    };
                    if (!relations.has(relationKey(relation))) {
                        relations.set(relationKey(relation), relation);
                    }
                }
            }
        }

        return new SchemaGraph(nodes, [...relations.values()]);
    }

    // A copy of the graph with the relations guessed from field names added. Calling it again changes nothing.
    withInferredRelations(): SchemaGraph {
        const known = new Set(this.relations.map(relationKey));
        const inferred = inferRelations(this.nodes).filter((relation) => !known.has(relationKey(relation)));
        return new SchemaGraph(this.nodes, [...this.relations, ...inferred]);
    }

    findNode(name: string): SchemaNode | undefined {
        return this.nodes.find((node) => node.name === name);
    }
}

function relationKey(relation: Relation): string {
    return `${relation.source}|${relation.fieldName}|${relation.target}`;
}
