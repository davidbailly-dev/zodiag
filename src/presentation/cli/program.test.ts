import { describe, expect, it } from 'vitest';
import { createProgram } from './program.js';

describe('createProgram', () => {
    it('exposes the zodiac command name', () => {
        expect(createProgram().name()).toBe('zodiac');
    });
});
