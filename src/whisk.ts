// The Whisk conventions this app uses: who is asking from the platform's X-Whisk-* headers, JSON
// logs, the Inngest client wired to the platform queue, and calls to the Whisk API as the app.
import { Inngest } from "inngest";
import pino from "pino";

export const env = (name: string, fallback?: string): string => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`${name} is not set`);
  return v;
};

export const log = pino({ level: process.env.LOG_LEVEL ?? "info", base: { app: process.env.WHISK_APP_NAME } });

// Only the X-Whisk-* headers say who the caller is; the platform strips any copy from outside.
export type Identity = {
  audience: "anonymous" | "team" | "customer" | "service";
  userId?: string;
  email?: string;
  name?: string;
  groups: string[];
  roles: string[];
  requestId: string;
};

const list = (v: string | undefined) => (v ?? "").split(",").filter(Boolean);

export const identity = (h: (name: string) => string | undefined): Identity => ({
  audience: (h("x-whisk-audience") as Identity["audience"]) ?? "anonymous",
  userId: h("x-whisk-user-id"),
  email: h("x-whisk-email"),
  name: h("x-whisk-name"),
  groups: list(h("x-whisk-groups")),
  roles: list(h("x-whisk-roles")),
  requestId: h("x-whisk-request-id") ?? "",
});

// The app's API on Whisk, from WHISK_QUEUE_URL (https://api.whisk.run/v1/orgs/<org>/apps/<app>/events).
const appApi = (path: string) => env("WHISK_QUEUE_URL").replace(/\/events$/, "") + path;

// whiskApi calls the Whisk API as this app, with a deadline. The service token rotates daily, so
// it is read from the environment on every call. Outside Whisk (a plain local run) email is
// logged instead of sent.
export const whiskApi = async <T>(path: string, body?: unknown): Promise<T> => {
  if (!queueAvailable()) {
    log.info({ path, body: { ...(body as object), html: undefined } }, "local run: Whisk API call not made");
    return {} as T;
  }
  const res = await fetch(appApi(path), {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("WHISK_SERVICE_TOKEN")}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Whisk API ${res.status}`);
  return json as T;
};

// The Inngest client. The platform delivers function runs to /.whisk/inngest and signs them with
// WHISK_INNGEST_SIGNING_KEY. Event names are plain: the platform keeps each app's events apart.
export const inngest = new Inngest({
  id: process.env.WHISK_APP_NAME ?? "feedback",
  eventKey: process.env.WHISK_INNGEST_EVENT_KEY,
  signingKey: process.env.WHISK_INNGEST_SIGNING_KEY,
  baseUrl: process.env.WHISK_INNGEST_URL,
  isDev: process.env.WHISK_DEV === "1",
  logger: log,
});

// queueAvailable is false outside Whisk, where background work runs inline instead.
export const queueAvailable = () => !!process.env.WHISK_QUEUE_URL && !!process.env.WHISK_SERVICE_TOKEN;
// Previews run no functions.
export const isPreview = () => (process.env.WHISK_ENV ?? "").startsWith("preview:");

export const enqueue = async (name: string, data: unknown, dedupeKey?: string): Promise<void> => {
  const res = await fetch(env("WHISK_QUEUE_URL"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("WHISK_SERVICE_TOKEN")}` },
    body: JSON.stringify({ name, data, dedupe_key: dedupeKey }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`enqueue ${name}: ${res.status} ${await res.text()}`);
};

export const publicUrl = () => (process.env.WHISK_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8080}`).replace(/\/$/, "");
