import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, InvalidArgumentError, Option } from 'commander';
import type { ExtractionOptions, ExtractionResult } from '../../application/extract-schema-graph.js';
import type { ChangeWatcher } from '../../application/ports/change-watcher.js';
import type { GraphRenderer } from '../../application/ports/graph-renderer.js';
import type { LoadFailure } from '../../application/ports/module-loader.js';
import type { ViewerLauncher } from '../../application/ports/viewer-launcher.js';
import { WatchSchemaGraph } from '../../application/watch-schema-graph.js';

export interface CliDependencies {
    readonly extractSchemaGraph: { execute(target: string, options?: ExtractionOptions): Promise<ExtractionResult> };
    // Text formats, by name. The interactive viewer is handled separately because it keeps running.
    readonly renderers: Readonly<Record<string, GraphRenderer>>;
    readonly viewerLauncher: ViewerLauncher;
    readonly changeWatcher: ChangeWatcher;
    readonly io: {
        stdout(text: string): void;
        stderr(text: string): void;
    };
}

interface CliOptions {
    format: string;
    output?: string;
    port?: number;
    open: boolean;
    inferredRelations: boolean;
    watch: boolean;
}

const VIEWER_FORMAT = 'viewer';

export function createProgram(dependencies: CliDependencies): Command {
    const { extractSchemaGraph, renderers, viewerLauncher, changeWatcher, io } = dependencies;
    const program = new Command();

    program
        .name('zodiac')
        .description('Visualize Zod schemas as diagrams')
        .version('0.1.0')
        .argument('<target>', 'a file or a directory containing Zod schemas')
        .addOption(
            new Option('-f, --format <format>', 'output format')
                .choices([VIEWER_FORMAT, ...Object.keys(renderers)])
                .default(VIEWER_FORMAT),
        )
        .option('-o, --output <file>', 'write a text format to a file instead of the standard output')
        .option('-p, --port <port>', 'port of the viewer (default: first free port from 4000)', parsePort)
        .option('--no-open', 'do not open the viewer in the browser')
        .option('--no-inferred-relations', 'do not link fields such as shopId to the Shop schema')
        .option('--no-watch', 'do not reload the viewer when the schema files change')
        .action(async (target: string, options: CliOptions) => {
            const isViewer = options.format === VIEWER_FORMAT;
            const renderer = renderers[options.format];
            if (isViewer && options.output !== undefined) {
                throw new Error('--output is not supported by the viewer, use e.g. "--format mermaid"');
            }
            if (!isViewer && renderer === undefined) {
                throw new Error(`Unsupported format "${options.format}"`);
            }

            const extraction = { inferRelations: options.inferredRelations };
            const reportFailures = (failures: readonly LoadFailure[]): void => {
                for (const failure of failures) {
                    const reason = failure.message.split('\n')[0];
                    io.stderr(`warning: could not load ${failure.filePath}: ${reason}\n`);
                }
            };

            const { graph, failures } = await extractSchemaGraph.execute(target, extraction);
            reportFailures(failures);
            if (graph.nodes.length === 0) {
                throw new Error(`No Zod object or enum schema found in ${target}`);
            }

            if (isViewer) {
                const viewer = await viewerLauncher.launch(graph, {
                    open: options.open,
                    ...(options.port === undefined ? {} : { port: options.port }),
                });
                io.stderr(`zodiac viewer running at ${viewer.url} (press Ctrl+C to stop)\n`);
                if (options.watch) {
                    io.stderr(`watching ${target} for changes\n`);
                    new WatchSchemaGraph(extractSchemaGraph, changeWatcher).start(target, extraction, {
                        onUpdate: (result) => {
                            reportFailures(result.failures);
                            viewer.update(result.graph);
                            io.stderr(`reloaded ${result.graph.nodes.length} schemas\n`);
                        },
                        onError: (error) => io.stderr(`warning: ${error.message}, keeping the previous diagram\n`),
                    });
                }
                return;
            }

            const output = (renderer as GraphRenderer).render(graph);
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

function parsePort(value: string): number {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new InvalidArgumentError('must be an integer between 0 and 65535');
    }
    return port;
}
