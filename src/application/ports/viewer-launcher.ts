import type { SchemaGraph } from '../../domain/index.js';

export interface ViewerOptions {
    // When omitted, the first free port starting from the default one is used.
    readonly port?: number;
    readonly open: boolean;
}

export interface RunningViewer {
    readonly url: string;
    close(): Promise<void>;
}

export interface ViewerLauncher {
    launch(graph: SchemaGraph, options: ViewerOptions): Promise<RunningViewer>;
}
