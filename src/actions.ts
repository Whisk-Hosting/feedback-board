// The changes the board makes, shared by the pages (routes/) and the API (api.ts), so both apply
// the same rules and send the same emails. Each takes who is acting as a Viewer: a signed-in
// person, the demo guest, or an API key acting as staff. Decisions stay in model.ts; this file
// only loads rows, calls them, writes what they answer and hands email to events.ts.
import { asSystem } from "./db.js";
import { replyEmail, shippedEmail, statusEmail, type Mail } from "./emails.js";
import { email } from "./events.js";
import { canModerate, displayName, mergeVotes, placeholderId, recipients, uniqueSlug, type Entry, type Label, type Person, type Post, type Status, type Viewer } from "./model.js";
import * as store from "./store.js";
import { publicUrl } from "./whisk.js";

// remember keeps the signed-in person's email, so they can be told when their idea moves. A
// customer held by email (customerByEmail) or an API key has nothing to remember.
export const remember = (v: Viewer) =>
  v.userId && v.email && v.userId !== placeholderId(v.email)
    ? asSystem((tx) => store.rememberPerson(tx, { user_id: v.userId, email: v.email, name: v.name }, placeholderId(v.email))).then(() => undefined)
    : Promise.resolve();

// customerByEmail is the customer with this email: the person who signed in with it, or one held
// under "email:<address>" until they do (store.rememberPerson hands over what was done for them).
export const customerByEmail = (address: string, name: string): Promise<Viewer> =>
  asSystem(async (tx) => {
    const known = await store.personByEmail(tx, address);
    const userId = known?.user_id ?? placeholderId(address);
    if (!known) await store.placeholderPerson(tx, { user_id: userId, email: address, name });
    return { kind: "customer", userId, email: address, name: known?.name || name, admin: false };
  });

// tell emails the people following an idea, built by make for each of them.
const tell = async (kind: string, postId: number, actorId: string, make: (s: store.Settings, to: Person) => Mail) => {
  const [s, people] = await asSystem(async (tx) => {
    const ids = await store.followerIds(tx, postId);
    return [await store.settings(tx), recipients(await store.people(tx, ids), ids, actorId)] as const;
  });
  if (people.length) await email(kind, people.map((p) => make(s, p)));
};

// tellAuthor lets an idea's author know someone else commented on it.
const tellAuthor = async (postId: number, authorId: string, from: Viewer, body: string) => {
  const [s, post, people] = await asSystem(async (tx) => [await store.settings(tx), await store.post(tx, postId), recipients(await store.people(tx, [authorId]), [authorId], from.userId)] as const);
  if (post && people.length) await email("reply", people.map((p) => replyEmail(s, publicUrl(), p, post, { name: displayName(from), team: false }, body)));
};

// postIdea adds an idea with its author's vote. Staff ideas always show; a customer's waits for
// approval when the board asks for that.
export const postIdea = async (v: Viewer, values: { title: string; body: string; category_id: number | null }) => {
  await remember(v);
  const s = await asSystem(store.settings);
  const hidden = s.review_new && !canModerate(v);
  const id = await asSystem(async (tx) => {
    const id = await store.insertPost(tx, { ...values, author_id: v.userId, author_name: displayName(v), hidden });
    await store.addVote(tx, id, v.userId);
    await store.recountVotes(tx, id);
    return id;
  });
  return { id, hidden };
};

// addComment adds a comment or a staff note. Followers hear when the team answers; the author
// hears when someone else comments; staff notes stay inside.
export const addComment = async (v: Viewer, post: Post, body: string, note: boolean) => {
  const team = canModerate(v);
  const internal = note && team;
  await remember(v);
  const id = await asSystem(async (tx) => {
    const id = await store.addComment(tx, { post_id: post.id, author_id: v.userId, author_name: displayName(v), team, kind: internal ? "note" : "comment", body });
    await store.recountComments(tx, post.id);
    return id;
  });
  if (team && !internal) await tell("reply", post.id, v.userId, (s, to) => replyEmail(s, publicUrl(), to, post, { name: displayName(v), team: true }, body));
  else if (!internal && post.author_id !== v.userId) await tellAuthor(post.id, post.author_id, v, body);
  return id;
};

// changeStatus moves an idea, writes the change into its activity, and emails its followers
// when asked to.
export const changeStatus = async (v: Viewer, post: Post, status: Status, note: string, notify: boolean) => {
  await remember(v);
  await asSystem(async (tx) => {
    await store.setStatus(tx, post.id, status);
    await store.addComment(tx, { post_id: post.id, author_id: v.userId, author_name: displayName(v), team: true, kind: "status", status, body: note });
  });
  if (notify) await tell("status", post.id, v.userId, (s, to) => statusEmail(s, publicUrl(), to, post, status, note));
};

