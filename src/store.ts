// Reading and writing the board's rows. Each function is one small query and takes the
// transaction it runs in (dbFor or asSystem in db.ts); the decisions live in model.ts.
import { createHash, randomBytes } from "node:crypto";
import type { Tx } from "./db.js";
import { KEY_PREFIX } from "./apiModel.js";
import type { Category, Comment, CommentKind, Entry, Label, Person, Post, Status } from "./model.js";

export type Settings = {
  board_name: string;
  tagline: string;
  accent: string;
  review_new: boolean;
  email_from: string;
  timezone: string;
  has_sample: boolean;
};

export const defaults: Settings = {
  board_name: "Feedback",
  tagline: "Tell us what would make the product better.",
  accent: "#5b5bd6",
  review_new: false,
  email_from: "",
  timezone: "America/New_York",
  has_sample: false,
};

export const settings = async (tx: Tx): Promise<Settings> =>
  (await tx<Settings[]>`select board_name, tagline, accent, review_new, email_from, timezone, has_sample from settings where id = 1`)[0] ?? defaults;

// removeSample deletes the rows the first install added, by the flag set when they were made.
// Votes and comments on sample ideas go with them.
export const removeSample = async (tx: Tx) => {
  await tx`delete from entries where sample`;
  await tx`delete from posts where sample`;
  // doctor: allow W098 removes the sample people for an admin, never a real person's row
  await tx`delete from people where sample`;
  await tx`update settings set has_sample = false where id = 1`;
};

export const saveSettings = (tx: Tx, s: Omit<Settings, "has_sample">) =>
  tx`update settings set board_name = ${s.board_name}, tagline = ${s.tagline}, accent = ${s.accent}, review_new = ${s.review_new},
    email_from = ${s.email_from}, timezone = ${s.timezone}, updated_at = now() where id = 1`;

// ----- Categories -----

export const categories = (tx: Tx) => tx<Category[]>`select id, slug, name, position from categories order by position, id`;

export const addCategory = (tx: Tx, c: { slug: string; name: string }) =>
  tx`insert into categories (slug, name, position) values (${c.slug}, ${c.name}, coalesce((select max(position) + 1 from categories), 0))`;

export const renameCategory = (tx: Tx, id: number, name: string) => tx`update categories set name = ${name} where id = ${id}`;

export const swapCategories = (tx: Tx, a: Category, b: Category) =>
  tx`update categories set position = case id when ${a.id} then ${b.position} when ${b.id} then ${a.position} end where id in (${a.id}, ${b.id})`;

export const deleteCategory = (tx: Tx, id: number) => tx`delete from categories where id = ${id}`;

// ----- Ideas -----

const postCols = (tx: Tx) =>
  tx`id, category_id, title, body, status, author_id, author_name, pinned, hidden, merged_into, vote_count, comment_count, created_at, status_at`;

// The whole board is loaded and then filtered and sorted in model.ts: boards hold hundreds or a
// few thousand ideas, which Postgres answers in a few milliseconds.
// doctor: allow W098 ideas are public on the board; hidden ones are filtered by canSeePost
export const allPosts = (tx: Tx) => tx<Post[]>`select ${postCols(tx)} from posts where merged_into is null order by id desc limit 5000`;

export const post = async (tx: Tx, id: number): Promise<Post | undefined> => (await tx<Post[]>`select ${postCols(tx)} from posts where id = ${id}`)[0];

export const postsByIds = (tx: Tx, ids: readonly number[]) =>
  ids.length === 0 ? Promise.resolve([] as Post[]) : tx<Post[]>`select ${postCols(tx)} from posts where id in ${tx(ids)}`;

export const postsByAuthor = (tx: Tx, authorId: string) =>
  tx<Post[]>`select ${postCols(tx)} from posts where author_id = ${authorId} and merged_into is null order by id desc limit 200`;

export const insertPost = async (tx: Tx, p: { category_id: number | null; title: string; body: string; author_id: string; author_name: string; hidden: boolean }) =>
  (await tx<{ id: number }[]>`insert into posts (category_id, title, body, author_id, author_name, hidden)
    values (${p.category_id}, ${p.title}, ${p.body}, ${p.author_id}, ${p.author_name}, ${p.hidden}) returning id`)[0]!.id;

