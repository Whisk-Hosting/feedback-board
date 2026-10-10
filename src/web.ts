// Small helpers every route shares: who is asking, rendering inside the layout, reading form
// fields, and running a query as the person asking.
import type { Context } from "hono";
import { dbFor, type Caller, type Tx } from "./db.js";
import { demoViewer } from "./demo.js";
import { anonymous, type Viewer } from "./model.js";
import * as store from "./store.js";
import { layout, type Html, type Section } from "./views/layout.js";
import { message } from "./views/parts.js";
import { identity } from "./whisk.js";

// viewer: who the platform's X-Whisk-* headers say is asking; on the demo, a visitor who pressed
// "Look around" and is not signed in is a guest member of staff (demo.ts). Staff are the
// business's own team; admins are its owners and admins and the "feedback-admins" group.
export const viewer = (c: Context): Viewer => {
  const id = identity((n) => c.req.header(n));
  if (!id.userId || (id.audience !== "team" && id.audience !== "customer")) return demoViewer(c) ?? anonymous;
  return {
    kind: id.audience,
    userId: id.userId,
    email: id.email ?? "",
    name: id.name ?? "",
    admin: id.audience === "team" && (id.roles.includes("owner") || id.roles.includes("admin") || id.groups.includes("feedback-admins")),
  };
};

export const callerOf = (v: Viewer): Caller => ({ audience: v.kind, userId: v.userId });

// as runs fn as the person asking (row-level security sees who they are).
export const as = <T>(c: Context, fn: (tx: Tx) => Promise<T>) => dbFor(callerOf(viewer(c)), fn);

export const render = async (c: Context, title: string, body: Html, opts: { section?: Section; status?: 200 | 400 | 403 | 404 } = {}) => {
  const s = await as(c, store.settings);
  return c.html(layout({ s, v: viewer(c), title, section: opts.section, body, here: c.req.path }), opts.status ?? 200);
};

export const notFound = (c: Context, what = "page") =>
  render(c, "Not found", message(`No such ${what}`, "It may have been merged, moved or removed.", { href: "/", label: "Back to the board" }), { status: 404 });

export const forbidden = (c: Context) => render(c, "Not allowed", message("That's for the team", "Only staff can do that.", { href: "/", label: "Back to the board" }), { status: 403 });

// signIn sends a visitor to the platform's sign-in, then back here.
export const signIn = (c: Context, back = c.req.path) => c.redirect(`/.whisk/login?return=${encodeURIComponent(back)}`);

// Messages shown after a redirect, by key, so no text travels in the URL.
const flashes: Readonly<Record<string, string>> = {
  saved: "Saved.",
  posted: "Thanks! Your idea is on the board.",
  waiting: "Thanks! Your idea will show once the team has looked at it.",
  merged: "Merged.",
  deleted: "Deleted.",
  published: "Published. Voters of the linked ideas are being emailed.",
  added: "Added.",
  voted: "Vote added.",
  demo: "Demo: settings stay as they are.",
  revoked: "Key revoked. Anything using it has stopped working.",
};
export const flash = (c: Context) => flashes[c.req.query("ok") ?? ""];

export const form = async (c: Context) => (await c.req.parseBody()) as Record<string, string | File | undefined>;
export const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
export const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : 0;
};
export const idParam = (c: Context, name = "id") => posInt(c.req.param(name));
// back is a path on this site to return to, never another site.
export const back = (v: unknown, fallback: string) => (typeof v === "string" && /^\/(?!\/)/.test(v) ? v : fallback);
