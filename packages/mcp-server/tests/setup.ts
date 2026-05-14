import { afterAll, afterEach, beforeAll } from 'vitest';
import { __resetCacheForTests } from '../src/lib/cache.js';
import { __resetRateLimitForTests } from '../src/lib/rateLimit.js';
import { mswServer } from './helpers/mswServer.js';

// Garante que toda chamada HTTP nos testes seja explicitamente mockada.
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  mswServer.resetHandlers();
  await __resetCacheForTests();
  __resetRateLimitForTests();
});

afterAll(() => mswServer.close());
