import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The viewer is a static single-page app, built into `dist/viewer` and served by the CLI.
export default defineConfig({
    root: 'viewer',
    base: './',
    plugins: [react()],
    build: {
        outDir: '../dist/viewer',
        emptyOutDir: true,
    },
});
