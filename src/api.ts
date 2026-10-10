// /api/v1: everything staff do on the board's pages, for scripts and AI agents. Each call carries
// a key an admin made under Manage > Settings > API keys. Requests are read in apiModel.ts; the
// changes go through actions.ts, the same code the pages use, so they send the same emails.
// Errors are {"error": {code, message, fix}}. Lists take ?limit= and ?offset=.
import { Hono, type Context } from "hono";
import * as actions from "./actions.js";
import {
  categoryInput,
  categoryJson,
  commentInput,
  commentJson,
  entryInput,
  entryJson,
  errors,
  ideaFilter,
  ideaInput,
  ideaJson,
  ideaPatch,
  keyFrom,
  keyViewer,
  looksLikeKey,
  mergeInput,
  page,
  paginate,
  voteInput,
  voterJson,
  type ApiError,
  type Result,
} from "./apiModel.js";
import { asSystem } from "./db.js";
import { filterPosts, roadmap, sortPosts, uniqueSlug, type Category, type Entry, type Viewer } from "./model.js";
import * as store from "./store.js";
import { publicUrl } from "./whisk.js";

type Env = { Variables: { actor: Viewer } };
export const api = new Hono<Env>();

const fail = (c: Context, e: ApiError) => c.json({ error: { code: e.code, message: e.message, fix: e.fix } }, e.status);

// The endpoint list, open to anyone so an agent can find its way before it has a key.
const endpoints = [
  "GET /api/v1/ideas?status=open|review|planned|progress|shipped|closed&category=id|slug&q=&sort=trending|top|new&limit=&offset=",
  "POST /api/v1/ideas {title, details?, category_id?, author_email?, author_name?}",
  "GET /api/v1/ideas/:id",
  "PATCH /api/v1/ideas/:id {title?, details?, category_id?, status?, comment_value?, notify_voters?: true, pinned?, hidden?}",
  "DELETE /api/v1/ideas/:id",
  "POST /api/v1/ideas/:id/merge {into_post_id}",
  "GET /api/v1/ideas/:id/comments?limit=&offset=",
  "POST /api/v1/ideas/:id/comments {value, internal?: false, author_email?, author_name?}",
  "PATCH /api/v1/comments/:id {hidden}",
  "DELETE /api/v1/comments/:id",
  "GET /api/v1/ideas/:id/votes?limit=&offset=",
  "POST /api/v1/ideas/:id/votes {voter_email, voter_name?}",
  "GET /api/v1/categories?limit=&offset=",
  "POST /api/v1/categories {name}",
  "PATCH /api/v1/categories/:id {name}",
  "DELETE /api/v1/categories/:id",
  "GET /api/v1/roadmap",
  "GET /api/v1/changelog?drafts=true&limit=&offset=",
  "POST /api/v1/changelog {title, details?, type?: new|improved|fixed, post_ids?: [id], publish?: false}",
  "GET /api/v1/changelog/:id",
  "PATCH /api/v1/changelog/:id {title?, details?, type?, post_ids?, publish?}",
  "POST /api/v1/changelog/:id/publish",
  "DELETE /api/v1/changelog/:id",
];

api.get("/", (c) =>
  c.json({
    endpoints,
    auth: "Authorization: Bearer <key> (or Basic auth with the key as the username, X-Api-Key, or ?token=). An admin makes keys under Manage > Settings > API keys.",
    errors: '{"error": {"code", "message", "fix"}}',
    paging: "Lists take ?limit= (1 to 200, default 50) and ?offset=, and answer total and next_offset.",
  }),
);

api.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  // doctor: allow W092 the API is called by scripts with a key made in Settings, not by people the platform signs in
  const raw = keyFrom({ authorization: c.req.header("authorization"), xApiKey: c.req.header("x-api-key"), token: c.req.query("token") });
  const key = looksLikeKey(raw) ? await asSystem((tx) => store.keyFor(tx, raw)) : undefined;
  if (!key) return fail(c, errors.key);
  c.set("actor", keyViewer(key));
  await next();
});

const actor = (c: Context<Env>) => c.get("actor");
const base = () => publicUrl();

