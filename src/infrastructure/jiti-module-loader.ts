import path from 'node:path';
import { createJiti } from 'jiti';
import type { LoadedModule, LoadFailure, LoadResult, ModuleLoader } from '../application/ports/module-loader.js';
import { resolveSourceFiles, toPosix } from './source-files.js';

// Loads TypeScript modules at runtime with jiti, so the analyzed project does not need to be built.
// A directory is walked recursively; a file is loaded on its own. Every call starts from a fresh
// module cache, so a modified file is read again.
export class JitiModuleLoader implements ModuleLoader {
    async load(target: string): Promise<LoadResult> {
        const { root, files } = await resolveSourceFiles(target);

        // The module cache must stay enabled: a schema imported by several files has to be the same
        // instance everywhere, because references between schemas are detected by identity.
        const jiti = createJiti(import.meta.url, { fsCache: false });
        // ...but jiti stores modules in the cache of Node itself, which outlives this call and would
        // serve a file as it was on a previous load. Forget the analyzed project's modules first;
        // dependencies in node_modules do not change and stay cached.
        forgetProjectModules(jiti.cache);
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

function forgetProjectModules(cache: Record<string, unknown>): void {
    const dependencies = `${path.sep}node_modules${path.sep}`;
    for (const key of Object.keys(cache)) {
        if (!key.includes(dependencies)) {
            delete cache[key];
        }
    }
}