export const updatePost = (tx: Tx, id: number, p: { title: string; body: string; category_id: number | null }) =>
  tx`update posts set title = ${p.title}, body = ${p.body}, category_id = ${p.category_id} where id = ${id}`;

export const setStatus = (tx: Tx, id: number, status: Status) => tx`update posts set status = ${status}, status_at = now() where id = ${id}`;

export const setPinned = (tx: Tx, id: number, pinned: boolean) => tx`update posts set pinned = ${pinned} where id = ${id}`;
export const setHidden = (tx: Tx, id: number, hidden: boolean) => tx`update posts set hidden = ${hidden} where id = ${id}`;
export const deletePost = (tx: Tx, id: number) => tx`delete from posts where id = ${id}`;

export const markMerged = (tx: Tx, id: number, into: number) => tx`update posts set merged_into = ${into}, status = 'closed', status_at = now() where id = ${id}`;

// ----- Comments and the activity on an idea -----

const commentCols = (tx: Tx) => tx`id, post_id, author_id, author_name, team, kind, status, body, hidden, created_at`;

// doctor: allow W098 a comment is public with its idea; notes and hidden ones are filtered by canSeeComment
export const comments = (tx: Tx, postId: number) => tx<Comment[]>`select ${commentCols(tx)} from comments where post_id = ${postId} order by id`;

export const comment = async (tx: Tx, id: number): Promise<Comment | undefined> => (await tx<Comment[]>`select ${commentCols(tx)} from comments where id = ${id}`)[0];

export const addComment = (
  tx: Tx,
  c: { post_id: number; author_id: string; author_name: string; team: boolean; kind: CommentKind; status?: Status | null; body: string },
) =>
  tx<{ id: number }[]>`insert into comments (post_id, author_id, author_name, team, kind, status, body)
    values (${c.post_id}, ${c.author_id}, ${c.author_name}, ${c.team}, ${c.kind}, ${c.status ?? null}, ${c.body}) returning id`.then((r) => r[0]!.id);

export const setCommentHidden = (tx: Tx, id: number, hidden: boolean) => tx`update comments set hidden = ${hidden} where id = ${id}`;
export const deleteComment = (tx: Tx, id: number) => tx`delete from comments where id = ${id}`;

// The count on the list is the conversation people can see: comments, not notes or status lines.
export const recountComments = (tx: Tx, postId: number) =>
  tx`update posts set comment_count = (select count(*) from comments where post_id = ${postId} and kind = 'comment' and not hidden) where id = ${postId}`;

// ----- Votes -----

// The person's own votes. Row-level security keeps a customer to their own rows as well.
export const votedIds = async (tx: Tx, userId: string) =>
  new Set((await tx<{ post_id: number }[]>`select post_id from votes where user_id = ${userId}`).map((r) => r.post_id));

export const addVote = (tx: Tx, postId: number, userId: string, addedBy = "") =>
  tx`insert into votes (post_id, user_id, added_by) values (${postId}, ${userId}, ${addedBy}) on conflict do nothing`;

export const removeVote = (tx: Tx, postId: number, userId: string) => tx`delete from votes where post_id = ${postId} and user_id = ${userId}`;

// vote_count is kept on the idea so the board can sort without counting; run as the system,
// since a customer's own transaction sees only their own vote.
export const recountVotes = (tx: Tx, postId: number) =>
  tx`update posts set vote_count = (select count(*) from votes where post_id = ${postId}) where id = ${postId}`;

export const voterIds = async (tx: Tx, postId: number) => (await tx<{ user_id: string }[]>`select user_id from votes where post_id = ${postId}`).map((r) => r.user_id);

export type Voter = Person & { added_by: string; created_at: Date };
export const voters = (tx: Tx, postId: number) =>
  tx<Voter[]>`select v.user_id, coalesce(p.email, '') as email, coalesce(p.name, '') as name, coalesce(p.email_updates, false) as email_updates, v.added_by, v.created_at
    from votes v left join people p on p.user_id = v.user_id where v.post_id = ${postId} order by v.created_at desc limit 500`;

