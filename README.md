<p align="center">
  <img src="https://raw.githubusercontent.com/andrewkimjoseph/celina/main/assets/celina-banner.svg" alt="Celina — Give your LLM a wallet on Celo">
</p>

# Celina MCP Remote

Celina is a third-party, open-source stack that gives an LLM read, prepare, and execute access to Celo mainnet through an SDK, an MCP server, and a REST API. This is the hosted MCP endpoint — a backend-only Cloudflare Worker (Hono) that exposes [celina-mcp](../celina-mcp) over **Streamable HTTP** and **A2A**. No framework UI, no assets beyond a static landing page.

This is the **hosted read/prepare profile** of the shared [`@andrewkimjoseph/celina-sdk/tools`](https://www.npmjs.com/package/@andrewkimjoseph/celina-sdk) catalog — the same definitions local stdio MCP and browser wallet apps use, filtered with no server keys.

**Tool surface:** **48 tools** — chain reads, humanness check, governance/staking reads (including `get_queued_proposals`, `get_actionable_governance_proposals`, `get_governance_delegates`, `get_governance_delegate_details`), oracle/AMM quotes (`get_mento_fx_quote`, `get_uniswap_quote`, `get_gooddollar_reserve_quote`), attribution (`check_attribution_tag`, `verify_attribution_tag`), Aave supplied balances, GoodDollar identity link/whitelist/entitlement, Self verify/lookup, and AgentKarma reputation. No `CELO_PRIVATE_KEY` or `SELF_AGENT_PRIVATE_KEY` on the server; **`estimate_*`**, server-key writes (`send_token`, `execute_lock_celo`, `execute_stake`, etc.), `get_wallet_address`, GoodDollar claim/connect/disconnect writes, Self lifecycle, and Self registration session tools are **omitted** from `tools/list`.

GoodDollar: **`get_gooddollar_whitelisting_info`**, **`get_gooddollar_identity_link`**, **`get_gooddollar_ubi_entitlement`**, and **`get_gooddollar_reserve_quote`** on hosted. **`estimate_gooddollar_reserve_swap`**, **`execute_gooddollar_reserve_swap`**, **`claim_daily_gooddollar_ubi`**, and identity connect/disconnect writes require local stdio MCP with `CELO_PRIVATE_KEY`. See [GoodDollar section](../celina-mcp/README.md#gooddollar).

**Dependencies:** `@andrewkimjoseph/celina-mcp` (exact npm version) and `@modelcontextprotocol/sdk`, routed through a small [Hono](https://hono.dev) app. Chain logic and swap libraries come transitively through celina-mcp → celina-sdk — no `file:` links in the deployed Worker.

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/mcp` | GET, POST, DELETE | MCP Streamable HTTP (plain GET/HEAD without `Accept: text/event-stream` returns a JSON probe for uptime scanners) |
| `/a2a` | GET, POST, HEAD | A2A agent card + `message/send` (hosted read tools only; server-key writes rejected) |
| `/health` | GET | Health check |

Production:

- MCP: [https://mcp.usecelina.xyz/mcp](https://mcp.usecelina.xyz/mcp)
- A2A: [https://mcp.usecelina.xyz/a2a](https://mcp.usecelina.xyz/a2a)

## Setup

```bash
cp .env.example .dev.vars   # optional — wrangler loads this for local dev
npm install
```

Requires Node.js ≥ 20. Install published npm packages — do not use local `file:` links in production.

## Local dev

```bash
npm run dev          # wrangler dev
npm run test:smoke   # expects 48 hosted tools, estimate_* and server-key tools absent
```

`npm run dev` starts `wrangler dev` — connect MCP Inspector (Streamable HTTP) to `http://localhost:8787/mcp`. `npm run test:smoke` calls the Hono app in-process via `app.request(...)` (no server needs to be running).

## Deploy to Cloudflare Workers

1. Cloudflare dashboard → Workers & Pages → Create → Workers → **Connect to Git** → select the `celina-mcp-remote` repository, branch `main`.
2. Build command: `npm install`. Deploy command: `npx wrangler deploy` (or leave defaults — [`wrangler.jsonc`](wrangler.jsonc) drives the build).
3. Set environment variables (Worker vars/secrets) in the dashboard:

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `CELO_RPC_URL_MAINNET` | Optional | Defaults to `https://forno.celo.org`; use a dedicated provider in production |
   | `ETH_RPC_URL_MAINNET` | Optional | ENS resolution |
   | `CELINA_A2A_BASE_URL` | Optional | Public base URL for A2A agent card (default `https://mcp.usecelina.xyz`) |

   Do **not** set `CELO_PRIVATE_KEY` or `SELF_AGENT_PRIVATE_KEY`.
4. Validate on the assigned `*.workers.dev` URL before pointing `mcp.usecelina.xyz` DNS at the Worker.

For manual deploys from a checkout: `npx wrangler deploy`.

## MCP client config

```json
{
  "mcpServers": {
    "celina-mcp": {
      "url": "https://mcp.usecelina.xyz/mcp"
    }
  }
}
```

For stdio-only clients, use [mcp-remote](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "celina-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.usecelina.xyz/mcp"]
    }
  }
}
```

## How it links to celina-mcp

[`src/mcp-handler.ts`](src/mcp-handler.ts) imports `createServer` from `@andrewkimjoseph/celina-mcp/server`:

```ts
createServer({
  serverKeyToolsEnabled: false,
  selfSessionToolsEnabled: false,
  estimateToolsEnabled: false,
})
```

[`src/app.ts`](src/app.ts) imports `handleA2ARequest` from `@andrewkimjoseph/celina-mcp/a2a` with the same hosted filter — A2A `message/send` can invoke read tools only; writes like `send_token` are rejected. It also copies the Worker's `env` bindings into `process.env` on every request, since celina-mcp's `loadConfig()` reads `process.env.*` directly and Cloudflare Workers don't do this automatically.

`createServer` calls `registerSdkTools`, which filters `ALL_TOOL_DEFINITIONS` from celina-sdk. Chain logic and handlers live in celina-sdk; celina-mcp wires them to MCP; this repo only provides the Streamable HTTP and A2A entrypoints on a Cloudflare Worker.

## Hosted constraints

Server-key writes and all `estimate_*` gas simulation tools are omitted from `tools/list` on hosted. Use local stdio MCP with `CELO_PRIVATE_KEY` / `SELF_AGENT_PRIVATE_KEY` for `send_token`, governance/staking executes, GoodDollar claims, etc.

Self registration sessions (`register_self_agent` → `check_self_registration`) are unreliable on this deployment because session state is in-memory per Worker isolate — use local stdio for Self Agent ID lifecycle flows.

See [celina-mcp README — Hosted](../celina-mcp/README.md#hosted-reads--prepare) for full tool coverage.

## Security

The hosted endpoint is **intentionally public** (no API key): read/prepare tools only, no server private keys. Automated scanners that require authentication on `tools/list` will report failures for this deployment profile — see [SECURITY.md](./SECURITY.md) for the threat model and what is exposed.
