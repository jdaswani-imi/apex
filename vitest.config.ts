import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    pool: 'forks',
    maxWorkers: 10,
    minWorkers: 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      // Only measure coverage for files that have tests written.
      // Untested routes (AI, WHOOP, db.ts) are excluded until their test suites are added.
      include: [
        'src/lib/intelligence.ts',
        'src/lib/utils.ts',
        'src/app/api/onboarding/route.ts',
        'src/app/api/settings/route.ts',
        'src/app/api/settings/baseline/route.ts',
        'src/app/api/settings/supplement/route.ts',
        'src/app/api/training/session/[id]/route.ts',
        'src/app/api/training/exercise/route.ts',
        'src/app/api/chat/history/route.ts',
        'src/app/api/chat/history/[id]/route.ts',
        'src/app/api/cycle/route.ts',
        'src/app/api/health/route.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
      ],
    },
    include: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**/*.test.{ts,tsx}'],
  },
})
