import { Command } from 'commander';

export function createProgram(): Command {
    const program = new Command();

    program
        .name('zodiac')
        .description('Visualize Zod schemas as diagrams')
        .version('0.1.0');

    return program;
}
