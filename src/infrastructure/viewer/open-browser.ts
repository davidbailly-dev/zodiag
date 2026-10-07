import { spawn } from 'node:child_process';

// Opens a URL in the default browser. Failing to do so is not an error: the URL is printed anyway.
export function openBrowser(url: string): void {
    const [command, args] = browserCommand(url);
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
}

function browserCommand(url: string): [string, string[]] {
    switch (process.platform) {
        case 'darwin':
            return ['open', [url]];
        case 'win32':
            return ['rundll32', ['url.dll,FileProtocolHandler', url]];
        default:
            return ['xdg-open', [url]];
    }
}
