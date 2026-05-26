import type { BffServer } from '@aic/bff/core';

export async function registerHealthRoutes(app: BffServer): Promise<void> {
  app.get('/api/health', async () => ({ status: 'ok', name: 'agent-bff' }));
}
