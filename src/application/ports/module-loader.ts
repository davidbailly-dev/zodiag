export interface LoadedModule {
    // Path of the module, relative to the analyzed target.
    readonly filePath: string;
    readonly exports: Readonly<Record<string, unknown>>;
}

export interface LoadFailure {
    readonly filePath: string;
    readonly message: string;
}

export interface LoadResult {
    readonly modules: readonly LoadedModule[];
    readonly failures: readonly LoadFailure[];
}

export interface ModuleLoader {
    load(target: string): Promise<LoadResult>;
}
