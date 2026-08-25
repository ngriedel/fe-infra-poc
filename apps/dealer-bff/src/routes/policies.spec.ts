import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { dealerPoliciesResponseSchema } from '@aic/dealer/contracts';

/**
 * A full upstream ESL record — all 24 fields, as the ESL actually returns them.
 *
 * Note this test deliberately does NOT import the agent or broker contracts to
 * compare against: `scope:dealer` may only depend on `scope:dealer` and
 * `scope:shared`, and the lint rule rejects anything else. That restriction IS
 * the feature, so the expectations below are spelled out by name instead.
 */
const UPSTREAM = {
  id: 'POL-1234',
  product: 'Motor Comprehensive',
  status: 'ACTIVE',
  monthlyPremium: 950,
  fieldA: 'A-1',
  fieldB: 'B-2',
  fieldC: 3,
  fieldD: 4,
  fieldE: true,
  fieldF: 'F-6',
  fieldG: 7,
  fieldH: false,
  fieldI: 'I-9',
  fieldJ: 10,
  fieldK: 'K-11',
  fieldL: true,
  fieldM: 13,
  fieldN: 'N-14',
  fieldO: 15,
  fieldP: 'P-16',
  fieldQ: false,
  fieldR: 18,
  fieldS: 'S-19',
  fieldT: 'T-20',
};

/** Exactly what the dealer frontend is entitled to see. */
const DEALER_FIELDS = [
  'id',
  'product',
  'status',
  'monthlyPremium',
  'fieldF',
  'fieldG',
  'fieldH',
  'fieldI',
  'fieldJ',
];

/** Belongs to agent (A–E) or broker (K–O). */
const OTHER_AUDIENCES = [
  'fieldA',
  'fieldB',
  'fieldC',
  'fieldD',
  'fieldE',
  'fieldK',
  'fieldL',
  'fieldM',
  'fieldN',
  'fieldO',
];

/** In the ESL but wanted by nobody — must never leave any BFF. */
const UNUSED_BY_ANYONE = ['fieldP', 'fieldQ', 'fieldR', 'fieldS', 'fieldT'];

async function buildLeakyServer() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.get('/api/policies', {
    schema: { response: { 200: dealerPoliciesResponseSchema } },
    // Deliberately leaky handler: hands back the whole 24-field upstream record,
    // simulating a mapper that forgot to project.
    handler: async () => ({ policies: [UPSTREAM] }) as never,
  });
  await app.ready();
  return app;
}

describe('dealer policy projection', () => {
  /**
   * The safety net. The route's mapper lists fields one by one, but if it ever
   * leaked, the response schema is the second line of defence: the serializer
   * runs the payload through the contract, and zod objects drop unknown keys.
   */
  it('strips every upstream field the dealer contract does not declare', async () => {
    const app = await buildLeakyServer();

    const res = await app.inject({ method: 'GET', url: '/api/policies' });
    expect(res.statusCode).toBe(200);

    const [policy] = res.json().policies;
    expect(Object.keys(policy).sort()).toEqual([...DEALER_FIELDS].sort());

    await app.close();
  });

  it('never exposes another audience’s fields', async () => {
    const app = await buildLeakyServer();
    const [policy] = (await app.inject({ method: 'GET', url: '/api/policies' })).json().policies;

    for (const field of OTHER_AUDIENCES) {
      expect(policy[field]).toBeUndefined();
    }
    await app.close();
  });

  it('never exposes fields no frontend asked for', async () => {
    const app = await buildLeakyServer();
    const [policy] = (await app.inject({ method: 'GET', url: '/api/policies' })).json().policies;

    for (const field of UNUSED_BY_ANYONE) {
      expect(policy[field]).toBeUndefined();
    }
    await app.close();
  });

  it('keeps the dealer-specific fields it does declare', () => {
    const parsed = dealerPoliciesResponseSchema.parse({ policies: [UPSTREAM] });
    expect(parsed.policies[0]).toEqual({
      id: 'POL-1234',
      product: 'Motor Comprehensive',
      status: 'ACTIVE',
      monthlyPremium: 950,
      fieldF: 'F-6',
      fieldG: 7,
      fieldH: false,
      fieldI: 'I-9',
      fieldJ: 10,
    });
  });
});
