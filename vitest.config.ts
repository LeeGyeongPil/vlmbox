import { defineConfig } from 'vitest/config';

// Tests run in node by default; *.test.tsx files opt into jsdom with a docblock.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
