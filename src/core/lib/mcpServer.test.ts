import { describe, expect, it } from 'vitest';
import { handleBody, PROTOCOL_VERSIONS, type Tool } from '../../../supabase/functions/atlas-mcp/mcp.ts';

const server = { name: 'atlas', title: 'Atlas', version: 'test', instructions: 'Bonjour.' };
const tools: Tool<{ n: number }>[] = [
  {
    name: 'compter',
    title: 'Compter',
    description: 'Rend n.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => ({ text: String(ctx.n) }),
  },
  {
    name: 'casser',
    title: 'Casser',
    description: 'Échoue.',
    inputSchema: { type: 'object' },
    annotations: {},
    run: async () => {
      throw new Error('Recette introuvable.');
    },
  },
];
const call = (body: unknown) => handleBody(body, tools, server, { n: 7 });

describe('le protocole MCP du connecteur', () => {
  it('se présente, à la version demandée si on la connaît', async () => {
    const answer = (await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })) as {
      result: Record<string, unknown>;
    };
    expect(answer.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'atlas' }, capabilities: { tools: {} }, instructions: 'Bonjour.' });
    const other = (await call({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })) as {
      result: { protocolVersion: string };
    };
    expect(other.result.protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
  });

  it('une notification n’attend pas de réponse', async () => {
    expect(await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(await call([{ jsonrpc: '2.0', method: 'notifications/initialized' }])).toBeNull();
  });

  it('liste les outils, avec leurs indices', async () => {
    const answer = (await call({ jsonrpc: '2.0', id: 3, method: 'tools/list' })) as { result: { tools: { name: string; annotations: object }[] } };
    expect(answer.result.tools.map((t) => t.name)).toEqual(['compter', 'casser']);
    expect(answer.result.tools[0].annotations).toEqual({ title: 'Compter', readOnlyHint: true });
  });

  it('appelle un outil ; son échec est un résultat que Claude lit', async () => {
    expect(await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'compter', arguments: {} } })).toEqual({
      jsonrpc: '2.0',
      id: 4,
      result: { content: [{ type: 'text', text: '7' }], isError: false },
    });
    expect(await call({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'casser' } })).toMatchObject({
      result: { content: [{ text: 'Recette introuvable.' }], isError: true },
    });
  });

  it('refuse l’inconnu sans tomber', async () => {
    expect(await call({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'voler' } })).toMatchObject({ error: { code: -32602 } });
    expect(await call({ jsonrpc: '2.0', id: 7, method: 'resources/list' })).toMatchObject({ error: { code: -32601 } });
    expect(await call({ id: 8 })).toMatchObject({ error: { code: -32600 } });
    expect(await call({ jsonrpc: '2.0', id: 9, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 9, result: {} });
  });

  it('un lot rend un lot', async () => {
    const answers = await call([
      { jsonrpc: '2.0', id: 'a', method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 'b', method: 'ping' },
    ]);
    expect(answers).toEqual([
      { jsonrpc: '2.0', id: 'a', result: {} },
      { jsonrpc: '2.0', id: 'b', result: {} },
    ]);
  });
});
