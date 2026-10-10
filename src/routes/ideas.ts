// One idea: reading it, posting one, voting, commenting, and the staff tools.
import type { Context, Hono } from "hono";
import { addComment, changeStatus, merge, postIdea, remember, voteFor } from "../actions.js";
import { asSystem } from "../db.js";
import { postPath } from "../emails.js";
import { canComment, canDeleteComment, canEditPost, canModerate, canPost, canSeeComment, canSeePost, canVote, isStatus, validEmail } from "../model.js";
import * as store from "../store.js";
import { ideaForm, ideaPage, type IdeaForm } from "../views/idea.js";
import { as, back, flash, forbidden, form, idParam, notFound, posInt, render, signIn, text, viewer } from "../web.js";

const ideaValues = (f: Record<string, unknown>, cats: readonly { id: number }[]): IdeaForm => {
  const cat = posInt(f.category_id);
  return { title: text(f.title, 140), body: text(f.body, 10_000), category_id: cats.some((x) => x.id === cat) ? cat : null };
};

const showIdea = async (c: Context, error?: string) => {
  const v = viewer(c);
  const id = idParam(c);
  const loaded = await as(c, async (tx) => {
    const post = id ? await store.post(tx, id) : undefined;
    if (!post) return undefined;
    return {
      post,
      s: await store.settings(tx),
      cats: await store.categories(tx),
      comments: await store.comments(tx, post.id),
      voted: v.userId ? (await store.votedIds(tx, v.userId)).has(post.id) : false,
      voters: canModerate(v) ? await store.voters(tx, post.id) : [],
      shippedIn: await store.entriesForPost(tx, post.id),
      others: canModerate(v) ? (await store.allPosts(tx)).filter((p) => p.id !== post.id) : [],
    };
  });
  if (!loaded) return notFound(c, "idea");
  if (loaded.post.merged_into) return c.redirect(`/p/${loaded.post.merged_into}`);
  if (!canSeePost(v, loaded.post)) return notFound(c, "idea");
  return render(
    c,
    loaded.post.title,
    ideaPage({
      ...loaded,
      v,
      cat: loaded.cats.find((x) => x.id === loaded.post.category_id),
      comments: loaded.comments.filter((x) => canSeeComment(v, x)),
      now: new Date(),
      flash: flash(c),
      error,
    }),
    { section: "ideas", status: error ? 400 : 200 },
  );
};

// The idea a staff action is about, or the reason there isn't one to act on.
const staffPost = async (c: Context) => {
  const v = viewer(c);
  if (!canModerate(v)) return { fail: forbidden(c) };
  const post = await asSystem((tx) => store.post(tx, idParam(c)));
  return post ? { v, post } : { fail: notFound(c, "idea") };
};

