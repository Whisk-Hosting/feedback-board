// The API's pure parts: reading a key from a request, reading and checking JSON bodies and
// query strings, paging, and the JSON each row becomes. No database and no requests; api.ts
// loads rows, calls these, and acts on what they answer. Table-tested in test/api.test.ts.
//
// Field names follow Canny's API where it has one (details, score, comment_count, internal,
// post_ids, notify_voters), in snake_case.
import { isLabel, isSort, isStatus, LABELS, SORTS, STATUSES, labelText, statusLabel, validEmail, type Category, type Comment, type Entry, type Label, type Post, type Sort, type Status, type Viewer } from "./model.js";

export const KEY_PREFIX = "fb_";

// looksLikeKey: "fb_" and 32 base64url characters, as store.createKey makes them.
export const looksLikeKey = (k: string) => /^fb_[A-Za-z0-9_-]{32}$/.test(k);

// keyFrom finds the key wherever a client put it: Authorization: Bearer <key>, Basic auth with
// the key as the username, X-Api-Key, or ?token=.
export const keyFrom = (h: { authorization?: string; xApiKey?: string; token?: string }): string => {
  const auth = (h.authorization ?? "").trim();
  const bearer = /^bearer\s+(.+)$/i.exec(auth)?.[1];
  if (bearer) return bearer.trim();
  const basic = /^basic\s+(.+)$/i.exec(auth)?.[1];
  if (basic) {
    const decoded = Buffer.from(basic.trim(), "base64").toString("utf8");
    return decoded.split(":")[0]!.trim();
  }
  return (h.xApiKey ?? h.token ?? "").trim();
};

// The viewer an API key acts as: staff, named after the key, never an admin.
export const keyViewer = (k: { id: number; label: string }): Viewer => ({ kind: "team", userId: `api-key-${k.id}`, email: "", name: k.label, admin: false });

// ----- Errors -----

export type ApiError = { readonly status: 400 | 401 | 403 | 404 | 409 | 422; readonly code: string; readonly message: string; readonly fix: string };
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const no = (status: ApiError["status"], code: string, message: string, fix: string): Result<never> => ({ ok: false, error: { status, code, message, fix } });

export const errors = {
  key: { status: 401, code: "API_KEY_INVALID", message: "No valid API key was sent.", fix: "Make a key under Manage > Settings > API keys and send it as Authorization: Bearer <key>." },
  json: { status: 400, code: "BODY_NOT_JSON", message: "The body is not a JSON object.", fix: "Send a JSON object with Content-Type: application/json." },
  endpoint: { status: 404, code: "NOT_FOUND", message: "There is no such API endpoint.", fix: "GET /api/v1 lists the endpoints." },
  idea: { status: 404, code: "IDEA_NOT_FOUND", message: "No idea has that id.", fix: "GET /api/v1/ideas lists the ideas and their ids." },
  comment: { status: 404, code: "COMMENT_NOT_FOUND", message: "No comment has that id.", fix: "GET /api/v1/ideas/:id/comments lists an idea's comments." },
  entry: { status: 404, code: "ENTRY_NOT_FOUND", message: "No changelog entry has that id or slug.", fix: "GET /api/v1/changelog?drafts=true lists every entry." },
  category: { status: 404, code: "CATEGORY_NOT_FOUND", message: "No category has that id.", fix: "GET /api/v1/categories lists the categories." },
  merged: { status: 409, code: "IDEA_MERGED", message: "That idea was merged into another one.", fix: "Use the idea in merged_into instead." },
  published: { status: 409, code: "ENTRY_PUBLISHED", message: "That entry is already published.", fix: "Nothing to do. PATCH it to change its wording." },
} as const satisfies Record<string, ApiError>;

// ----- Paging -----

export type Page = { readonly limit: number; readonly offset: number };
const wholeNumber = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : NaN);

