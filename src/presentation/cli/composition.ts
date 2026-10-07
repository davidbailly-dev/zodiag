import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ExtractSchemaGraph } from '../../application/extract-schema-graph.js';
import { JitiModuleLoader } from '../../infrastructure/jiti-module-loader.js';
import { PollingChangeWatcher } from '../../infrastructure/polling-change-watcher.js';
import { MermaidRenderer } from '../../infrastructure/rendering/mermaid-renderer.js';
import { HttpViewerLauncher } from '../../infrastructure/viewer/http-viewer-launcher.js';
import { ZodSchemaIntrospector } from '../../infrastructure/zod/zod-schema-introspector.js';
import type { CliDependencies } from './program.js';

// Composition root: the only place where the CLI is wired to its concrete adapters.
export function createDefaultDependencies(): CliDependencies {
    return {
        version: readVersion(),
        extractSchemaGraph: new ExtractSchemaGraph(new JitiModuleLoader(), new ZodSchemaIntrospector()),
        renderers: { mermaid: new MermaidRenderer() },
        viewerLauncher: new HttpViewerLauncher(),
        changeWatcher: new PollingChangeWatcher(),
        io: {
            stdout: (text) => process.stdout.write(text),
            stderr: (text) => process.stderr.write(text),
        },
    };
}

// The version lives in package.json only. The manifest sits three levels above this file, both in
// the built package (dist/presentation/cli) and in the sources (src/presentation/cli).
function readVersion(): string {
    const manifest = path.resolve(import.meta.dirname, '../../../package.json');
    return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
}
