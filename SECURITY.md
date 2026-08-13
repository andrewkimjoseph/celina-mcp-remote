# Security — Celina remote MCP

Production endpoint: [https://mcp.usecelina.xyz/api/mcp](https://mcp.usecelina.xyz/api/mcp)

## Deployment profile

This deployment is a **public, read-only / prepare-only** MCP server:

- **46 tools** — chain reads, oracle/AMM quotes, governance/staking reads, Aave supplied balances, GoodDollar identity link/whitelist/entitlement, Self verify/lookup, AgentKarma reputation (read-only external API)
- **No server signing keys** — `CELO_PRIVATE_KEY` and `SELF_AGENT_PRIVATE_KEY` are not configured
- **No fund movement** — hosted `tools/call` cannot send tokens, execute swaps, or sign transactions; writes require a user wallet elsewhere (local stdio MCP, browser app, or wallet)

## Authentication

**There is no API key or Bearer token on `/api/mcp`.** This is intentional:

- MCP clients (Cursor, Claude Desktop, mcp-remote, etc.) connect without pre-shared credentials
- The surface is read/prepare only; omitting auth reduces friction for agent builders
- Automated security scans that expect `401`/`403` on unauthenticated `tools/list` will **fail by design** for this profile — that is not a vulnerability for this deployment

If you need a private MCP with server keys and writes, run [celina-mcp](https://github.com/andrewkimjoseph/celina-mcp) locally via stdio with your own env vars.

## What is exposed

| Exposure | Details |
|----------|---------|
| `tools/list` | Tool names, descriptions, and JSON input schemas |
| `tools/call` | On-chain reads via RPC; unsigned transaction payloads for prepare tools (Mento, Uniswap, GoodDollar reserve) |
| Secrets | None — no private keys in the Vercel environment |

## Abuse mitigations

- Vercel serverless execution limits (duration, memory, concurrency)
- RPC provider rate limits on `CELO_RPC_URL_MAINNET`
- Read-only tool surface — no `send_token`, `execute_*`, or `estimate_*` on hosted
- Stateless serverless — no durable session store for Self registration flows on hosted

## Transport

- HTTPS via Vercel (TLS terminated at the edge)
- HSTS and platform headers managed by Vercel

## Reporting

Report security concerns via [GitHub Issues](https://github.com/andrewkimjoseph/celina-mcp-remote/issues) on the celina-mcp-remote repository (or the celina meta-repo if unsure which submodule owns the finding).