// page reads ?limit= (1 to 200, default 50) and ?offset= (default 0).
export const page = (q: { limit?: string; offset?: string }): Result<Page> => {
  const limit = q.limit === undefined || q.limit === "" ? 50 : wholeNumber(q.limit);
  const offset = q.offset === undefined || q.offset === "" ? 0 : wholeNumber(q.offset);
  if (!(limit >= 1 && limit <= 200)) return no(400, "LIMIT_INVALID", "limit must be a whole number from 1 to 200.", "Send ?limit=50, or leave it out.");
  if (!(offset >= 0)) return no(400, "OFFSET_INVALID", "offset must be a whole number, 0 or more.", "Send the next_offset of the previous page, or leave it out.");
  return ok({ limit, offset });
};

// paginate answers one page of items, how many there are in all, and where the next page starts.
export const paginate = <T>(items: readonly T[], p: Page) => ({
  items: items.slice(p.offset, p.offset + p.limit),
  total: items.length,
  next_offset: p.offset + p.limit < items.length ? p.offset + p.limit : null,
});

// ----- Reading requests -----

type Body = Readonly<Record<string, unknown>>;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const has = (b: Body, k: string) => b[k] !== undefined;
// first is the first of several accepted names that the body carries.
const first = (b: Body, ...keys: string[]) => b[keys.find((k) => has(b, k)) ?? ""];

// categoryFrom finds a category by id or slug; null clears it; leaving it out answers undefined.
const categoryFrom = (v: unknown, cats: readonly Category[]): Result<number | null | undefined> => {
  if (v === undefined) return ok(undefined);
  if (v === null || v === "") return ok(null);
  const found = cats.find((c) => c.id === Number(v) || c.slug === v);
  return found ? ok(found.id) : no(422, "CATEGORY_UNKNOWN", `No category matches ${JSON.stringify(v)}.`, "GET /api/v1/categories lists each category's id and slug.");
};

export type IdeaFilter = { readonly status?: Status | "open"; readonly category?: number; readonly q: string; readonly sort: Sort };

// ideaFilter reads ?status=&category=&q=&sort= for the list of ideas.
export const ideaFilter = (q: { status?: string; category?: string; q?: string; sort?: string }, cats: readonly Category[]): Result<IdeaFilter> => {
  if (q.status && q.status !== "open" && !isStatus(q.status)) return no(400, "STATUS_FILTER_INVALID", `status must be open or one of ${STATUSES.join(", ")}.`, "Send ?status=planned, or leave it out.");
  if (q.sort && !isSort(q.sort)) return no(400, "SORT_INVALID", `sort must be one of ${SORTS.join(", ")}.`, "Send ?sort=top, or leave it out for trending.");
  const cat = q.category ? categoryFrom(q.category, cats) : ok(undefined);
  if (!cat.ok) return { ok: false, error: { ...cat.error, status: 400 } };
  return ok({ status: (q.status || undefined) as IdeaFilter["status"], category: cat.value ?? undefined, q: (q.q ?? "").trim().slice(0, 100), sort: (q.sort || "trending") as Sort });
};

export type Author = { readonly email: string; readonly name: string };

// authorFrom reads author_email and author_name: the customer something is done for.
const authorFrom = (b: Body): Result<Author | undefined> => {
  if (!has(b, "author_email")) return ok(undefined);
  const email = str(b.author_email, 254).toLowerCase();
  return validEmail(email) ? ok({ email, name: str(b.author_name, 120) }) : no(422, "EMAIL_INVALID", "author_email is not an email address.", 'Send {"author_email": "ana@example.com"}, or leave it out to act as the key.');
};

const titleFrom = (v: unknown): Result<string> => {
  const t = str(v, 140);
  return t.length >= 3 ? ok(t) : no(422, "TITLE_INVALID", "title must be at least 3 characters.", 'Send {"title": "Dark mode"}.');
};

export type IdeaInput = { readonly title: string; readonly body: string; readonly category_id: number | null; readonly author?: Author };

// ideaInput reads a new idea: title, details (or body), category (id or slug), and the customer
// it is posted for, by author_email and author_name.
export const ideaInput = (b: Body, cats: readonly Category[]): Result<IdeaInput> => {
  const title = titleFrom(b.title);
  if (!title.ok) return title;
  const cat = categoryFrom(first(b, "category_id", "category"), cats);
  if (!cat.ok) return cat;
  const author = authorFrom(b);
  if (!author.ok) return author;
  return ok({ title: title.value, body: str(first(b, "details", "body"), 10_000), category_id: cat.value ?? null, author: author.value });
};

