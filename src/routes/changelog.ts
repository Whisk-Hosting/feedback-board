// The changelog: public reading, and the staff editor. Publishing an entry moves its linked ideas
// to Shipped and emails everyone who followed them, once each.
import type { Context, Hono } from "hono";
import { createEntry, saveEntry } from "../actions.js";
import { asSystem } from "../db.js";
import { canModerate, isLabel, isTeam, type Post } from "../model.js";
import * as store from "../store.js";
import { changelogPage, entryForm, entryPage, type EntryForm } from "../views/changelog.js";
import { as, flash, forbidden, idParam, notFound, posInt, render, text, viewer } from "../web.js";

const candidates = (posts: readonly Post[], linked: readonly number[]) =>
  posts.filter((p) => linked.includes(p.id) || (!p.hidden && p.status !== "closed" && p.status !== "shipped")).sort((a, b) => Number(linked.includes(b.id)) - Number(linked.includes(a.id)) || b.vote_count - a.vote_count);

const entryValues = async (c: Context): Promise<EntryForm & { publish: boolean }> => {
  const f = await c.req.parseBody({ all: true });
  const ids = ([] as unknown[]).concat(f.posts ?? []).map(posInt).filter((n) => n > 0);
  return { title: text(f.title, 140), body: text(f.body, 20_000), label: isLabel(f.label) ? f.label : "new", posts: [...new Set(ids)].slice(0, 50), publish: f.publish === "1" };
};

export const changelogRoutes = (app: Hono) => {
  app.get("/changelog", async (c) => {
    const v = viewer(c);
    const [s, entries, links, posts] = await as(c, async (tx) => {
      const entries = await store.entries(tx, isTeam(v));
      const links = await store.entryPostIds(tx, entries.map((e) => e.id));
      return [await store.settings(tx), entries, links, await store.postsByIds(tx, [...new Set(links.map((l) => l.post_id))])] as const;
    });
    const byId = new Map(posts.filter((p) => !p.hidden).map((p) => [p.id, p]));
    const postsFor = (id: number) => links.filter((l) => l.entry_id === id).flatMap((l) => byId.get(l.post_id) ?? []);
    return render(c, "Changelog", changelogPage(s, v, entries, postsFor, flash(c)), { section: "changelog" });
  });

  app.get("/changelog/new", async (c) => {
    if (!canModerate(viewer(c))) return forbidden(c);
    const posts = await as(c, store.allPosts);
    const pre = posInt(c.req.query("post"));
    return render(c, "New entry", entryForm({ values: { title: "", body: "", label: "new", posts: pre ? [pre] : [] }, candidates: candidates(posts, pre ? [pre] : []) }), { section: "changelog" });
  });

  app.post("/entries", async (c) => {
    const v = viewer(c);
    if (!canModerate(v)) return forbidden(c);
    const values = await entryValues(c);
    if (!values.title) return render(c, "New entry", entryForm({ values, candidates: candidates(await as(c, store.allPosts), values.posts), error: "Give it a title." }), { status: 400 });
    const entry = await createEntry(v, values, values.publish);
    return c.redirect(values.publish ? `/changelog/${entry.slug}?ok=published` : "/changelog?ok=saved");
  });

  app.get("/changelog/:id/edit", async (c) => {
    if (!canModerate(viewer(c))) return forbidden(c);
    const found = await as(c, async (tx) => {
      const entry = await store.entryById(tx, idParam(c));
      return entry ? { entry, linked: (await store.entryPostIds(tx, [entry.id])).map((l) => l.post_id), posts: await store.allPosts(tx) } : undefined;
    });
    if (!found) return notFound(c, "entry");
    const { entry, linked, posts } = found;
    return render(c, "Edit entry", entryForm({ entry, values: { ...entry, posts: linked }, candidates: candidates(posts, linked) }), { section: "changelog" });
  });

  app.post("/entries/:id/edit", async (c) => {
    const v = viewer(c);
    if (!canModerate(v)) return forbidden(c);
    const entry = await asSystem((tx) => store.entryById(tx, idParam(c)));
    if (!entry) return notFound(c, "entry");
    const values = await entryValues(c);
    if (!values.title) return render(c, "Edit entry", entryForm({ entry, values, candidates: candidates(await as(c, store.allPosts), values.posts), error: "Give it a title." }), { status: 400 });
    const { entry: saved, published: publishing } = await saveEntry(v, entry, values, values.publish);
    return c.redirect(`/changelog/${saved.slug}?ok=${publishing ? "published" : "saved"}`);
  });

  app.post("/entries/:id/delete", async (c) => {
    if (!canModerate(viewer(c))) return forbidden(c);
    await asSystem((tx) => store.deleteEntry(tx, idParam(c)));
    return c.redirect("/changelog?ok=deleted");
  });

  app.get("/changelog/:slug", async (c) => {
    const v = viewer(c);
    const found = await as(c, async (tx) => {
      const entry = await store.entryBySlug(tx, c.req.param("slug"));
      if (!entry || (!entry.published_at && !isTeam(v))) return undefined;
      const ids = (await store.entryPostIds(tx, [entry.id])).map((l) => l.post_id);
      return { s: await store.settings(tx), entry, posts: (await store.postsByIds(tx, ids)).filter((p) => !p.hidden) };
    });
    if (!found) return notFound(c, "entry");
    return render(c, found.entry.title, entryPage(found.s, v, found.entry, found.posts, flash(c)), { section: "changelog" });
  });
};