export const ideaRoutes = (app: Hono) => {
  app.get("/p/:id", (c) => showIdea(c));
  app.get("/p/:id/:slug", (c) => c.redirect(`/p/${idParam(c)}`, 301));

  app.get("/new", async (c) => {
    const v = viewer(c);
    if (!canPost(v)) return signIn(c, c.req.url.slice(c.req.url.indexOf("/new")));
    const cats = await as(c, store.categories);
    const cat = posInt(c.req.query("category"));
    return render(c, "Post an idea", ideaForm({ v, cats, values: { title: c.req.query("title") ?? "", body: "", category_id: cats.some((x) => x.id === cat) ? cat : null } }), { section: "ideas" });
  });

  app.post("/posts", async (c) => {
    const v = viewer(c);
    if (!canPost(v)) return signIn(c, "/new");
    const cats = await as(c, store.categories);
    const values = ideaValues(await form(c), cats);
    if (values.title.length < 3) return render(c, "Post an idea", ideaForm({ v, cats, values, error: "Give your idea a title." }), { status: 400 });
    const { id, hidden } = await postIdea(v, values);
    return c.redirect(`/p/${id}?ok=${hidden ? "waiting" : "posted"}`);
  });

  app.get("/p/:id/edit", async (c) => {
    const v = viewer(c);
    const [post, cats] = await as(c, async (tx) => [await store.post(tx, idParam(c)), await store.categories(tx)] as const);
    if (!post || !canSeePost(v, post)) return notFound(c, "idea");
    if (!canEditPost(v, post)) return forbidden(c);
    return render(c, "Edit idea", ideaForm({ v, cats, values: post, editing: post }), { section: "ideas" });
  });

  app.post("/posts/:id/edit", async (c) => {
    const v = viewer(c);
    const [post, cats] = await as(c, async (tx) => [await store.post(tx, idParam(c)), await store.categories(tx)] as const);
    if (!post || !canSeePost(v, post)) return notFound(c, "idea");
    if (!canEditPost(v, post)) return forbidden(c);
    const values = ideaValues(await form(c), cats);
    if (values.title.length < 3) return render(c, "Edit idea", ideaForm({ v, cats, values, editing: post, error: "Give your idea a title." }), { status: 400 });
    await asSystem((tx) => store.updatePost(tx, post.id, values));
    return c.redirect(`/p/${post.id}?ok=saved`);
  });

  // A vote toggles. The script asks for JSON; a plain form gets the page back.
  app.post("/posts/:id/vote", async (c) => {
    const v = viewer(c);
    if (!canVote(v)) return signIn(c, `/p/${idParam(c)}`);
    const f = await form(c);
    await remember(v);
    const result = await asSystem(async (tx) => {
      const post = await store.post(tx, idParam(c));
      if (!post || !canSeePost(v, post) || post.merged_into) return undefined;
      const had = (await store.votedIds(tx, v.userId)).has(post.id);
      await (had ? store.removeVote(tx, post.id, v.userId) : store.addVote(tx, post.id, v.userId));
      await store.recountVotes(tx, post.id);
      return { voted: !had, votes: (await store.post(tx, post.id))!.vote_count };
    });
    if (!result) return c.req.header("accept")?.includes("json") ? c.json({ error: { code: "NOT_FOUND", message: "No such idea." } }, 404) : notFound(c, "idea");
    return c.req.header("accept")?.includes("json") ? c.json(result) : c.redirect(back(f.back, `/p/${idParam(c)}`));
  });

  app.post("/posts/:id/comments", async (c) => {
    const v = viewer(c);
    if (!canComment(v)) return signIn(c, `/p/${idParam(c)}`);
    const f = await form(c);
    const body = text(f.body, 5000);
    const note = f.note === "1" && canModerate(v);
    const post = await asSystem((tx) => store.post(tx, idParam(c)));
    if (!post || !canSeePost(v, post)) return notFound(c, "idea");
    if (!body) return c.redirect(`/p/${post.id}#comments`);
    await addComment(v, post, body, note);
    return c.redirect(`/p/${post.id}#comments`);
  });

  app.post("/comments/:id/delete", async (c) => {
    const v = viewer(c);
    const comment = await asSystem((tx) => store.comment(tx, idParam(c)));
    if (!comment) return notFound(c, "comment");
    if (!canDeleteComment(v, comment)) return forbidden(c);
    await asSystem(async (tx) => {
      await store.deleteComment(tx, comment.id);
      await store.recountComments(tx, comment.post_id);
    });
    return c.redirect(`/p/${comment.post_id}#comments`);
  });

  app.post("/comments/:id/hide", async (c) => {
    const v = viewer(c);
    if (!canModerate(v)) return forbidden(c);
    const hidden = (await form(c)).hidden === "1";
    const comment = await asSystem((tx) => store.comment(tx, idParam(c)));
    if (!comment) return notFound(c, "comment");
    await asSystem(async (tx) => {
      await store.setCommentHidden(tx, comment.id, hidden);
      await store.recountComments(tx, comment.post_id);
    });
    return c.redirect(`/p/${comment.post_id}#c${comment.id}`);
  });

  // ----- Staff -----

  app.post("/posts/:id/status", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const f = await form(c);
    const status = f.status;
    if (!isStatus(status)) return showIdea(c, "Choose a status.");
    const note = text(f.note, 2000);
    if (status === r.post.status && !note) return c.redirect(`/p/${r.post.id}`);
    await changeStatus(r.v, r.post, status, note, f.notify === "1");
    return c.redirect(`/p/${r.post.id}?ok=saved`);
  });

  app.post("/posts/:id/pin", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const on = (await form(c)).on === "1";
    await asSystem((tx) => store.setPinned(tx, r.post.id, on));
    return c.redirect(`/p/${r.post.id}`);
  });

  app.post("/posts/:id/hide", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const f = await form(c);
    await asSystem((tx) => store.setHidden(tx, r.post.id, f.on === "1"));
    return c.redirect(back(f.back, `/p/${r.post.id}?ok=saved`));
  });

  app.post("/posts/:id/delete", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const f = await form(c);
    await asSystem((tx) => store.deletePost(tx, r.post.id));
    return c.redirect(back(f.back, "/?ok=deleted"));
  });

  // Staff add a vote for a customer who asked on a call or by email. When that customer signs in
  // with the same email, the vote becomes theirs (store.rememberPerson).
  app.post("/posts/:id/vote-for", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const f = await form(c);
    const address = text(f.email, 254).toLowerCase();
    if (!validEmail(address)) return showIdea(c, "That email doesn't look right.");
    await voteFor(r.v, r.post, address, text(f.name, 120));
    return c.redirect(`/p/${r.post.id}?ok=voted`);
  });

  // Merging a duplicate: its voters and author vote for the other idea, and it closes.
  app.post("/posts/:id/merge", async (c) => {
    const r = await staffPost(c);
    if ("fail" in r) return r.fail;
    const intoId = posInt((await form(c)).into);
    const into = intoId && intoId !== r.post.id ? await asSystem((tx) => store.post(tx, intoId)) : undefined;
    if (!into || into.merged_into) return showIdea(c, "Choose the idea to merge into.");
    await merge(r.v, r.post, into);
    return c.redirect(`${postPath(into)}?ok=merged`);
  });
};
