import { defineConfig } from 'vitest/config';

// Every test builds its own harness — a fresh PGlite instance, migrated from
// scratch — so a test's floor is a database boot, not a function call. On a
// loaded machine that alone can pass Vitest's 5s default, which made the suite
// fail intermittently on tests that were in no way broken (seen twice on
// 2026-08-12). The work is genuinely slow rather than hung; the timeout should
// say so, and a real hang still fails, just later.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