// body is the JSON object sent, or a failure saying it is not one.
const body = async (c: Context): Promise<Result<Record<string, unknown>>> => {
  const b = await c.req.json().catch(() => undefined);
  return b && typeof b === "object" && !Array.isArray(b) ? { ok: true, value: b as Record<string, unknown> } : { ok: false, error: errors.json };
};

const pageOf = (c: Context) => page({ limit: c.req.query("limit"), offset: c.req.query("offset") });
const idOf = (c: Context, name = "id") => (/^\d{1,9}$/.test(c.req.param(name) ?? "") ? Number(c.req.param(name)) : 0);
const catMap = (cats: readonly Category[]) => new Map(cats.map((x) => [x.id, x]));

const ideaOut = async (id: number) => {
  const [post, cats] = await asSystem(async (tx) => [await store.post(tx, id), await store.categories(tx)] as const);
  return post ? ideaJson(post, catMap(cats), base()) : undefined;
};

// liveIdea is the idea in the path, or the failure: missing, or merged into another.
const liveIdea = async (c: Context) => {
  const post = await asSystem((tx) => store.post(tx, idOf(c)));
  return !post ? ({ ok: false, error: errors.idea } as const) : post.merged_into ? ({ ok: false, error: errors.merged } as const) : ({ ok: true, value: post } as const);
};

// ----- Ideas -----

api.get("/ideas", async (c) => {
  const p = pageOf(c);
  if (!p.ok) return fail(c, p.error);
  const [cats, posts] = await asSystem(async (tx) => [await store.categories(tx), await store.allPosts(tx)] as const);
  const f = ideaFilter({ status: c.req.query("status"), category: c.req.query("category"), q: c.req.query("q"), sort: c.req.query("sort") }, cats);
  if (!f.ok) return fail(c, f.error);
  const found = paginate(sortPosts(filterPosts(posts, f.value), f.value.sort, new Date()), p.value);
  const byId = catMap(cats);
  return c.json({ ideas: found.items.map((x) => ideaJson(x, byId, base())), total: found.total, next_offset: found.next_offset });
});

api.post("/ideas", async (c) => {
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const input = ideaInput(b.value, await asSystem(store.categories));
  if (!input.ok) return fail(c, input.error);
  const { author, ...values } = input.value;
  const by = author ? await actions.customerByEmail(author.email, author.name) : actor(c);
  const { id } = await actions.postIdea(by, values);
  return c.json({ idea: await ideaOut(id) }, 201);
});

api.get("/ideas/:id", async (c) => {
  const idea = await ideaOut(idOf(c));
  return idea ? c.json({ idea }) : fail(c, errors.idea);
});

api.patch("/ideas/:id", async (c) => {
  const post = await liveIdea(c);
  if (!post.ok) return fail(c, post.error);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const change = ideaPatch(b.value, await asSystem(store.categories), post.value);
  if (!change.ok) return fail(c, change.error);
  const { edit, status, pinned, hidden } = change.value;
  const id = post.value.id;
  await asSystem(async (tx) => {
    if (edit) await store.updatePost(tx, id, edit);
    if (pinned !== undefined) await store.setPinned(tx, id, pinned);
    if (hidden !== undefined) await store.setHidden(tx, id, hidden);
  });
  if (status) await actions.changeStatus(actor(c), { ...post.value, ...(edit ?? {}) }, status.status, status.note, status.notify);
  return c.json({ idea: await ideaOut(id) });
});

api.delete("/ideas/:id", async (c) => {
  const post = await asSystem((tx) => store.post(tx, idOf(c)));
  if (!post) return fail(c, errors.idea);
  await asSystem((tx) => store.deletePost(tx, post.id));
  return c.body(null, 204);
});

api.post("/ideas/:id/merge", async (c) => {
  const post = await liveIdea(c);
  if (!post.ok) return fail(c, post.error);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const intoId = mergeInput(b.value, post.value.id);
  if (!intoId.ok) return fail(c, intoId.error);
  const into = await asSystem((tx) => store.post(tx, intoId.value));
  if (!into) return fail(c, { ...errors.idea, status: 422, code: "MERGE_TARGET_INVALID", message: "No idea has that into_post_id." });
  if (into.merged_into) return fail(c, errors.merged);
  await actions.merge(actor(c), post.value, into);
  return c.json({ merged: await ideaOut(post.value.id), into: await ideaOut(into.id) });
});

// ----- Comments -----

