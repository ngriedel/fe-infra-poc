import { healthResponseSchema } from '@aic/bff/contracts';
import type { BffServer } from '@aic/bff/core';

export async function registerHealthRoutes(app: BffServer): Promise<void> {
  app.get('/api/health', {
    schema: { response: { 200: healthResponseSchema } },
    handler: async () => ({ status: 'ok' as const, name: 'client-bff' }),
  });
}
