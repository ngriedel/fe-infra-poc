import type { z } from 'zod';
import { createApiClient, schemas } from './esl.generated';

/** Upstream policy DTO, inferred from the generated OpenAPI→Zod contract. */
export type Policy = z.infer<typeof schemas.Policy>;

/** Identity the BFF forwards upstream as plain headers (HMAC is a prod concern, skipped in the POC). */
export interface EslIdentity {
  userId: string;
  email?: string;
  roles?: string[];
}

export interface EslClient {
  getPolicies(identity: EslIdentity): Promise<Policy[]>;
}

/**
 * Typed, runtime-validated client for the upstream ESL, generated from its
 * OpenAPI contract (`esl.generated.ts`, via `openapi-zod-client` + Zodios).
 * Zodios validates every response against the generated Zod schema, so upstream
 * contract drift fails HERE rather than leaking malformed data downstream.
 *
 * Regenerate after an ESL contract change:
 *   openapi-zod-client libs/bff/esl-client/openapi/esl.openapi.json \
 *     -o libs/bff/esl-client/src/lib/esl.generated.ts --export-schemas
 */
export function createEslClient(baseUrl: string): EslClient {
  const api = createApiClient(baseUrl);
  return {
    getPolicies(identity) {
      return api.policies({
        headers: {
          'X-User-Id': identity.userId,
          'X-User-Email': identity.email ?? '',
          'X-User-Roles': (identity.roles ?? []).join(','),
        },
      });
    },
  };
}