api.get("/ideas/:id/comments", async (c) => {
  const p = pageOf(c);
  if (!p.ok) return fail(c, p.error);
  const post = await asSystem((tx) => store.post(tx, idOf(c)));
  if (!post) return fail(c, errors.idea);
  const found = paginate(await asSystem((tx) => store.comments(tx, post.id)), p.value);
  return c.json({ comments: found.items.map(commentJson), total: found.total, next_offset: found.next_offset });
});

api.post("/ideas/:id/comments", async (c) => {
  const post = await liveIdea(c);
  if (!post.ok) return fail(c, post.error);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const input = commentInput(b.value);
  if (!input.ok) return fail(c, input.error);
  const by = input.value.author ? await actions.customerByEmail(input.value.author.email, input.value.author.name) : actor(c);
  const id = await actions.addComment(by, post.value, input.value.value, input.value.internal);
  const made = await asSystem((tx) => store.comment(tx, id));
  return c.json({ comment: commentJson(made!) }, 201);
});

api.patch("/comments/:id", async (c) => {
  const comment = await asSystem((tx) => store.comment(tx, idOf(c)));
  if (!comment) return fail(c, errors.comment);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  if (typeof b.value.hidden !== "boolean") return fail(c, { status: 422, code: "HIDDEN_INVALID", message: "hidden must be true or false.", fix: 'Send {"hidden": true}.' });
  const hidden = b.value.hidden;
  await asSystem(async (tx) => {
    await store.setCommentHidden(tx, comment.id, hidden);
    await store.recountComments(tx, comment.post_id);
  });
  return c.json({ comment: commentJson({ ...comment, hidden }) });
});

api.delete("/comments/:id", async (c) => {
  const comment = await asSystem((tx) => store.comment(tx, idOf(c)));
  if (!comment) return fail(c, errors.comment);
  await asSystem(async (tx) => {
    await store.deleteComment(tx, comment.id);
    await store.recountComments(tx, comment.post_id);
  });
  return c.body(null, 204);
});

// ----- Votes -----

api.get("/ideas/:id/votes", async (c) => {
  const p = pageOf(c);
  if (!p.ok) return fail(c, p.error);
  const post = await asSystem((tx) => store.post(tx, idOf(c)));
  if (!post) return fail(c, errors.idea);
  const found = paginate(await asSystem((tx) => store.voters(tx, post.id)), p.value);
  return c.json({ votes: found.items.map(voterJson), total: found.total, next_offset: found.next_offset });
});

api.post("/ideas/:id/votes", async (c) => {
  const post = await liveIdea(c);
  if (!post.ok) return fail(c, post.error);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const input = voteInput(b.value);
  if (!input.ok) return fail(c, input.error);
  const voter = await actions.voteFor(actor(c), post.value, input.value.email, input.value.name);
  return c.json({ voter: { id: voter.userId, email: voter.email, name: voter.name }, idea: await ideaOut(post.value.id) }, 201);
});

// ----- Categories -----

api.get("/categories", async (c) => {
  const p = pageOf(c);
  if (!p.ok) return fail(c, p.error);
  const found = paginate(await asSystem(store.categories), p.value);
  return c.json({ categories: found.items.map(categoryJson), total: found.total, next_offset: found.next_offset });
});

api.post("/categories", async (c) => {
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const name = categoryInput(b.value);
  if (!name.ok) return fail(c, name.error);
  const made = await asSystem(async (tx) => {
    const slug = uniqueSlug(name.value, (await store.categories(tx)).map((x) => x.slug));
    await store.addCategory(tx, { name: name.value, slug });
    return (await store.categories(tx)).find((x) => x.slug === slug)!;
  });
  return c.json({ category: categoryJson(made) }, 201);
});

const categoryIn = async (c: Context) => (await asSystem(store.categories)).find((x) => x.id === idOf(c));

api.patch("/categories/:id", async (c) => {
  const cat = await categoryIn(c);
  if (!cat) return fail(c, errors.category);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const name = categoryInput(b.value);
  if (!name.ok) return fail(c, name.error);
  await asSystem((tx) => store.renameCategory(tx, cat.id, name.value));
  return c.json({ category: categoryJson({ ...cat, name: name.value }) });
});