export const moveVotes = (tx: Tx, from: number, into: number, userIds: readonly string[]) =>
  userIds.length === 0
    ? Promise.resolve()
    : // doctor: allow W098 staff merging one idea into another move every vote on it
      tx`insert into votes (post_id, user_id, added_by) select ${into}, unnest(${tx.array(userIds as string[])}::text[]), 'merge' on conflict do nothing`.then(() => tx`delete from votes where post_id = ${from}`);

// followerIds: the idea's author, voters and commenters.
export const followerIds = async (tx: Tx, postId: number) =>
  (
    await tx<{ user_id: string }[]>`select author_id as user_id from posts where id = ${postId}
      union select user_id from votes where post_id = ${postId}
      union select author_id from comments where post_id = ${postId} and kind = 'comment'`
  ).map((r) => r.user_id);

// ----- People -----

export const people = (tx: Tx, ids: readonly string[]) =>
  ids.length === 0 ? Promise.resolve([] as Person[]) : tx<Person[]>`select user_id, email, name, email_updates from people where user_id in ${tx(ids)}`;

export const person = async (tx: Tx, userId: string): Promise<Person | undefined> =>
  (await tx<Person[]>`select user_id, email, name, email_updates from people where user_id = ${userId}`)[0];

// rememberPerson keeps the email and name the platform vouches for, so the board can write to
// them later. A vote staff added for this email before the person signed in becomes theirs, and
// so do the ideas and comments added for them through the API.
export const rememberPerson = async (tx: Tx, p: { user_id: string; email: string; name: string }, placeholder: string) => {
  await tx`insert into people (user_id, email, name) values (${p.user_id}, ${p.email}, ${p.name})
    on conflict (user_id) do update set email = excluded.email, name = case when excluded.name = '' then people.name else excluded.name end`;
  const claimed = await tx<{ post_id: number }[]>`update votes set user_id = ${p.user_id} where user_id = ${placeholder}
    and post_id not in (select post_id from votes where user_id = ${p.user_id}) returning post_id`;
  await tx`delete from votes where user_id = ${placeholder}`;
  await tx`update posts set author_id = ${p.user_id} where author_id = ${placeholder}`;
  await tx`update comments set author_id = ${p.user_id} where author_id = ${placeholder}`;
  await tx`update people set email_updates = email_updates and (select coalesce(bool_and(email_updates), true) from people where user_id = ${placeholder}) where user_id = ${p.user_id}`;
  await tx`delete from people where user_id = ${placeholder}`;
  return claimed.map((r) => r.post_id);
};

// A customer who has not signed in yet, held by email so a staff member can vote for them.
export const placeholderPerson = (tx: Tx, p: { user_id: string; email: string; name: string }) =>
  tx`insert into people (user_id, email, name) values (${p.user_id}, ${p.email}, ${p.name}) on conflict (user_id) do update set name = excluded.name`;

export const personByEmail = async (tx: Tx, email: string): Promise<Person | undefined> =>
  (await tx<Person[]>`select user_id, email, name, email_updates from people where lower(email) = lower(${email}) and user_id not like 'email:%' order by created_at limit 1`)[0];

export const setEmailUpdates = (tx: Tx, userId: string, on: boolean) => tx`update people set email_updates = ${on} where user_id = ${userId}`;

// ----- Changelog -----

const entryCols = (tx: Tx) => tx`id, slug, title, body, label, published_at, created_at`;

export const entries = (tx: Tx, includeDrafts: boolean) =>
  tx<Entry[]>`select ${entryCols(tx)} from entries where ${includeDrafts} or published_at is not null
    order by published_at desc nulls first, id desc limit 200`;

export const entryBySlug = async (tx: Tx, slug: string): Promise<Entry | undefined> => (await tx<Entry[]>`select ${entryCols(tx)} from entries where slug = ${slug}`)[0];
export const entryById = async (tx: Tx, id: number): Promise<Entry | undefined> => (await tx<Entry[]>`select ${entryCols(tx)} from entries where id = ${id}`)[0];
export const entrySlugs = async (tx: Tx) => (await tx<{ slug: string }[]>`select slug from entries`).map((r) => r.slug);

