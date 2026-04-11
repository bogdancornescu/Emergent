import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js', 'server.js'],
      exclude: ['node_modules'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 70,
      },
    },
  },
});
