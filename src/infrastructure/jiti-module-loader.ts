import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import type { LoadedModule, LoadFailure, LoadResult, ModuleLoader } from '../application/ports/module-loader.js';

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);
const IGNORED_SUFFIXES = ['.d.ts', '.test.ts', '.spec.ts'];

// Loads TypeScript modules at runtime with jiti, so the analyzed project does not need to be built.
// A directory is walked recursively; a file is loaded on its own.
export class JitiModuleLoader implements ModuleLoader {
    async load(target: string): Promise<LoadResult> {
        const absoluteTarget = path.resolve(target);
        const info = await stat(absoluteTarget).catch(() => undefined);
        if (info === undefined) {
            throw new Error(`Target not found: ${target}`);
        }

        const root = info.isDirectory() ? absoluteTarget : path.dirname(absoluteTarget);
        const files = info.isDirectory() ? sortFiles(await collectFiles(absoluteTarget), root) : [absoluteTarget];

        // The module cache must stay enabled: a schema imported by several files has to be the same
        // instance everywhere, because references between schemas are detected by identity.
        const jiti = createJiti(import.meta.url, { fsCache: false });
        const modules: LoadedModule[] = [];
        const failures: LoadFailure[] = [];

        for (const file of files) {
            const filePath = toPosix(path.relative(root, file));
            try {
                const namespace = await jiti.import(file);
                modules.push({ filePath, exports: { ...(namespace as object) } });
            } catch (error) {
                failures.push({ filePath, message: error instanceof Error ? error.message : String(error) });
            }
        }
        return { modules, failures };
    }
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
        SOURCE_EXTENSIONS.has(path.extname(fileName)) &&
        !IGNORED_SUFFIXES.some((suffix) => fileName.endsWith(suffix))
    );
}

// Alphabetical order, with barrel files (`index.ts`) last so that a schema re-exported by a barrel
// is attributed to the file that defines it.
function sortFiles(files: string[], root: string): string[] {
    const isBarrel = (file: string): boolean => path.basename(file, path.extname(file)) === 'index';
    return [...files].sort((a, b) => {
        if (isBarrel(a) !== isBarrel(b)) {
            return isBarrel(a) ? 1 : -1;
        }
        return toPosix(path.relative(root, a)).localeCompare(toPosix(path.relative(root, b)));
    });
}

function toPosix(filePath: string): string {
    return filePath.split(path.sep).join('/');
}
