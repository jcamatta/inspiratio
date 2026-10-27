import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'shared', include: ['src/**/__test__/**/*.test.ts'], environment: 'node' },
})
