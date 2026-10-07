#!/usr/bin/env node
import { createDefaultDependencies } from './composition.js';
import { createProgram } from './program.js';

try {
    await createProgram(createDefaultDependencies()).parseAsync(process.argv);
} catch (error) {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}
