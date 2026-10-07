import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { get, request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunningViewer } from '../../application/ports/viewer-launcher.js';
import { SchemaGraph } from '../../domain/index.js';
import { HttpViewerLauncher } from './http-viewer-launcher.js';

const graph = SchemaGraph.create([
    {
        kind: 'object',
        name: 'Shop',
        source: 'shop.ts',
        fields: [
            {
                name: 'id',
                type: { kind: 'primitive', name: 'string' },
                optional: false,
                nullable: false,
                constraints: [],
            },
        ],
    },
]);

let assetsDirectory: string;
let secretDirectory: string;
const running: RunningViewer[] = [];

beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zodiag-viewer-'));
    assetsDirectory = path.join(root, 'viewer');
    secretDirectory = root;
    await mkdir(path.join(assetsDirectory, 'assets'), { recursive: true });
    await writeFile(path.join(assetsDirectory, 'index.html'), '<!doctype html><title>Zodiag</title>');
    await writeFile(path.join(assetsDirectory, 'assets', 'app.js'), 'console.log("app")');
    await writeFile(path.join(root, 'secret.txt'), 'top secret');
});

afterEach(async () => {
    await Promise.all(running.splice(0).map((viewer) => viewer.close()));
    await rm(secretDirectory, { recursive: true });
});

async function launch(open: (url: string) => void = () => undefined, options = { port: 0, open: false }) {
    const viewer = await new HttpViewerLauncher(assetsDirectory, open).launch(graph, options);
    running.push(viewer);
    return viewer;
}

// `fetch` normalizes `..` segments and the Host header, so raw requests are needed for the hostile cases.
function rawGet(url: string, requestPath: string, headers: Record<string, string> = {}) {
    const { port } = new URL(url);
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
        const clientRequest = request({ host: '127.0.0.1', port, path: requestPath, headers }, (response) => {
            let body = '';
            response.on('data', (chunk: Buffer) => (body += chunk.toString()));
            response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
        });
        clientRequest.on('error', reject);
        clientRequest.end();
    });
}

// Opens the event stream and collects what the server sends on it.
function openEventStream(url: string) {
    let received = '';
    let status = 0;
    const clientRequest = get(`${url}/events`, (response) => {
        status = response.statusCode ?? 0;
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (received += chunk));
    });
    clientRequest.on('error', () => undefined);
    return {
        received: () => received,
        status: () => status,
        close: () => clientRequest.destroy(),
    };
}

async function waitFor(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

describe('HttpViewerLauncher', () => {
    it('serves the viewer page and its assets with the right content types', async () => {
        const { url } = await launch();

        const page = await fetch(url);
        expect(page.status).toBe(200);
        expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
        expect(await page.text()).toContain('<title>Zodiag</title>');

        const script = await fetch(`${url}/assets/app.js`);
        expect(script.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    });

    it('serves the schema graph as JSON', async () => {
        const { url } = await launch();

        const response = await fetch(`${url}/graph.json`);

        expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
        expect(await response.json()).toEqual(
            JSON.parse(JSON.stringify({ nodes: graph.nodes, relations: graph.relations })),
        );
    });

    it('serves the new graph after an update and announces it to the open pages', async () => {
        const viewer = await launch();
        const stream = openEventStream(viewer.url);
        await waitFor(() => stream.received().includes('retry:'));
        expect(stream.status()).toBe(200);

        const updated = SchemaGraph.create([
            { kind: 'object', name: 'Order', source: 'order.ts', fields: [] },
            { kind: 'object', name: 'Shop', source: 'shop.ts', fields: [] },
        ]);
        viewer.update(updated);
        await waitFor(() => stream.received().includes('event: graph'));
        stream.close();

        expect(stream.received()).toContain('event: graph\ndata: updated\n\n');
        const body = (await (await fetch(`${viewer.url}/graph.json`)).json()) as { nodes: { name: string }[] };
        expect(body.nodes.map((node) => node.name)).toEqual(['Order', 'Shop']);
    });

    it('does not notify pages that have disconnected, and still shuts down with an open stream', async () => {
        const viewer = await launch();
        const gone = openEventStream(viewer.url);
        const staying = openEventStream(viewer.url);
        await waitFor(() => gone.received().includes('retry:') && staying.received().includes('retry:'));
        gone.close();
        await new Promise((resolve) => setTimeout(resolve, 50));

        viewer.update(graph);
        await waitFor(() => staying.received().includes('event: graph'));

        expect(staying.received()).toContain('event: graph');
        expect(gone.received()).not.toContain('event: graph');
    });

    it('answers 404 for unknown files and 405 for other methods', async () => {
        const { url } = await launch();

        expect((await fetch(`${url}/missing.js`)).status).toBe(404);
        expect((await fetch(url, { method: 'POST' })).status).toBe(405);
    });

    it('does not serve files outside of the viewer directory', async () => {
        const { url } = await launch();

        for (const requestPath of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
            const { status, body } = await rawGet(url, requestPath);
            expect(status).not.toBe(200);
            expect(body).not.toContain('top secret');
        }
    });

    it('rejects requests addressed to a foreign host (DNS rebinding)', async () => {
        const { url } = await launch();

        for (const requestPath of ['/graph.json', '/events']) {
            const { status } = await rawGet(url, requestPath, { host: 'evil.example.com' });

            expect(status).toBe(403);
        }
    });

    it('opens the browser only when asked to', async () => {
        const opened: string[] = [];

        await launch((url) => opened.push(url), { port: 0, open: false });
        expect(opened).toEqual([]);

        const { url } = await launch((openedUrl) => opened.push(openedUrl), { port: 0, open: true });
        expect(opened).toEqual([url]);
    });

    it('fails clearly when the requested port is already in use', async () => {
        const { url } = await launch();
        const port = Number(new URL(url).port);

        await expect(launch(() => undefined, { port, open: false })).rejects.toThrow(`Port ${port} is already in use`);
    });

    it('fails clearly when the viewer has not been built', async () => {
        const launcher = new HttpViewerLauncher(path.join(secretDirectory, 'nowhere'), () => undefined);

        await expect(launcher.launch(graph, { port: 0, open: false })).rejects.toThrow('npm run build');
    });

    it('stops listening once closed', async () => {
        const viewer = await launch();
        await viewer.close();
        running.length = 0;

        await expect(fetch(viewer.url)).rejects.toThrow();
    });
});
