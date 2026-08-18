import { GET, POST } from "../api/mcp.js";
import { GET as a2aGet, POST as a2aPost } from "../api/a2a.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main(): Promise<void> {
  const probeRes = await GET(
    new Request("http://localhost/api/mcp", { method: "GET" }),
  );
  if (probeRes.status !== 200) {
    throw new Error(`expected GET probe status 200, got ${probeRes.status}`);
  }
  const probeBody = (await probeRes.json()) as { ok?: boolean; mcp?: boolean };
  if (probeBody.ok !== true || probeBody.mcp !== true) {
    throw new Error(`unexpected GET probe body: ${JSON.stringify(probeBody)}`);
  }
  console.log("GET probe ok");

  const initBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
  };

  const req = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(initBody),
  });

  const res = await POST(req);
  console.log("initialize status", res.status);
  const text = await res.text();
  console.log("initialize body", text.slice(0, 400));

  const toolsBody = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  const toolsReq = new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(toolsBody),
  });

  const toolsRes = await POST(toolsReq);
  console.log("tools/list status", toolsRes.status);
  const toolsText = await toolsRes.text();
  const parsed = JSON.parse(toolsText) as {
    result?: { tools?: { name: string }[] };
  };
  const tools = parsed.result?.tools ?? [];
  const names = tools.map((t) => t.name);
  console.log("tool count", tools.length);
  console.log("sample tools", names.slice(0, 3));

  for (const excluded of [
    "send_token",
    "get_wallet_address",
    "register_self_agent",
    "execute_mento_fx",
    "get_self_identity",
    "estimate_send",
  ]) {
    if (names.includes(excluded)) {
      throw new Error(`${excluded} must not be on hosted MCP`);
    }
  }
  if (names.some((n) => n.startsWith("estimate_"))) {
    throw new Error("estimate_* must not be on hosted MCP");
  }
  if (tools.length !== 46) {
    throw new Error(`expected 48 tools on hosted MCP, got ${tools.length}`);
  }
  console.log("hosted tool surface check ok");

  // Demo Self agent #1 — registered on-chain; default age/OFAC gates may return verified:false.
  const selfAgentAddress = "0xC1C860804EFdA544fe79194d1a37e60b846CEdeb";
  const verifyBody = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "verify_self_agent",
      arguments: {
        agent_address: selfAgentAddress,
      },
    },
  };

  const verifyRes = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(verifyBody),
    }),
  );
  const verifyText = await verifyRes.text();
  const verifyParsed = JSON.parse(verifyText) as {
    result?: {
      isError?: boolean;
      structuredContent?: {
        verified?: boolean;
        agent_address?: string;
        agent_id?: number;
      };
    };
  };
  if (verifyParsed.result?.isError) {
    throw new Error(`verify_self_agent failed: ${verifyText}`);
  }
  const verifyContent = verifyParsed.result?.structuredContent;
  if (verifyContent?.agent_address !== selfAgentAddress) {
    throw new Error(`verify_self_agent unexpected address: ${verifyText}`);
  }
  if (typeof verifyContent?.verified !== "boolean") {
    throw new Error(`verify_self_agent missing verified flag: ${verifyText}`);
  }
  if (verifyContent?.agent_id !== 1) {
    throw new Error(`verify_self_agent unexpected agent_id: ${verifyText}`);
  }
  console.log("verify_self_agent ok");

  const blockRes = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "get_block",
          arguments: { block_id: " latest" },
        },
      }),
    }),
  );
  const blockText = await blockRes.text();
  const blockParsed = JSON.parse(blockText) as {
    result?: { isError?: boolean; structuredContent?: { hash?: string } };
  };
  if (blockParsed.result?.isError) {
    throw new Error(`get_block failed: ${blockText}`);
  }
  if (!blockParsed.result?.structuredContent?.hash) {
    throw new Error(`get_block unexpected result: ${blockText}`);
  }
  console.log("get_block ok");

  const quoteRes = await POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "get_mento_fx_quote",
          arguments: {
            token_in: "USDm",
            token_out: "EURm",
            amount: "1",
          },
        },
      }),
    }),
  );
  const quoteText = await quoteRes.text();
  const quoteParsed = JSON.parse(quoteText) as {
    result?: { isError?: boolean; structuredContent?: { expectedOut?: string } };
  };
  if (quoteParsed.result?.isError) {
    throw new Error(`get_mento_fx_quote failed: ${quoteText}`);
  }
  if (!quoteParsed.result?.structuredContent?.expectedOut) {
    throw new Error(`get_mento_fx_quote unexpected result: ${quoteText}`);
  }
  console.log("get_mento_fx_quote ok");

  const cardPath = join(
    import.meta.dirname,
    "../../celina-website/public/.well-known/agent-card.json",
  );
  const card = JSON.parse(readFileSync(cardPath, "utf8")) as {
    name?: string;
    url?: string;
    skills?: unknown[];
  };
  if (card.name !== "Celina" || !card.url?.endsWith("/api/a2a")) {
    throw new Error(`unexpected agent card: ${JSON.stringify(card).slice(0, 200)}`);
  }
  if (!card.skills?.length) {
    throw new Error("agent card must list skills");
  }
  console.log("agent-card.json ok", card.skills.length, "skills");

  const oasfPath = join(
    import.meta.dirname,
    "../../celina-website/public/.well-known/oasf.json",
  );
  const oasf = JSON.parse(readFileSync(oasfPath, "utf8")) as {
    name?: string;
    skills?: unknown[];
    domains?: unknown[];
  };
  if (oasf.name !== "Celina" || !oasf.skills?.length || !oasf.domains?.length) {
    throw new Error(`unexpected oasf.json: ${JSON.stringify(oasf).slice(0, 200)}`);
  }
  console.log("oasf.json ok", oasf.skills.length, "skills");

  const agentJsonPath = join(
    import.meta.dirname,
    "../../celina-website/public/agent.json",
  );
  const agentJson = JSON.parse(readFileSync(agentJsonPath, "utf8")) as {
    services?: Array<{ name: string; endpoint?: string }>;
  };
  const serviceNames = new Set(agentJson.services?.map((s) => s.name));
  for (const required of ["MCP", "A2A", "OASF"]) {
    if (!serviceNames.has(required)) {
      throw new Error(`agent.json missing ${required} service`);
    }
  }
  const a2aSvc = agentJson.services?.find((s) => s.name === "A2A");
  if (!a2aSvc?.endpoint?.includes("usecelina.xyz/.well-known/agent-card.json")) {
    throw new Error(`agent.json A2A endpoint wrong: ${a2aSvc?.endpoint}`);
  }
  console.log("agent.json discovery services ok");

  const a2aCardRes = await a2aGet(
    new Request("http://localhost/api/a2a", { method: "GET" }),
  );
  if (a2aCardRes.status !== 200) {
    throw new Error(`A2A GET card status ${a2aCardRes.status}`);
  }
  const liveCard = (await a2aCardRes.json()) as { url?: string };
  if (!liveCard.url?.endsWith("/api/a2a")) {
    throw new Error(`A2A GET handler card missing url: ${JSON.stringify(liveCard)}`);
  }
  console.log("A2A GET agent card ok");

  const a2aSendRes = await a2aPost(
    new Request("http://localhost/api/a2a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "a2a-1",
        method: "message/send",
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            kind: "message",
            parts: [
              {
                kind: "data",
                data: {
                  tool: "get_network_status",
                  arguments: {},
                },
              },
            ],
          },
        },
      }),
    }),
  );
  const a2aSendText = await a2aSendRes.text();
  if (a2aSendRes.status !== 200) {
    throw new Error(`A2A message/send status ${a2aSendRes.status}: ${a2aSendText}`);
  }
  const a2aParsed = JSON.parse(a2aSendText) as {
    result?: {
      parts?: Array<{ kind: string; data?: { result?: { chainId?: number } } }>;
    };
  };
  const dataPart = a2aParsed.result?.parts?.find((p) => p.kind === "data");
  if (!dataPart?.data?.result?.chainId) {
    throw new Error(`A2A get_network_status unexpected: ${a2aSendText.slice(0, 500)}`);
  }
  console.log("A2A get_network_status ok", dataPart.data.result.chainId);

  const rejectRes = await a2aPost(
    new Request("http://localhost/api/a2a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "a2a-2",
        method: "message/send",
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            kind: "message",
            parts: [
              {
                kind: "data",
                data: {
                  tool: "send_token",
                  arguments: { to: "0x0", token: "USDm", amount: "1" },
                },
              },
            ],
          },
        },
      }),
    }),
  );
  const rejectText = await rejectRes.text();
  const rejectParsed = JSON.parse(rejectText) as {
    result?: { parts?: Array<{ kind: string; text?: string }> };
  };
  const errText = rejectParsed.result?.parts?.find((p) => p.kind === "text")?.text;
  if (!errText?.includes("not available on hosted A2A")) {
    throw new Error(`expected send_token rejection, got: ${rejectText}`);
  }
  console.log("A2A write tool rejection ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
