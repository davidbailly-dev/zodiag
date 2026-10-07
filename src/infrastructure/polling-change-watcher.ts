import { stat } from 'node:fs/promises';
import type { ChangeWatcher, WatchHandle } from '../application/ports/change-watcher.js';
import { resolveSourceFiles } from './source-files.js';

const DEFAULT_INTERVAL_MS = 1000;

// Detects changes by comparing, at a regular interval, the list of schema files with their
// modification time and size. Polling is less elegant than `fs.watch`, but it behaves the same on
// every platform, copes with editors that replace files when saving and never watches `node_modules`.
// Only the files of the target are watched, not the modules they import from elsewhere.
export class PollingChangeWatcher implements ChangeWatcher {
    private readonly intervalMs: number;

    constructor(intervalMs = DEFAULT_INTERVAL_MS) {
        this.intervalMs = intervalMs;
    }

    watch(target: string, onChange: () => void): WatchHandle {
        let closed = false;
        let polling = false;
        let previous: Promise<string> = snapshot(target);

        const timer = setInterval(() => {
            if (polling) {
                return;
            }
            polling = true;
            void (async () => {
                try {
                    const last = await previous;
                    const current = await snapshot(target);
                    previous = Promise.resolve(current);
                    if (!closed && current !== last) {
                        onChange();
                    }
                } finally {
                    polling = false;
                }
            })();
        }, this.intervalMs);
        // Watching alone must not keep the process alive.
        timer.unref();

        return {
            close: () => {
                closed = true;
                clearInterval(timer);
            },
        };
    }
}

// A fingerprint of the target. A target that cannot be read has its own fingerprint, so that its
// disappearance (and its return) count as changes.
async function snapshot(target: string): Promise<string> {
    try {
        const { files } = await resolveSourceFiles(target);
        const entries = await Promise.all(
            files.map(async (file) => {
                const info = await stat(file).catch(() => undefined);
                return `${file}:${info?.mtimeMs ?? 'gone'}:${info?.size ?? 'gone'}`;
            }),
        );
        return entries.join('\n');
    } catch {
        return '<unreadable>';
    }
}
