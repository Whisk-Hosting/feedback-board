// Staff pages: hidden ideas, categories, settings, emails.
import type { Context, Hono } from "hono";
import { asSystem } from "../db.js";
import { demoOn } from "../demo.js";
import { canAdmin, canModerate, displayName, isColor, uniqueSlug, validEmail } from "../model.js";
import * as store from "../store.js";
import { categoriesPage, emailsPage, settingsPage, waitingPage, type KeysView } from "../views/manage.js";
import { as, flash, forbidden, form, idParam, render, text, viewer } from "../web.js";
import { log, publicUrl } from "../whisk.js";

const waitingCount = async (c: Context) => (await as(c, store.allPosts)).filter((p) => p.hidden).length;

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const manageRoutes = (app: Hono) => {
  // Every page and action here is for staff.
  app.use("/manage/*", async (c, next) => (canModerate(viewer(c)) ? next() : forbidden(c)));
  app.use("/manage", async (c, next) => (canModerate(viewer(c)) ? next() : forbidden(c)));

  app.get("/manage", async (c) => {
    const hidden = (await as(c, store.allPosts)).filter((p) => p.hidden);
    return render(c, "Manage", waitingPage(viewer(c), hidden, new Date(), flash(c)), { section: "manage" });
  });

  app.get("/manage/categories", async (c) => {
    const [cats, posts] = await as(c, async (tx) => [await store.categories(tx), await store.allPosts(tx)] as const);
    const counts = new Map(cats.map((x) => [x.id, posts.filter((p) => p.category_id === x.id).length]));
    return render(c, "Categories", categoriesPage(viewer(c), cats, counts, posts.filter((p) => p.hidden).length, flash(c)), { section: "manage" });
  });

  app.post("/manage/categories", async (c) => {
    const name = text((await form(c)).name, 60);
    if (name) await asSystem(async (tx) => store.addCategory(tx, { name, slug: uniqueSlug(name, (await store.categories(tx)).map((x) => x.slug)) }));
    return c.redirect("/manage/categories?ok=added");
  });

  app.post("/manage/categories/:id", async (c) => {
    const name = text((await form(c)).name, 60);
    if (name) await asSystem((tx) => store.renameCategory(tx, idParam(c), name));
    return c.redirect("/manage/categories?ok=saved");
  });

  app.post("/manage/categories/:id/move", async (c) => {
    const up = (await form(c)).dir === "up";
    await asSystem(async (tx) => {
      const cats = await store.categories(tx);
      const i = cats.findIndex((x) => x.id === idParam(c));
      const j = up ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < cats.length) {
        // Positions may repeat after deletes; renumber first so a swap always moves.
        await Promise.all(cats.map((x, n) => tx`update categories set position = ${n} where id = ${x.id}`));
        await store.swapCategories(tx, { ...cats[i]!, position: i }, { ...cats[j]!, position: j });
      }
    });
    return c.redirect("/manage/categories");
  });

  app.post("/manage/categories/:id/delete", async (c) => {
    await asSystem((tx) => store.deleteCategory(tx, idParam(c)));
    return c.redirect("/manage/categories?ok=deleted");
  });

  // keysView loads the API keys for Settings; a failure shows on the page instead of breaking it.
  const keysView = async (c: Context, extra: Partial<KeysView> = {}): Promise<KeysView> => ({
    keys: await as(c, store.apiKeys).catch((err) => (log.error({ err: String(err) }, "could not load API keys"), undefined)),
    base: publicUrl(),
    ...extra,
  });

  const settingsView = async (c: Context, extra: Partial<KeysView> = {}, status: 200 | 400 = 200) =>
    render(c, "Settings", settingsPage(viewer(c), await as(c, store.settings), await waitingCount(c), flash(c), undefined, await keysView(c, extra)), { section: "manage", status });

  app.get("/manage/settings", async (c) => {
    if (!canAdmin(viewer(c))) return forbidden(c);
    return settingsView(c);
  });

  // A new key is shown on this response only; only its hash is kept. On the demo the guest makes
  // keys too, so visitors can try the API; the nightly reset removes them.
  app.post("/manage/settings/keys", async (c) => {
    const v = viewer(c);
    if (!canAdmin(v)) return forbidden(c);
    const label = text((await form(c)).label, 80);
    if (!label) return settingsView(c, { error: "Give the key a name." }, 400);
    const key = await asSystem((tx) => store.createKey(tx, label, v.email ? `${displayName(v)} <${v.email}>` : displayName(v)));
    return settingsView(c, { newKey: key });
  });

  app.post("/manage/settings/keys/:id/revoke", async (c) => {
    if (!canAdmin(viewer(c))) return forbidden(c);
    await asSystem((tx) => store.revokeKey(tx, idParam(c)));
    return c.redirect("/manage/settings?ok=revoked#api");
  });

  app.post("/manage/settings", async (c) => {
    const v = viewer(c);
    if (!canAdmin(v)) return forbidden(c);
    if (demoOn()) return c.redirect("/manage/settings?ok=demo");
    const f = await form(c);
    const old = await as(c, store.settings);
    const s: store.Settings = {
      board_name: text(f.board_name, 60) || old.board_name,
      tagline: text(f.tagline, 200),
      accent: isColor(text(f.accent, 7)) ? text(f.accent, 7) : old.accent,
      review_new: f.review_new === "1",
      email_from: text(f.email_from, 254),
      timezone: validZone(text(f.timezone, 60)) ? text(f.timezone, 60) : old.timezone,
      has_sample: old.has_sample,
    };
    if (s.email_from && !validEmail(s.email_from)) return render(c, "Settings", settingsPage(v, s, await waitingCount(c), undefined, "That email doesn't look right.", await keysView(c)), { section: "manage", status: 400 });
    await asSystem((tx) => store.saveSettings(tx, s));
    return c.redirect("/manage/settings?ok=saved");
  });

  app.post("/manage/sample/remove", async (c) => {
    if (!canAdmin(viewer(c))) return forbidden(c);
    if (demoOn()) return c.redirect("/manage/settings?ok=demo");
    await asSystem(store.removeSample);
    return c.redirect("/?ok=deleted");
  });

  app.get("/manage/emails", async (c) => {
    const emails = await as(c, store.recentEmails);
    return render(c, "Emails", emailsPage(viewer(c), emails, new Date(), await waitingCount(c)), { section: "manage" });
  });

};
