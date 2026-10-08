import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);
const IGNORED_SUFFIXES = ['.d.ts', '.test.ts', '.spec.ts'];

export interface SourceFiles {
    // Directory the file paths are relative to: the target itself, or its parent for a single file.
    readonly root: string;
    // Absolute paths, alphabetical with barrel files (`index.ts`) last, so that a schema re-exported by
    // a barrel is attributed to the file that defines it.
    readonly files: readonly string[];
}

// The TypeScript files of a target: the file itself, or every source file of a directory (walked
// recursively, skipping `node_modules`, dot directories, declaration files and tests).
export async function resolveSourceFiles(target: string): Promise<SourceFiles> {
    const absoluteTarget = path.resolve(target);
    const info = await stat(absoluteTarget).catch(() => undefined);
    if (info === undefined) {
        throw new Error(`Target not found: ${target}`);
    }
    if (!info.isDirectory()) {
        return { root: path.dirname(absoluteTarget), files: [absoluteTarget] };
    }
    return { root: absoluteTarget, files: sortFiles(await collectFiles(absoluteTarget), absoluteTarget) };
}

export function toPosix(filePath: string): string {
    return filePath.split(path.sep).join('/');
}

async function collectFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
        }
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(entryPath)));
        } else if (isSourceFile(entry.name)) {
            files.push(entryPath);
        }
    }
    return files;
}

function isSourceFile(fileName: string): boolean {
    return (
        SOURCE_EXTENSIONS.has(path.extname(fileName)) && !IGNORED_SUFFIXES.some((suffix) => fileName.endsWith(suffix))
    );
}

function sortFiles(files: string[], root: string): string[] {
    const isBarrel = (file: string): boolean => path.basename(file, path.extname(file)) === 'index';
    return [...files].sort((a, b) => {
        if (isBarrel(a) !== isBarrel(b)) {
            return isBarrel(a) ? 1 : -1;
        }
        return toPosix(path.relative(root, a)).localeCompare(toPosix(path.relative(root, b)));
    });
}
