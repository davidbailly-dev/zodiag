import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WatchHandle } from '../application/ports/change-watcher.js';
import { PollingChangeWatcher } from './polling-change-watcher.js';

const INTERVAL = 15;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let directory: string;
const handles: WatchHandle[] = [];

beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'zodiac-watch-'));
    await writeFile(path.join(directory, 'shop.ts'), 'export const a = 1;');
});

afterEach(async () => {
    handles.splice(0).forEach((handle) => handle.close());
    await rm(directory, { recursive: true });
});

function watch(target = directory) {
    let changes = 0;
    handles.push(new PollingChangeWatcher(INTERVAL).watch(target, () => (changes += 1)));
    return () => changes;
}

// Lets the watcher take its baseline, then lets it poll a few times.
const settle = () => sleep(INTERVAL * 6);

async function waitFor(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) {
        await sleep(INTERVAL);
    }
}

describe('PollingChangeWatcher', () => {
    it('stays quiet while nothing changes', async () => {
        const changes = watch();

        await settle();

        expect(changes()).toBe(0);
    });

    it('reports a modified file', async () => {
        const changes = watch();
        await settle();

        await writeFile(path.join(directory, 'shop.ts'), 'export const a = 12345;');
        await waitFor(() => changes() > 0);

        expect(changes()).toBe(1);
    });

    it('reports an added file, in a sub-directory too, and a removed one', async () => {
        const changes = watch();
        await settle();

        await mkdir(path.join(directory, 'nested'));
        await writeFile(path.join(directory, 'nested', 'order.ts'), 'export const b = 1;');
        await waitFor(() => changes() === 1);
        expect(changes()).toBe(1);

        await unlink(path.join(directory, 'nested', 'order.ts'));
        await waitFor(() => changes() === 2);
        expect(changes()).toBe(2);
    });

    it('ignores files that are not schema sources', async () => {
        const changes = watch();
        await settle();

        await writeFile(path.join(directory, 'notes.md'), '# notes');
        await writeFile(path.join(directory, 'shop.test.ts'), 'test');
        await mkdir(path.join(directory, 'node_modules'));
        await writeFile(path.join(directory, 'node_modules', 'dependency.ts'), 'export {}');
        await settle();

        expect(changes()).toBe(0);
    });

    it('watches a single file', async () => {
        const file = path.join(directory, 'shop.ts');
        const changes = watch(file);
        await settle();

        await writeFile(file, 'export const a = 123456789;');
        await waitFor(() => changes() > 0);

        expect(changes()).toBe(1);
    });

    it('reports the target disappearing and coming back', async () => {
        const target = path.join(directory, 'schemas');
        await mkdir(target);
        await writeFile(path.join(target, 'shop.ts'), 'export const a = 1;');
        const changes = watch(target);
        await settle();

        await rm(target, { recursive: true });
        await waitFor(() => changes() === 1);
        expect(changes()).toBe(1);

        await mkdir(target);
        await writeFile(path.join(target, 'shop.ts'), 'export const a = 1;');
        await waitFor(() => changes() === 2);
        expect(changes()).toBe(2);
    });

    it('stops reporting once closed', async () => {
        let changes = 0;
        const handle = new PollingChangeWatcher(INTERVAL).watch(directory, () => (changes += 1));
        await settle();
        handle.close();

        await writeFile(path.join(directory, 'shop.ts'), 'export const a = 12345;');
        await settle();

        expect(changes).toBe(0);
    });
});
