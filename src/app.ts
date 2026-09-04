import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { handleA2ARequest } from "@andrewkimjoseph/celina-mcp/a2a";
import { copyEnvToProcessEnv, DEFAULT_A2A_BASE_URL, type WorkerEnv } from "./env.js";
import { handleMcp } from "./mcp-handler.js";

type AppBindings = { Bindings: WorkerEnv };

function safeWaitUntil(c: Context<AppBindings>, promise: Promise<unknown>): void {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    // No Worker ExecutionContext outside a real request (e.g. local smoke tests).
    promise.catch(() => {});
  }
}

export function createApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.use("*", cors());

  app.use("*", async (c, next) => {
    copyEnvToProcessEnv(c.env ?? {});
    await next();
  });

  app.on(["GET", "POST", "HEAD", "DELETE"], "/mcp", (c) =>
    handleMcp(c.req.raw, (promise) => safeWaitUntil(c, promise)),
  );

  app.on(["GET", "POST", "HEAD"], "/a2a", (c) => {
    const baseUrl = c.env?.CELINA_A2A_BASE_URL ?? DEFAULT_A2A_BASE_URL;
    return handleA2ARequest(c.req.raw, { baseUrl });
  });

  app.get("/health", (c) => c.json({ ok: true, service: "celina-mcp" }));

  return app;
}

export const app = createApp();
