import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Fixtures are inputs of the tests, some of them are deliberately broken.
        exclude: [...configDefaults.exclude, 'tests/fixtures/**'],
    },
});