export type IdeaPatch = {
  readonly edit?: { readonly title: string; readonly body: string; readonly category_id: number | null };
  readonly status?: { readonly status: Status; readonly note: string; readonly notify: boolean };
  readonly pinned?: boolean;
  readonly hidden?: boolean;
};

const bool = (b: Body, k: string): Result<boolean | undefined> =>
  b[k] === undefined || typeof b[k] === "boolean" ? ok(b[k] as boolean | undefined) : no(422, `${k.toUpperCase()}_INVALID`, `${k} must be true or false.`, `Send {"${k}": true}.`);

// ideaPatch reads a change to an idea against the idea as it is. A status change carries an
// optional note to voters (comment_value) and emails them unless notify_voters is false.
export const ideaPatch = (b: Body, cats: readonly Category[], post: Pick<Post, "title" | "body" | "category_id" | "status">): Result<IdeaPatch> => {
  const editing = has(b, "title") || has(b, "details") || has(b, "body") || has(b, "category_id") || has(b, "category");
  const title = has(b, "title") ? titleFrom(b.title) : ok(post.title);
  if (!title.ok) return title;
  const cat = categoryFrom(first(b, "category_id", "category"), cats);
  if (!cat.ok) return cat;
  if (has(b, "status") && !isStatus(b.status)) return no(422, "STATUS_INVALID", `status must be one of ${STATUSES.join(", ")}.`, 'Send {"status": "planned"}.');
  const notify = bool(b, "notify_voters");
  if (!notify.ok) return notify;
  const pinned = bool(b, "pinned");
  if (!pinned.ok) return pinned;
  const hidden = bool(b, "hidden");
  if (!hidden.ok) return hidden;
  const note = str(first(b, "comment_value", "note"), 2000);
  const status = has(b, "status") && (b.status !== post.status || note) ? { status: b.status as Status, note, notify: notify.value !== false } : undefined;
  const patch: IdeaPatch = {
    ...(editing ? { edit: { title: title.value, body: has(b, "details") || has(b, "body") ? str(first(b, "details", "body"), 10_000) : post.body, category_id: cat.value === undefined ? post.category_id : cat.value } } : {}),
    ...(status ? { status } : {}),
    ...(pinned.value === undefined ? {} : { pinned: pinned.value }),
    ...(hidden.value === undefined ? {} : { hidden: hidden.value }),
  };
  return Object.keys(patch).length || has(b, "status") ? ok(patch) : no(422, "NOTHING_TO_CHANGE", "The body changes nothing.", "Send one or more of title, details, category_id, status, pinned, hidden.");
};

export type CommentInput = { readonly value: string; readonly internal: boolean; readonly author?: Author };

// commentInput reads a comment: its text (value, or body), whether it is an internal staff note,
// and the customer it is written for, if any. A customer's comment is never internal.
export const commentInput = (b: Body): Result<CommentInput> => {
  const value = str(first(b, "value", "body"), 5000);
  if (!value) return no(422, "VALUE_REQUIRED", "The comment is empty.", 'Send {"value": "Thanks, we are on it."}.');
  const internal = bool(b, "internal");
  if (!internal.ok) return internal;
  const author = authorFrom(b);
  if (!author.ok) return author;
  if (internal.value && author.value) return no(422, "INTERNAL_FOR_CUSTOMER", "A customer's comment cannot be an internal note.", "Leave out author_email for an internal note, or internal for a customer's comment.");
  return ok({ value, internal: internal.value === true, author: author.value });
};

// voteInput reads the customer a vote is added for.
export const voteInput = (b: Body): Result<Author> => {
  const email = str(first(b, "voter_email", "email"), 254).toLowerCase();
  return validEmail(email) ? ok({ email, name: str(first(b, "voter_name", "name"), 120) }) : no(422, "EMAIL_INVALID", "voter_email is not an email address.", 'Send {"voter_email": "ana@example.com", "voter_name": "Ana"}.');
};

