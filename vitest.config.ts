import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/server', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      // Vitest resolves these from the workspace root or the project root depending on
      // whether --project is passed, so both spellings are listed.
      include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/__test__/**',
        '**/*.d.ts',
        '**/index.ts',
        '**/src/main.ts',
        '**/src/mcp/main.ts',
        '**/src/main.tsx',
        'src/test/**',
        '**/*.types.ts',
      ],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
})
