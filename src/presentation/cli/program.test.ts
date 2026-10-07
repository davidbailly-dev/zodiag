import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultDependencies } from './composition.js';
import { createProgram } from './program.js';

const fixtures = path.resolve(import.meta.dirname, '../../../tests/fixtures');
const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function run(...args: string[]) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const program = createProgram({
        ...createDefaultDependencies(),
        io: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    });
    program.exitOverride().configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
    const done = program.parseAsync(['node', 'zodiac', ...args]);
    return { done, stdout, stderr };
}

describe('zodiac command', () => {
    it('exposes the zodiac command name', () => {
        expect(createProgram(createDefaultDependencies()).name()).toBe('zodiac');
    });

    it('prints a Mermaid diagram of a directory by default', async () => {
        const { done, stdout, stderr } = run(path.join(fixtures, 'shop'));
        await done;

        const output = stdout.join('');
        expect(output.startsWith('erDiagram\n')).toBe(true);
        expect(output).toContain('Order ||--o{ OrderLine : "lines"');
        expect(output).toContain('Order ||--|| Shop : "shop"');
        expect(stderr).toEqual([]);
    });

    it('writes the diagram to a file with --output', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'zodiac-'));
        temporaryDirectories.push(directory);
        const file = path.join(directory, 'nested', 'diagram.mmd');

        const { done, stdout, stderr } = run(path.join(fixtures, 'shop'), '--output', file);
        await done;

        expect(await readFile(file, 'utf8')).toContain('erDiagram');
        expect(stdout).toEqual([]);
        expect(stderr.join('')).toContain(`written to ${file}`);
    });

    it('warns about files that cannot be loaded and still renders the others', async () => {
        const { done, stdout, stderr } = run(path.join(fixtures, 'broken'));
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
        await expect(run(path.join(fixtures, 'shop'), '--format', 'png').done).rejects.toThrow(/png/);
    });
});
