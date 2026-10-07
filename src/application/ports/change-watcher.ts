export interface WatchHandle {
    close(): void;
}

export interface ChangeWatcher {
    // Calls `onChange` whenever the schema files of the target change (added, removed or modified).
    watch(target: string, onChange: () => void): WatchHandle;
}
