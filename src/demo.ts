// Demo mode, for the public demo of this example and nothing else (examples/demo-mode.md). With
// DEMO=1, set only by demo/whisk.yaml:
// - "Look around" makes the visitor a guest member of staff, with an id of their own kept in the
//   guest cookie, so they can try everything without signing up;
// - emails are recorded but never sent (events.ts);
// - the sample data is put back every night (demoReset, below).
// Without DEMO=1 none of this runs: the routes answer 404, the cookie is ignored, and who is
// asking comes only from the platform's X-Whisk-* headers.
import { randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { asSystem } from "./db.js";
import type { Viewer } from "./model.js";
import { seed } from "./seed.js";
import { inngest, log } from "./whisk.js";

export const demoOn = () => process.env.DEMO === "1";

const COOKIE = "guest";

// demoViewer is the guest behind a "Look around" cookie, or nobody.
export const demoViewer = (c: Context): Viewer | undefined => {
  if (!demoOn()) return undefined;
  const id = getCookie(c, COOKIE) ?? "";
  return /^[a-f0-9]{16}$/.test(id) ? { kind: "team", userId: `demo-guest-${id}`, email: "guest@example.com", name: "Guest", admin: true } : undefined;
};

export const demoRoutes = (app: Hono) => {
  if (!demoOn()) return;
  app.post("/demo/start", (c) => {
    setCookie(c, COOKIE, randomBytes(8).toString("hex"), { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 });
    const back = c.req.query("return") ?? "/";
    return c.redirect(/^\/(?!\/)/.test(back) ? back : "/");
  });
  app.post("/demo/leave", (c) => {
    deleteCookie(c, COOKIE, { path: "/", secure: true });
    return c.redirect("/");
  });
};

// resetDemo empties every table this app owns and puts the sample data back.
export const resetDemo = async () => {
  if (!demoOn()) return { reset: false };
  await asSystem(async (tx) => {
    await tx`truncate api_keys, emails, entry_posts, entries, votes, comments, posts, people, categories restart identity cascade`;
    await tx`update settings set accent = '#5b5bd6', review_new = false, email_from = '', timezone = 'America/New_York' where id = 1`;
  });
  await seed();
  log.info("demo data reset");
  return { reset: true };
};

// The nightly reset, registered only on the demo (demo/whisk.yaml declares it).
export const demoFunctions = () =>
  demoOn()
    ? [
        inngest.createFunction({ id: "demo-reset", triggers: [{ cron: "0 3 * * *" }] }, async ({ step }) =>
          // doctor: allow W042 the reset step's graph is declared in demo/whisk.yaml, the demo's manifest
          step.run("reset", () => resetDemo()),
        ),
      ]
    : [];
