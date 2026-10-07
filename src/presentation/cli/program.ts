import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
import type { ExtractionResult } from '../../application/extract-schema-graph.js';
import type { GraphRenderer } from '../../application/ports/graph-renderer.js';

export interface CliDependencies {
    readonly extractSchemaGraph: { execute(target: string): Promise<ExtractionResult> };
    readonly renderers: Readonly<Record<string, GraphRenderer>>;
    readonly io: {
        stdout(text: string): void;
        stderr(text: string): void;
    };
}

interface CliOptions {
    format: string;
    output?: string;
}

const DEFAULT_FORMAT = 'mermaid';

export function createProgram(dependencies: CliDependencies): Command {
    const { extractSchemaGraph, renderers, io } = dependencies;
    const program = new Command();

    program
        .name('zodiac')
        .description('Visualize Zod schemas as diagrams')
        .version('0.1.0')
        .argument('<target>', 'a file or a directory containing Zod schemas')
        .addOption(
            new Option('-f, --format <format>', 'output format').choices(Object.keys(renderers)).default(DEFAULT_FORMAT),
        )
        .option('-o, --output <file>', 'write the result to a file instead of the standard output')
        .action(async (target: string, options: CliOptions) => {
            const renderer = renderers[options.format];
            if (renderer === undefined) {
                throw new Error(`Unsupported format "${options.format}"`);
            }

            const { graph, failures } = await extractSchemaGraph.execute(target);
            for (const failure of failures) {
                const reason = failure.message.split('\n')[0];
                io.stderr(`warning: could not load ${failure.filePath}: ${reason}\n`);
            }
            if (graph.nodes.length === 0) {
                throw new Error(`No Zod object or enum schema found in ${target}`);
            }

            const output = renderer.render(graph);
            if (options.output === undefined) {
                io.stdout(output);
                return;
            }
            await mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
            await writeFile(options.output, output);
            io.stderr(`${options.format} diagram written to ${options.output}\n`);
        });

    return program;
}
