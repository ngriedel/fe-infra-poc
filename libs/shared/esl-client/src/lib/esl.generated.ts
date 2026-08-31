import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core';
import * as z from 'zod';

const Policy = z
  .object({
    id: z.string(),
    product: z.string(),
    status: z.string(),
    monthlyPremium: z.number().int(),
    fieldA: z.string(),
    fieldB: z.string(),
    fieldC: z.number().int(),
    fieldD: z.number().int(),
    fieldE: z.boolean(),
    fieldF: z.string(),
    fieldG: z.number().int(),
    fieldH: z.boolean(),
    fieldI: z.string(),
    fieldJ: z.number().int(),
    fieldK: z.string(),
    fieldL: z.boolean(),
    fieldM: z.number().int(),
    fieldN: z.string(),
    fieldO: z.number().int(),
    fieldP: z.string(),
    fieldQ: z.boolean(),
    fieldR: z.number().int(),
    fieldS: z.string(),
    fieldT: z.string(),
  })
  .passthrough();
const Identity = z
  .object({ userId: z.string(), email: z.string(), roles: z.array(z.string()) })
  .passthrough();

export const schemas = {
  Policy,
  Identity,
};

const endpoints = makeApi([
  {
    method: 'get',
    path: '/api/me',
    alias: 'me',
    requestFormat: 'json',
    parameters: [
      {
        name: 'X-User-Id',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'X-User-Email',
        type: 'Header',
        schema: z.string().optional(),
      },
      {
        name: 'X-User-Roles',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: Identity,
  },
  {
    method: 'get',
    path: '/api/policies',
    alias: 'policies',
    requestFormat: 'json',
    parameters: [
      {
        name: 'X-User-Id',
        type: 'Header',
        schema: z.string().optional(),
      },
    ],
    response: z.array(Policy),
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
