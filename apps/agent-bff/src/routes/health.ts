import { healthResponseSchema } from '@aic-shared/contracts';
import type { BffServer } from '@aic-shared/bff-core';

export async function registerHealthRoutes(app: BffServer): Promise<void> {
  app.get('/api/health', {
    schema: { response: { 200: healthResponseSchema } },
    handler: async () => ({ status: 'ok' as const, name: 'agent-bff' }),
  });
}
