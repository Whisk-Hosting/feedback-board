import { serve as nodeServe } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { serve as inngestServe } from "inngest/hono";
import { api } from "./api.js";
import { sql } from "./db.js";
import { demoRoutes } from "./demo.js";
import { functions } from "./functions.js";
import { signedIn } from "./model.js";
import { boardRoutes } from "./routes/board.js";
import { changelogRoutes } from "./routes/changelog.js";
import { ideaRoutes } from "./routes/ideas.js";
import { manageRoutes } from "./routes/manage.js";
import { js } from "./views/scripts.js";
import { css } from "./views/styles.js";
import { notFound, signIn, viewer } from "./web.js";
import { env, identity, inngest, log } from "./whisk.js";

const app = new Hono();

// Every request: one JSON log line with the request id.
app.use("*", async (c, next) => {
  const started = Date.now();
  await next();
  const id = identity((n) => c.req.header(n));
  log.info({ request_id: id.requestId, method: c.req.method, path: c.req.path, status: c.res.status, audience: id.audience, ms: Date.now() - started }, "request");
});

app.get("/health", async (c) => {
  try {
    await sql`select 1`;
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 503);
  }
});

app.get("/assets/app.css", (c) => c.body(css, 200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=3600" }));
app.get("/assets/app.js", (c) => c.body(js, 200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=3600" }));

// On Whisk the edge serves the font from public/fonts (static in whisk.yaml); this covers local runs.
app.get("/fonts/:file", async (c) => {
  const file = c.req.param("file");
  const data = /^[a-z0-9-]+\.woff2$/.test(file) ? await readFile(`public/fonts/${file}`).catch(() => undefined) : undefined;
  return data ? c.body(new Uint8Array(data), 200, { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable" }) : c.notFound();
});

// Function runs arrive here from the platform with the service identity (queue.endpoint).
const inngestHandler = inngestServe({ client: inngest, functions });
app.on(["GET", "POST", "PUT"], "/.whisk/inngest", (c) => inngestHandler(c));

// The API checks its own keys (api.ts), so it goes ahead of the signed-in check below.
app.route("/api/v1", api);

demoRoutes(app);

// Every change needs a signed-in person. The platform already signs people in before a private
// route; this also covers the demo, where every route is public.
app.use("*", async (c, next) => {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.path.startsWith("/.whisk/") || c.req.path.startsWith("/demo/")) return next();
  if (!signedIn(viewer(c))) return c.req.header("accept")?.includes("json") ? c.json({ error: { code: "SIGN_IN", message: "Sign in first.", fix: "Sign in, then try again." } }, 401) : signIn(c, "/");
  return next();
});

boardRoutes(app);
ideaRoutes(app);
changelogRoutes(app);
manageRoutes(app);

app.notFound((c) =>
  c.req.path.startsWith("/api/") ? c.json({ error: { code: "NOT_FOUND", message: "There is no such API endpoint.", fix: "GET /api/v1 lists the endpoints." } }, 404) : notFound(c),
);

app.onError((err, c) => {
  const ref = identity((n) => c.req.header(n)).requestId.replace(/[^A-Za-z0-9_-]/g, "") || "none";
  log.error({ request_id: ref, err: err.message, stack: err.stack }, "unhandled error");
  if (c.req.path.startsWith("/api/")) return c.json({ error: { code: "INTERNAL", message: "Something went wrong.", fix: `Try again. If it keeps happening, quote ${ref}.` } }, 500);
  return c.html(
    `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Something went wrong</title><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>Something went wrong</h1><p>Try again in a moment. Reference: ${ref}</p><p><a href="/">Back to the board</a></p></body>`,
    500,
  );
});

const server = nodeServe({ fetch: app.fetch, port: Number(env("PORT", "8080")), hostname: "0.0.0.0" }, (info) => log.info({ port: info.port }, "listening"));

// SIGTERM: stop accepting, finish in-flight requests, close the pool, exit within the grace period.
const shutdown = () => {
  log.info("shutting down");
  server.close(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
  setTimeout(() => process.exit(1), (Number(process.env.WHISK_STOP_GRACE ?? 28) - 2) * 1000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