export const insertEntry = async (tx: Tx, e: { slug: string; title: string; body: string; label: Label }) =>
  (await tx<{ id: number }[]>`insert into entries (slug, title, body, label) values (${e.slug}, ${e.title}, ${e.body}, ${e.label}) returning id`)[0]!.id;

export const updateEntry = (tx: Tx, id: number, e: { title: string; body: string; label: Label }) =>
  tx`update entries set title = ${e.title}, body = ${e.body}, label = ${e.label} where id = ${id}`;

export const publishEntry = (tx: Tx, id: number) => tx`update entries set published_at = now() where id = ${id} and published_at is null`;
export const deleteEntry = (tx: Tx, id: number) => tx`delete from entries where id = ${id}`;

export const setEntryPosts = async (tx: Tx, id: number, postIds: readonly number[]) => {
  await tx`delete from entry_posts where entry_id = ${id}`;
  if (postIds.length > 0) await tx`insert into entry_posts (entry_id, post_id) select ${id}, unnest(${tx.array(postIds as number[])}::int[]) on conflict do nothing`;
};

export const entryPostIds = async (tx: Tx, ids: readonly number[]) =>
  ids.length === 0 ? [] : tx<{ entry_id: number; post_id: number }[]>`select entry_id, post_id from entry_posts where entry_id in ${tx(ids)}`;

export const entriesForPost = (tx: Tx, postId: number) =>
  tx<Entry[]>`select ${entryCols(tx)} from entries e where published_at is not null and exists (select 1 from entry_posts ep where ep.entry_id = e.id and ep.post_id = ${postId}) order by published_at desc`;

// ----- Email -----

export type Email = { id: number; kind: string; to_email: string; subject: string; html: string; text: string; status: string; error: string; created_at: Date };

export const queueEmail = async (tx: Tx, e: { kind: string; to: string; subject: string; html: string; text: string }) =>
  (await tx<{ id: number }[]>`insert into emails (kind, to_email, subject, html, text) values (${e.kind}, ${e.to}, ${e.subject}, ${e.html}, ${e.text}) returning id`)[0]!.id;

export const emailById = async (tx: Tx, id: number): Promise<Email | undefined> =>
  (await tx<Email[]>`select id, kind, to_email, subject, html, text, status, error, created_at from emails where id = ${id}`)[0];

export const markEmail = (tx: Tx, id: number, status: "sent" | "skipped" | "failed" | "demo", error = "") =>
  tx`update emails set status = ${status}, error = ${error} where id = ${id}`;

export const recentEmails = (tx: Tx) =>
  tx<Email[]>`select id, kind, to_email, subject, '' as html, '' as text, status, error, created_at from emails order by id desc limit 50`;

// ----- API keys -----

export type ApiKey = { id: number; label: string; prefix: string; created_by: string; created_at: Date; last_used_at: Date | null };

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

// createKey makes a key, "fb_" and 32 random characters, and keeps only its hash and its first
// characters. The caller shows the key once.
export const createKey = async (tx: Tx, label: string, by: string): Promise<string> => {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  await tx`insert into api_keys (label, prefix, hash, created_by) values (${label}, ${key.slice(0, 10)}, ${hashKey(key)}, ${by})`;
  return key;
};

// keyFor is the key behind a raw key, noting that it was used.
export const keyFor = async (tx: Tx, key: string): Promise<ApiKey | undefined> =>
  (await tx<ApiKey[]>`update api_keys set last_used_at = now() where hash = ${hashKey(key)} returning id, label, prefix, created_by, created_at, last_used_at`)[0];

export const apiKeys = (tx: Tx) => tx<ApiKey[]>`select id, label, prefix, created_by, created_at, last_used_at from api_keys order by id desc`;

export const revokeKey = (tx: Tx, id: number) => tx`delete from api_keys where id = ${id}`;
