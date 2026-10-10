// Public pages: the board, a category, the roadmap. And a person's own page.
import type { Context, Hono } from "hono";
import { asSystem } from "../db.js";
import { filterPosts, isSort, isStatus, isTeam, roadmap, signedIn, similarPosts, sortPosts, statusCounts, statusLabel, canSeePost, type Category, type Status } from "../model.js";
import * as store from "../store.js";
import { boardPage, mePage, roadmapPage } from "../views/board.js";
import { as, flash, notFound, render, signIn, viewer } from "../web.js";

const boardFor = async (c: Context, current?: Category) => {
  const v = viewer(c);
  const sort = isSort(c.req.query("sort")) ? (c.req.query("sort") as "trending") : "trending";
  const rawStatus = c.req.query("status");
  const status = rawStatus === "open" || isStatus(rawStatus) ? (rawStatus as Status | "open") : undefined;
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const [s, cats, all, voted, latest] = await as(c, async (tx) => [
    await store.settings(tx),
    await store.categories(tx),
    await store.allPosts(tx),
    signedIn(v) ? await store.votedIds(tx, v.userId) : new Set<number>(),
    (await store.entries(tx, false)).slice(0, 3),
  ] as const);
  const visible = all.filter((p) => canSeePost(v, p));
  const now = new Date();
  const posts = sortPosts(filterPosts(visible, { category: current?.id, status, q }), sort, now);
  const catCounts = new Map<number | "all", number>([
    ["all", visible.length],
    ...cats.map((cat) => [cat.id, visible.filter((p) => p.category_id === cat.id).length] as const),
  ]);
  return render(
    c,
    current?.name ?? s.board_name,
    boardPage({ s, v, posts, voted, cats, catCounts, current, sort, status, q, counts: statusCounts(visible), latest, now, here: c.req.path, flash: flash(c) }),
    { section: "ideas" },
  );
};

export const boardRoutes = (app: Hono) => {
  app.get("/", (c) => boardFor(c));

  app.get("/b/:slug", async (c) => {
    const cat = (await as(c, store.categories)).find((x) => x.slug === c.req.param("slug"));
    return cat ? boardFor(c, cat) : notFound(c, "category");
  });

  app.get("/roadmap", async (c) => {
    const v = viewer(c);
    const [s, cats, posts] = await as(c, async (tx) => [await store.settings(tx), await store.categories(tx), await store.allPosts(tx)] as const);
    return render(c, "Roadmap", roadmapPage(s, roadmap(posts.filter((p) => canSeePost(v, p)), new Date()), new Map(cats.map((x) => [x.id, x]))), { section: "roadmap" });
  });

  // Ideas that look like the title someone is typing, for the new idea form.
  app.get("/similar", async (c) => {
    const v = viewer(c);
    const posts = (await as(c, store.allPosts)).filter((p) => canSeePost(v, p));
    return c.json(similarPosts(c.req.query("q") ?? "", posts).map((p) => ({ id: p.id, title: p.title, votes: p.vote_count, status: p.status, status_label: statusLabel[p.status] })));
  });

  app.get("/me", async (c) => {
    const v = viewer(c);
    if (!signedIn(v)) return signIn(c);
    const [cats, mine, all, votedIds, me] = await as(c, async (tx) => [
      await store.categories(tx),
      await store.postsByAuthor(tx, v.userId),
      await store.allPosts(tx),
      await store.votedIds(tx, v.userId),
      await store.person(tx, v.userId),
    ] as const);
    const voted = all.filter((p) => votedIds.has(p.id) && p.author_id !== v.userId && (canSeePost(v, p) || isTeam(v)));
    return render(c, "Your ideas", mePage(v, mine, voted, me?.email_updates ?? true, new Map(cats.map((x) => [x.id, x])), votedIds, new Date(), flash(c)), { section: "me" });
  });

  app.post("/me", async (c) => {
    const v = viewer(c);
    const on = (await c.req.parseBody()).email_updates === "1";
    await asSystem((tx) => store.setEmailUpdates(tx, v.userId, on));
    return c.redirect("/me?ok=saved");
  });
};
