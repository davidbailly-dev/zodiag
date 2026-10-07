import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChangeWatcher } from '../../application/ports/change-watcher.js';
import type { ViewerLauncher, ViewerOptions } from '../../application/ports/viewer-launcher.js';
import type { SchemaGraph } from '../../domain/index.js';
import { createDefaultDependencies } from './composition.js';
import { createProgram } from './program.js';
import type { CliDependencies } from './program.js';

const fixtures = path.resolve(import.meta.dirname, '../../../tests/fixtures');
const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function runWith(overrides: Partial<CliDependencies>, ...args: string[]) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const launches: { graph: SchemaGraph; options: ViewerOptions }[] = [];
    const updates: SchemaGraph[] = [];
    const watches: { target: string; trigger(): void; closed: boolean }[] = [];
    const viewerLauncher: ViewerLauncher = {
        launch: async (graph, options) => {
            launches.push({ graph, options });
            return {
                url: 'http://127.0.0.1:4000',
                update: (updated) => updates.push(updated),
                close: async () => undefined,
            };
        },
    };
    const changeWatcher: ChangeWatcher = {
        watch: (target, onChange) => {
            const watch = { target, trigger: onChange, closed: false };
            watches.push(watch);
            return { close: () => (watch.closed = true) };
        },
    };
    const program = createProgram({
        ...createDefaultDependencies(),
        viewerLauncher,
        changeWatcher,
        io: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
        ...overrides,
    });
    program.exitOverride().configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
    const done = program.parseAsync(['node', 'zodiac', ...args]);
    return { done, stdout, stderr, launches, updates, watches };
}

function run(...args: string[]) {
    return runWith({}, ...args);
}

describe('zodiac command', () => {
    const shop = path.join(fixtures, 'shop');

    it('exposes the zodiac command name', () => {
        expect(createProgram(createDefaultDependencies()).name()).toBe('zodiac');
    });

    describe('viewer (default format)', () => {
        it('launches the viewer with the extracted graph and opens the browser', async () => {
            const { done, launches, stdout, stderr } = run(shop);
            await done;

            expect(launches).toHaveLength(1);
            expect(launches[0]?.graph.nodes.map((node) => node.name)).toContain('Order');
            expect(launches[0]?.options).toEqual({ open: true });
            expect(stdout).toEqual([]);
            expect(stderr.join('')).toContain('zodiac viewer running at http://127.0.0.1:4000');
        });

        it('forwards --port and --no-open', async () => {
            const { done, launches } = run(shop, '--port', '5000', '--no-open');
            await done;

            expect(launches[0]?.options).toEqual({ port: 5000, open: false });
        });

        it.each(['abc', '-1', '70000', '12.5'])('rejects the invalid port %s', async (port) => {
            await expect(run(shop, `--port=${port}`).done).rejects.toThrow(/port/i);
        });

        it('rejects --output, which only applies to text formats', async () => {
            const { done, launches } = run(shop, '--output', 'diagram.mmd');

            await expect(done).rejects.toThrow('--output is not supported by the viewer');
            expect(launches).toEqual([]);
        });
    });

    describe('watch mode', () => {
        it('watches the target and reloads the viewer when it changes', async () => {
            const { done, watches, updates, stderr } = run(shop, '--no-open');
            await done;

            expect(watches.map((watch) => watch.target)).toEqual([shop]);
            expect(stderr.join('')).toContain(`watching ${shop} for changes`);
            expect(updates).toEqual([]);

            watches[0]?.trigger();
            await vi.waitFor(() => expect(updates).toHaveLength(1));

            expect(updates[0]?.nodes.map((node) => node.name)).toContain('Order');
            expect(stderr.join('')).toContain('reloaded 4 schemas');
        });

        it('keeps the previous diagram when a reload fails', async () => {
            let extractions = 0;
            const real = createDefaultDependencies().extractSchemaGraph;
            const { done, watches, updates, stderr } = runWith(
                {
                    extractSchemaGraph: {
                        execute: async (target, options) => {
                            extractions += 1;
                            if (extractions > 1) {
                                throw new Error(`Target not found: ${target}`);
                            }
                            return real.execute(target, options);
                        },
                    },
                },
                shop,
            );
            await done;

            watches[0]?.trigger();
            await vi.waitFor(() => expect(stderr.join('')).toContain('keeping the previous diagram'));

            expect(stderr.join('')).toContain('warning: Target not found');
            expect(updates).toEqual([]);
        });

        it('does not watch with --no-watch', async () => {
            const { done, watches } = run(shop, '--no-watch');
            await done;

            expect(watches).toEqual([]);
        });

        it('does not watch the text formats, which run once', async () => {
            const { done, watches } = run(shop, '--format', 'mermaid');
            await done;

            expect(watches).toEqual([]);
        });
    });

    describe('inferred relations', () => {
        const inferred = path.join(fixtures, 'inferred');

        it('links fields such as shopId to their schema by default', async () => {
            const { done, stdout } = run(inferred, '-f', 'mermaid');
            await done;

            expect(stdout.join('')).toContain('Order ||..|| Shop : "shopId"');
        });

        it('keeps them out of the viewer data with --no-inferred-relations', async () => {
            const withRelations = run(inferred, '--no-open');
            await withRelations.done;
            const withoutRelations = run(inferred, '--no-open', '--no-inferred-relations');
            await withoutRelations.done;

            expect(withRelations.launches[0]?.graph.relations.map((relation) => relation.kind)).toEqual(['inferred']);
            expect(withoutRelations.launches[0]?.graph.relations).toEqual([]);
        });
    });

    describe('mermaid format', () => {
        it('prints a Mermaid diagram without launching the viewer', async () => {
            const { done, stdout, stderr, launches } = run(shop, '--format', 'mermaid');
            await done;

            const output = stdout.join('');
            expect(output.startsWith('erDiagram\n')).toBe(true);
            expect(output).toContain('Order ||--o{ OrderLine : "lines"');
            expect(output).toContain('Order ||--|| Shop : "shop"');
            expect(stderr).toEqual([]);
            expect(launches).toEqual([]);
        });

        it('writes the diagram to a file with --output', async () => {
            const directory = await mkdtemp(path.join(os.tmpdir(), 'zodiac-'));
            temporaryDirectories.push(directory);
            const file = path.join(directory, 'nested', 'diagram.mmd');

            const { done, stdout, stderr } = run(shop, '-f', 'mermaid', '--output', file);
            await done;

            expect(await readFile(file, 'utf8')).toContain('erDiagram');
            expect(stdout).toEqual([]);
            expect(stderr.join('')).toContain(`written to ${file}`);
        });
    });

    describe('errors', () => {
        it('warns about files that cannot be loaded and still renders the others', async () => {
            const { done, stdout, stderr } = run(path.join(fixtures, 'broken'), '-f', 'mermaid');
            await done;

            expect(stderr.join('')).toContain('warning: could not load broken.ts: Cannot load this module');
            expect(stdout.join('')).toContain('Valid {');
        });

        it('fails when no schema is found', async () => {
            await expect(run(path.join(fixtures, 'empty')).done).rejects.toThrow('No Zod object or enum schema found');
        });

        it('fails when the target does not exist', async () => {
            await expect(run(path.join(fixtures, 'missing')).done).rejects.toThrow('Target not found');
        });

        it('rejects an unknown format', async () => {
            await expect(run(shop, '--format', 'png').done).rejects.toThrow(/png/);
        });
    });
});
