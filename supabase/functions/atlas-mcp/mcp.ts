/**
 * Le protocole MCP, réduit à ce qu'un connecteur d'outils utilise
 * (docs/connecteur-claude.md §3) — règles pures, sans Deno ni base, testées
 * par Vitest (`src/core/lib/mcpServer.test.ts`).
 *
 * Transport « Streamable HTTP » **sans session** : chaque requête POST porte
 * un message JSON-RPC (ou un lot), la réponse est un JSON simple, jamais un
 * flux SSE. C'est permis par la spécification, et c'est tout ce dont un
 * serveur d'outils sans notifications a besoin. Écrit ici plutôt que pris au
 * SDK : quatre méthodes, aucune dépendance de plus à suivre, et tout se teste
 * sans réseau.
 */

/** Les versions du protocole comprises ; la première est proposée par défaut. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Ce qu'un outil rend : un texte pour Claude, ou une erreur qu'il lira et expliquera. */
export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface Tool<C> {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Indices pour Claude : lecture seule, ou geste qui détruit (il demandera confirmation). */
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run(args: Record<string, unknown>, context: C): Promise<ToolResult>;
}

export interface ServerInfo {
  name: string;
  title: string;
  version: string;
  instructions: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function reply(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function fail(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Un message JSON-RPC → sa réponse, ou `null` pour une notification (qui
 * n'en attend aucune). Une erreur dans un outil n'est pas une erreur du
 * protocole : elle revient comme un résultat `isError`, que Claude lit et
 * peut corriger (un jour mal écrit, une recette introuvable).
 */
export async function handleMessage<C>(
  message: unknown,
  tools: readonly Tool<C>[],
  server: ServerInfo,
  context: C,
): Promise<JsonRpcResponse | null> {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return fail(isObject(message) ? (message.id as JsonRpcRequest['id']) : null, -32600, 'Requête JSON-RPC invalide.');
  }
  const request = message as unknown as JsonRpcRequest;
  const notification = request.id === undefined;
  if (notification) return null;
  const params = isObject(request.params) ? request.params : {};

  switch (request.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const version = (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return reply(request.id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.name, title: server.title, version: server.version },
        instructions: server.instructions,
      });
    }
    case 'ping':
      return reply(request.id, {});
    case 'tools/list':
      return reply(request.id, {
        tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { title, ...annotations },
        })),
      });
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return fail(request.id, -32602, `Outil inconnu : ${String(params.name)}.`);
      const args = isObject(params.arguments) ? params.arguments : {};
      let result: ToolResult;
      try {
        result = await tool.run(args, context);
      } catch (err) {
        result = { text: err instanceof Error ? err.message : 'L’outil a échoué.', isError: true };
      }
      return reply(request.id, { content: [{ type: 'text', text: result.text }], isError: result.isError === true });
    }
    default:
      return fail(request.id, -32601, `Méthode non prise en charge : ${request.method}.`);
  }
}

/**
 * Le corps d'une requête POST → ce qu'on répond : `null` quand il n'y avait
 * que des notifications (HTTP 202, sans corps), sinon la réponse ou le lot de
 * réponses (HTTP 200).
 */
export async function handleBody<C>(
  body: unknown,
  tools: readonly Tool<C>[],
  server: ServerInfo,
  context: C,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, -32600, 'Lot vide.');
    const answers = (await Promise.all(body.map((m) => handleMessage(m, tools, server, context)))).filter(
      (a): a is JsonRpcResponse => a !== null,
    );
    return answers.length ? answers : null;
  }
  return handleMessage(body, tools, server, context);
}
