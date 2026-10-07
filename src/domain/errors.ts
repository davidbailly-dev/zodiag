export class DuplicateNodeNameError extends Error {
    readonly nodeName: string;

    constructor(nodeName: string) {
        super(`Duplicate schema node name "${nodeName}"`);
        this.name = 'DuplicateNodeNameError';
        this.nodeName = nodeName;
    }
}

export class UnknownReferenceError extends Error {
    readonly source: string;
    readonly fieldName: string;
    readonly target: string;

    constructor(source: string, fieldName: string, target: string) {
        super(`Field "${source}.${fieldName}" references unknown schema "${target}"`);
        this.name = 'UnknownReferenceError';
        this.source = source;
        this.fieldName = fieldName;
        this.target = target;
    }
}