// mergeInput reads the idea a duplicate merges into, which must be another idea.
export const mergeInput = (b: Body, postId: number): Result<number> => {
  const into = Number(first(b, "into_post_id", "into"));
  if (!Number.isInteger(into) || into <= 0) return no(422, "MERGE_TARGET_INVALID", "into_post_id must be an idea's id.", 'Send {"into_post_id": 12}.');
  return into === postId ? no(422, "MERGE_TARGET_INVALID", "An idea cannot merge into itself.", "Send the id of the idea it duplicates.") : ok(into);
};

export type EntryInput = { readonly title: string; readonly body: string; readonly label: Label; readonly posts: readonly number[]; readonly publish: boolean };

// entryInput reads a changelog entry: title, details (or body), type (new, improved or fixed),
// post_ids (the ideas it ships) and publish. For a change, what is left out stays as it was.
export const entryInput = (b: Body, was?: { title: string; body: string; label: Label; posts: readonly number[] }): Result<EntryInput> => {
  const title = has(b, "title") || !was ? str(b.title, 140) : was.title;
  if (!title) return no(422, "TITLE_INVALID", "title is empty.", 'Send {"title": "Dark mode is here"}.');
  const type = first(b, "type", "label");
  if (type !== undefined && !isLabel(type)) return no(422, "TYPE_INVALID", `type must be one of ${LABELS.join(", ")}.`, 'Send {"type": "new"}.');
  const ids = first(b, "post_ids", "posts");
  if (ids !== undefined && !(Array.isArray(ids) && ids.every((n) => Number.isInteger(n) && n > 0)))
    return no(422, "POST_IDS_INVALID", "post_ids must be a list of idea ids.", 'Send {"post_ids": [12, 31]}.');
  const publish = bool(b, "publish");
  if (!publish.ok) return publish;
  return ok({
    title,
    body: has(b, "details") || has(b, "body") ? str(first(b, "details", "body"), 20_000) : (was?.body ?? ""),
    label: (type as Label | undefined) ?? was?.label ?? "new",
    posts: ids === undefined ? (was?.posts ?? []) : [...new Set(ids as number[])].slice(0, 50),
    publish: publish.value === true,
  });
};

// categoryInput reads a category's name.
export const categoryInput = (b: Body): Result<string> => {
  const name = str(b.name, 60);
  return name ? ok(name) : no(422, "NAME_REQUIRED", "name is empty.", 'Send {"name": "Integrations"}.');
};

// ----- Rows as JSON -----

export const categoryJson = (c: Category) => ({ id: c.id, slug: c.slug, name: c.name, position: c.position });

export const ideaJson = (p: Post, cats: ReadonlyMap<number, Category>, base: string) => {
  const cat = p.category_id === null ? undefined : cats.get(p.category_id);
  return {
    id: p.id,
    title: p.title,
    details: p.body,
    status: p.status,
    status_label: statusLabel[p.status],
    category: cat ? categoryJson(cat) : null,
    author: { id: p.author_id, name: p.author_name },
    score: p.vote_count,
    comment_count: p.comment_count,
    pinned: p.pinned,
    hidden: p.hidden,
    merged_into: p.merged_into,
    url: `${base}/p/${p.id}`,
    created: p.created_at,
    status_changed: p.status_at,
  };
};

export const commentJson = (c: Comment) => ({
  id: c.id,
  post_id: c.post_id,
  kind: c.kind,
  value: c.body,
  internal: c.kind === "note",
  team: c.team,
  status: c.status,
  hidden: c.hidden,
  author: { id: c.author_id, name: c.author_name },
  created: c.created_at,
});

export const voterJson = (v: { user_id: string; email: string; name: string; added_by: string; created_at: Date }) => ({
  voter: { id: v.user_id, email: v.email, name: v.name, signed_in: !v.user_id.startsWith("email:") },
  added_by: v.added_by || null,
  created: v.created_at,
});

export const entryJson = (e: Entry, postIds: readonly number[], base: string) => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  details: e.body,
  type: e.label,
  type_label: labelText[e.label],
  post_ids: postIds,
  published: e.published_at !== null,
  published_at: e.published_at,
  created: e.created_at,
  url: `${base}/changelog/${e.slug}`,
});
