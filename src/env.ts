export type WorkerEnv = {
  CELO_RPC_URL_MAINNET?: string;
  ETH_RPC_URL_MAINNET?: string;
  CELINA_A2A_BASE_URL?: string;
};

export const DEFAULT_A2A_BASE_URL = "https://mcp.usecelina.xyz";

/**
 * Cloudflare Workers don't populate `process.env` from bindings — celina-mcp's
 * `loadConfig()` reads `process.env.*` directly, so copy the Worker's `env`
 * into `process.env` once per isolate before it's read.
 */
export function copyEnvToProcessEnv(env: WorkerEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