// voteFor adds a vote for a customer who asked on a call or by email. When that customer signs in
// with the same email, the vote becomes theirs.
export const voteFor = async (v: Viewer, post: Post, address: string, name: string) => {
  const customer = await customerByEmail(address, name);
  await asSystem(async (tx) => {
    await store.addVote(tx, post.id, customer.userId, v.userId);
    await store.recountVotes(tx, post.id);
  });
  return customer;
};

// merge closes a duplicate: its voters and author vote for the other idea instead.
export const merge = (v: Viewer, post: Post, into: Post) =>
  asSystem(async (tx) => {
    const gained = mergeVotes({ author_id: post.author_id, voters: await store.voterIds(tx, post.id) }, await store.voterIds(tx, into.id));
    await store.moveVotes(tx, post.id, into.id, gained);
    await store.markMerged(tx, post.id, into.id);
    await store.addComment(tx, { post_id: into.id, author_id: v.userId, author_name: displayName(v), team: true, kind: "merged", body: `merged "${post.title}" into this idea` });
    await store.recountVotes(tx, into.id);
    await store.recountVotes(tx, post.id);
  });

// ship marks the entry's ideas shipped and emails their followers: one email per person.
const ship = async (entry: Entry, actor: Viewer) => {
  const { s, posts, people } = await asSystem(async (tx) => {
    const ids = (await store.entryPostIds(tx, [entry.id])).map((r) => r.post_id);
    const posts = await store.postsByIds(tx, ids);
    for (const p of posts.filter((p) => p.status !== "shipped")) {
      await store.setStatus(tx, p.id, "shipped");
      await store.addComment(tx, { post_id: p.id, author_id: actor.userId, author_name: displayName(actor), team: true, kind: "status", status: "shipped", body: `[${entry.title}](/changelog/${entry.slug})` });
    }
    const followers = await Promise.all(posts.map(async (p) => ({ post: p, ids: await store.followerIds(tx, p.id) })));
    const people = await store.people(tx, [...new Set(followers.flatMap((f) => f.ids))]);
    return { s: await store.settings(tx), posts: followers, people };
  });
  const byPerson = posts
    .flatMap((f) => recipients(people, f.ids, actor.userId).map((to) => ({ to, post: f.post })))
    .reduce((acc, { to, post }) => acc.set(to.user_id, { to, posts: [...(acc.get(to.user_id)?.posts ?? []), post] }), new Map<string, { to: Person; posts: Post[] }>());
  if (byPerson.size) await email("shipped", [...byPerson.values()].map(({ to, posts }) => shippedEmail(s, publicUrl(), to, entry, posts)));
};

export type EntryValues = { title: string; body: string; label: Label; posts: readonly number[] };

// createEntry adds a changelog entry; publishing it ships its ideas and emails their followers.
export const createEntry = async (v: Viewer, values: EntryValues, publish: boolean) => {
  await remember(v);
  const entry = await asSystem(async (tx) => {
    const id = await store.insertEntry(tx, { ...values, slug: uniqueSlug(values.title, await store.entrySlugs(tx)) });
    await store.setEntryPosts(tx, id, values.posts);
    if (publish) await store.publishEntry(tx, id);
    return (await store.entryById(tx, id))!;
  });
  if (publish) await ship(entry, v);
  return entry;
};

// saveEntry changes an entry, and publishes it when asked and not yet published.
export const saveEntry = async (v: Viewer, entry: Entry, values: EntryValues, publish: boolean) => {
  const publishing = publish && !entry.published_at;
  const saved = await asSystem(async (tx) => {
    await store.updateEntry(tx, entry.id, values);
    await store.setEntryPosts(tx, entry.id, values.posts);
    if (publishing) await store.publishEntry(tx, entry.id);
    return (await store.entryById(tx, entry.id))!;
  });
  if (publishing) await ship(saved, v);
  return { entry: saved, published: publishing };
};

// publishEntry publishes a draft as it stands.
export const publishEntry = async (v: Viewer, entry: Entry) => {
  if (entry.published_at) return entry;
  const saved = await asSystem(async (tx) => {
    await store.publishEntry(tx, entry.id);
    return (await store.entryById(tx, entry.id))!;
  });
  await ship(saved, v);
  return saved;
};
