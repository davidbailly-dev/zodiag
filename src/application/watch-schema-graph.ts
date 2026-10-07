import type { ExtractionOptions, ExtractionResult } from './extract-schema-graph.js';
import type { ChangeWatcher, WatchHandle } from './ports/change-watcher.js';

export interface WatchListener {
    // A new graph was extracted after a change.
    onUpdate(result: ExtractionResult): void;
    // The extraction failed or found nothing: the previous graph is still the current one.
    onError(error: Error): void;
}

// Extracts the schema graph again each time the files of the target change. Changes that happen while
// an extraction is running are merged into a single extra run, so extractions never overlap.
export class WatchSchemaGraph {
    private readonly extract: { execute(target: string, options?: ExtractionOptions): Promise<ExtractionResult> };
    private readonly watcher: ChangeWatcher;

    constructor(
        extract: { execute(target: string, options?: ExtractionOptions): Promise<ExtractionResult> },
        watcher: ChangeWatcher,
    ) {
        this.extract = extract;
        this.watcher = watcher;
    }

    start(target: string, options: ExtractionOptions, listener: WatchListener): WatchHandle {
        let running = false;
        let rerun = false;
        let stopped = false;

        const refresh = async (): Promise<void> => {
            if (running) {
                rerun = true;
                return;
            }
            running = true;
            try {
                do {
                    rerun = false;
                    await this.extractOnce(target, options, listener, () => stopped);
                } while (rerun && !stopped);
            } finally {
                running = false;
            }
        };

        const handle = this.watcher.watch(target, () => void refresh());
        return {
            close: () => {
                stopped = true;
                handle.close();
            },
        };
    }

    private async extractOnce(
        target: string,
        options: ExtractionOptions,
        listener: WatchListener,
        isStopped: () => boolean,
    ): Promise<void> {
        try {
            const result = await this.extract.execute(target, options);
            if (isStopped()) {
                return;
            }
            if (result.graph.nodes.length === 0) {
                listener.onError(new Error(`No Zod object or enum schema found in ${target}`));
                return;
            }
            listener.onUpdate(result);
        } catch (error) {
            if (!isStopped()) {
                listener.onError(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
}