api.delete("/categories/:id", async (c) => {
  const cat = await categoryIn(c);
  if (!cat) return fail(c, errors.category);
  await asSystem((tx) => store.deleteCategory(tx, cat.id));
  return c.body(null, 204);
});

// ----- Roadmap -----

api.get("/roadmap", async (c) => {
  const [cats, posts] = await asSystem(async (tx) => [await store.categories(tx), await store.allPosts(tx)] as const);
  const byId = catMap(cats);
  return c.json({ columns: roadmap(posts, new Date()).map((col) => ({ status: col.status, ideas: col.posts.map((p) => ideaJson(p, byId, base())) })) });
});

// ----- Changelog -----

const entryIn = async (c: Context) => {
  const ref = c.req.param("id") ?? "";
  return asSystem((tx) => (/^\d{1,9}$/.test(ref) ? store.entryById(tx, Number(ref)) : store.entryBySlug(tx, ref)));
};
const postIdsOf = async (ids: readonly number[]) => {
  const links = await asSystem((tx) => store.entryPostIds(tx, ids));
  return (id: number) => links.filter((l) => l.entry_id === id).map((l) => l.post_id);
};
const entryOut = async (e: Entry) => entryJson(e, (await postIdsOf([e.id]))(e.id), base());

// unknownIdeas are the ids in post_ids that are not ideas on the board.
const unknownIdeas = async (ids: readonly number[]) => {
  const found = new Set((await asSystem((tx) => store.postsByIds(tx, ids))).map((p) => p.id));
  return ids.filter((id) => !found.has(id));
};
const badIdeas = (ids: readonly number[]): ApiError => ({ status: 422, code: "POST_IDS_INVALID", message: `No idea has the id ${ids.join(", ")}.`, fix: "GET /api/v1/ideas lists the ideas and their ids." });

api.get("/changelog", async (c) => {
  const p = pageOf(c);
  if (!p.ok) return fail(c, p.error);
  const all = await asSystem((tx) => store.entries(tx, c.req.query("drafts") === "true"));
  const found = paginate(all, p.value);
  const ids = await postIdsOf(found.items.map((e) => e.id));
  return c.json({ entries: found.items.map((e) => entryJson(e, ids(e.id), base())), total: found.total, next_offset: found.next_offset });
});

// doctor: allow W099 every /api/v1 call needs a key made in Settings (the middleware above)
api.post("/changelog", async (c) => {
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const input = entryInput(b.value);
  if (!input.ok) return fail(c, input.error);
  const missing = await unknownIdeas(input.value.posts);
  if (missing.length) return fail(c, badIdeas(missing));
  const entry = await actions.createEntry(actor(c), input.value, input.value.publish);
  return c.json({ entry: await entryOut(entry) }, 201);
});

api.get("/changelog/:id", async (c) => {
  const entry = await entryIn(c);
  return entry ? c.json({ entry: await entryOut(entry) }) : fail(c, errors.entry);
});

// doctor: allow W099 every /api/v1 call needs a key made in Settings (the middleware above)
api.patch("/changelog/:id", async (c) => {
  const entry = await entryIn(c);
  if (!entry) return fail(c, errors.entry);
  const b = await body(c);
  if (!b.ok) return fail(c, b.error);
  const input = entryInput(b.value, { ...entry, posts: (await postIdsOf([entry.id]))(entry.id) });
  if (!input.ok) return fail(c, input.error);
  const missing = await unknownIdeas(input.value.posts);
  if (missing.length) return fail(c, badIdeas(missing));
  const saved = await actions.saveEntry(actor(c), entry, input.value, input.value.publish);
  return c.json({ entry: await entryOut(saved.entry) });
});

api.post("/changelog/:id/publish", async (c) => {
  const entry = await entryIn(c);
  if (!entry) return fail(c, errors.entry);
  if (entry.published_at) return fail(c, errors.published);
  return c.json({ entry: await entryOut(await actions.publishEntry(actor(c), entry)) });
});

// doctor: allow W099 every /api/v1 call needs a key made in Settings (the middleware above)
api.delete("/changelog/:id", async (c) => {
  const entry = await entryIn(c);
  if (!entry) return fail(c, errors.entry);
  await asSystem((tx) => store.deleteEntry(tx, entry.id));
  return c.body(null, 204);
});

api.notFound((c) => fail(c, errors.endpoint));
