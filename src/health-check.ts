export const HEALTH_CHECK_TIMEOUT_MS = 2_000;
/** Optional ENS probe. Stays under the status page's 1s slow threshold. */
export const ETH_HEALTH_TIMEOUT_MS = 800;

export async function checkUrl(
  url: string,
  init: RequestInit = {},
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export function rpcChainIdInit(): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  };
}
