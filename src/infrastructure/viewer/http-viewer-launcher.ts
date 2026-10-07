import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RunningViewer, ViewerLauncher, ViewerOptions } from '../../application/ports/viewer-launcher.js';
import type { SchemaGraph } from '../../domain/index.js';
import { openBrowser } from './open-browser.js';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4000;
const PORT_ATTEMPTS = 20;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

// Serves the built viewer (static files), the schema graph (`/graph.json`) and a stream of
// server-sent events (`/events`) announcing that the graph changed, on the loopback interface only.
export class HttpViewerLauncher implements ViewerLauncher {
    private readonly assetsDirectory: string;
    private readonly open: (url: string) => void;

    constructor(assetsDirectory = defaultAssetsDirectory(), open: (url: string) => void = openBrowser) {
        // Absolute and normalized: the path traversal check below relies on it.
        this.assetsDirectory = path.resolve(assetsDirectory);
        this.open = open;
    }

    async launch(graph: SchemaGraph, options: ViewerOptions): Promise<RunningViewer> {
        const indexFile = path.join(this.assetsDirectory, 'index.html');
        if (!(await stat(indexFile).catch(() => undefined))?.isFile()) {
            throw new Error(`Viewer files not found in ${this.assetsDirectory}. Run "npm run build" first.`);
        }

        let graphJson = serialize(graph);
        const subscribers = new Set<ServerResponse>();
        let port = 0;
        const server = createServer((request, response) => {
            this.handle(request, response, port, () => graphJson, subscribers).catch(() => {
                respond(response, 500, 'text/plain; charset=utf-8', 'Internal server error');
            });
        });
        port = await listen(server, options.port);

        const url = `http://${HOST}:${port}`;
        if (options.open) {
            this.open(url);
        }
        return {
            url,
            update: (updatedGraph) => {
                graphJson = serialize(updatedGraph);
                for (const subscriber of subscribers) {
                    subscriber.write('event: graph\ndata: updated\n\n');
                }
            },
            close: () => close(server),
        };
    }

    private async handle(
        request: IncomingMessage,
        response: ServerResponse,
        port: number,
        graphJson: () => string,
        subscribers: Set<ServerResponse>,
    ): Promise<void> {
        // Refuse foreign Host headers: a web page must not be able to read the schemas through DNS rebinding.
        if (request.headers.host !== `${HOST}:${port}` && request.headers.host !== `localhost:${port}`) {
            respond(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
            return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            respond(response, 405, 'text/plain; charset=utf-8', 'Method not allowed');
            return;
        }

        const { pathname } = new URL(request.url ?? '/', `http://${HOST}`);
        if (pathname === '/graph.json') {
            respond(response, 200, CONTENT_TYPES['.json'] as string, graphJson(), request.method === 'HEAD');
            return;
        }
        if (pathname === '/events') {
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
            });
            // Tells the browser how long to wait before reconnecting if the stream is cut.
            response.write('retry: 1000\n\n');
            subscribers.add(response);
            response.on('close', () => subscribers.delete(response));
            return;
        }

        const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
        const filePath = path.resolve(this.assetsDirectory, relativePath);
        if (!filePath.startsWith(this.assetsDirectory + path.sep)) {
            respond(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
            return;
        }
        const content = await readFile(filePath).catch(() => undefined);
        if (content === undefined) {
            respond(response, 404, 'text/plain; charset=utf-8', 'Not found');
            return;
        }
        const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
        respond(response, 200, contentType, content, request.method === 'HEAD');
    }
}

function serialize(graph: SchemaGraph): string {
    return JSON.stringify({ nodes: graph.nodes, relations: graph.relations });
}

// The viewer is built into `dist/viewer`, next to the compiled `dist/infrastructure`.
function defaultAssetsDirectory(): string {
    return path.resolve(import.meta.dirname, '../../viewer');
}

function respond(
    response: ServerResponse,
    status: number,
    contentType: string,
    body: string | Buffer,
    headOnly = false,
): void {
    response.writeHead(status, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(headOnly ? undefined : body);
}

// With an explicit port, only that port is tried. Otherwise the first free one from the default is used.
async function listen(server: Server, port: number | undefined): Promise<number> {
    const candidates =
        port === undefined ? Array.from({ length: PORT_ATTEMPTS }, (_, index) => DEFAULT_PORT + index) : [port];
    for (const candidate of candidates) {
        try {
            await tryListen(server, candidate);
            return (server.address() as AddressInfo).port;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
                throw error;
            }
        }
    }
    throw new Error(
        port === undefined
            ? `No free port between ${DEFAULT_PORT} and ${DEFAULT_PORT + PORT_ATTEMPTS - 1}`
            : `Port ${port} is already in use`,
    );
}

function tryListen(server: Server, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, HOST, () => {
            server.off('error', reject);
            resolve();
        });
    });
}

function close(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
        server.closeAllConnections();
    });
}
