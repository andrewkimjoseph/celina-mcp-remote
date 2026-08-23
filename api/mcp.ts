import "ox";
import { waitUntil } from "@vercel/functions";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  createServer,
  drainCelinaAnalytics,
} from "@andrewkimjoseph/celina-mcp/server";

function acceptsEventStream(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.toLowerCase().includes("text/event-stream");
}

/** Plain GET/HEAD for uptime probes (e.g. EIP-8004 scanners) — not MCP clients. */
function probeResponse(request: Request): Response {
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    ok: true,
    service: "celina-mcp",
    transport: "streamable-http",
    mcp: true,
  });
}

async function handleMcp(request: Request): Promise<Response> {
  const isProbe =
    (request.method === "GET" || request.method === "HEAD") &&
    !acceptsEventStream(request);

  if (isProbe) {
    return probeResponse(request);
  }

  const server = createServer({
    serverKeyToolsEnabled: false,
    selfSessionToolsEnabled: false,
    estimateToolsEnabled: false,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);

  waitUntil(drainCelinaAnalytics());
  transport.close().catch(() => {});
  server.close().catch(() => {});

  return response;
}

export const POST = handleMcp;
export const GET = handleMcp;
export const DELETE = handleMcp;
