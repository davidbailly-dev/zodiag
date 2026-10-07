import { ExtractSchemaGraph } from '../../application/extract-schema-graph.js';
import { JitiModuleLoader } from '../../infrastructure/jiti-module-loader.js';
import { MermaidRenderer } from '../../infrastructure/rendering/mermaid-renderer.js';
import { ZodSchemaIntrospector } from '../../infrastructure/zod/zod-schema-introspector.js';
import type { CliDependencies } from './program.js';

// Composition root: the only place where the CLI is wired to its concrete adapters.
export function createDefaultDependencies(): CliDependencies {
    return {
        extractSchemaGraph: new ExtractSchemaGraph(new JitiModuleLoader(), new ZodSchemaIntrospector()),
        renderers: { mermaid: new MermaidRenderer() },
        io: {
            stdout: (text) => process.stdout.write(text),
            stderr: (text) => process.stderr.write(text),
        },
    };
}
