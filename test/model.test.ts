import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anonymous,
  canDeleteComment,
  canEditPost,
  canSeeComment,
  canSeePost,
  filterPosts,
  mergeVotes,
  recipients,
  roadmap,
  similarPosts,
  slugify,
  sortPosts,
  statusCounts,
  tokens,
  uniqueSlug,
  type Post,
  type Viewer,
} from "../src/model.ts";

const now = new Date("2026-10-09T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const post = (o: Partial<Post> & { id: number }): Post => ({
  category_id: null,
  title: `Idea ${o.id}`,
  body: "",
  status: "review",
  author_id: "u-author",
  author_name: "Author",
  pinned: false,
  hidden: false,
  merged_into: null,
  vote_count: 0,
  comment_count: 0,
  created_at: daysAgo(1),
  status_at: daysAgo(1),
  ...o,
});

const customer: Viewer = { kind: "customer", userId: "u-cust", email: "c@example.com", name: "Cara", admin: false };
const author: Viewer = { ...customer, userId: "u-author" };
const staff: Viewer = { kind: "team", userId: "u-staff", email: "s@acme.test", name: "Sam", admin: false };

test("who sees an idea", () => {
  const table: [string, Viewer, Partial<Post>, boolean][] = [
    ["anyone sees a visible idea", anonymous, {}, true],
    ["a visitor does not see a hidden idea", anonymous, { hidden: true }, false],
    ["another customer does not see a hidden idea", customer, { hidden: true }, false],
    ["its author sees their hidden idea", author, { hidden: true }, true],
    ["staff see hidden ideas", staff, { hidden: true }, true],
  ];
  for (const [name, v, p, want] of table) assert.equal(canSeePost(v, post({ id: 1, ...p })), want, name);
});

test("who edits an idea", () => {
  const table: [string, Viewer, Partial<Post>, boolean][] = [
    ["a visitor cannot", anonymous, {}, false],
    ["another customer cannot", customer, {}, false],
    ["the author can while it is under review", author, { status: "review" }, true],
    ["the author cannot once it is planned", author, { status: "planned" }, false],
    ["staff always can", staff, { status: "shipped" }, true],
  ];
  for (const [name, v, p, want] of table) assert.equal(canEditPost(v, post({ id: 1, ...p })), want, name);
});

test("comments: notes and hidden comments are for staff, authors delete their own", () => {
  assert.equal(canSeeComment(customer, { kind: "note", hidden: false }), false);
  assert.equal(canSeeComment(customer, { kind: "comment", hidden: true }), false);
  assert.equal(canSeeComment(staff, { kind: "note", hidden: false }), true);
  assert.equal(canDeleteComment(customer, { author_id: "u-cust", kind: "comment" }), true);
  assert.equal(canDeleteComment(customer, { author_id: "u-other", kind: "comment" }), false);
  assert.equal(canDeleteComment(customer, { author_id: "u-cust", kind: "status" }), false);
  assert.equal(canDeleteComment(anonymous, { author_id: "", kind: "comment" }), false);
});

test("sorting keeps pinned ideas first and never changes its input", () => {
  const posts = [post({ id: 1, vote_count: 50, created_at: daysAgo(90) }), post({ id: 2, vote_count: 5, created_at: daysAgo(1) }), post({ id: 3, vote_count: 1, pinned: true })];
  const frozen = Object.freeze([...posts]);
  assert.deepEqual(sortPosts(frozen, "top", now).map((p) => p.id), [3, 1, 2]);
  assert.deepEqual(sortPosts(frozen, "new", now).map((p) => p.id), [3, 2, 1]);
  assert.deepEqual(sortPosts(frozen, "trending", now).map((p) => p.id), [3, 2, 1], "fresh votes beat old ones");
});

test("filters: category, open, status, search and merged ideas", () => {
  const posts = [
    post({ id: 1, title: "Dark mode", category_id: 1 }),
    post({ id: 2, title: "QuickBooks import", status: "shipped", category_id: 2 }),
    post({ id: 3, title: "Dark reports", status: "closed" }),
    post({ id: 4, title: "Dark mode again", merged_into: 1 }),
  ];
  const ids = (f: Parameters<typeof filterPosts>[1]) => filterPosts(posts, f).map((p) => p.id);
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ category: 2 }), [2]);
  assert.deepEqual(ids({ status: "open" }), [1]);
  assert.deepEqual(ids({ status: "closed" }), [3]);
  assert.deepEqual(ids({ q: "dark" }), [1, 3]);
  assert.deepEqual(ids({ q: "quick" }), [2], "prefix search");
});

test("the roadmap groups by status, most votes first, and keeps shipped recent", () => {
  const cols = roadmap(
    [
      post({ id: 1, status: "planned", vote_count: 2 }),
      post({ id: 2, status: "planned", vote_count: 9 }),
      post({ id: 3, status: "shipped", status_at: daysAgo(200) }),
      post({ id: 4, status: "shipped", status_at: daysAgo(3) }),
      post({ id: 5, status: "progress", hidden: true }),
    ],
    now,
  );
  assert.deepEqual(cols.map((c) => [c.status, c.posts.map((p) => p.id)]), [["planned", [2, 1]], ["progress", []], ["shipped", [4]]]);
  assert.deepEqual(statusCounts([post({ id: 1, status: "planned" }), post({ id: 2, status: "planned", merged_into: 1 })]).planned, 1);
});

test("similar ideas weigh rare words over common ones", () => {
  const posts = [
    post({ id: 1, title: "Dark mode", vote_count: 20 }),
    post({ id: 2, title: "Recurring invoices" }),
    post({ id: 3, title: "Invoice templates" }),
    post({ id: 4, title: "Export invoices to QuickBooks" }),
  ];
  assert.deepEqual(similarPosts("Dark theme for invoices", posts).map((p) => p.id), [1]);
  assert.deepEqual(similarPosts("repeat invoices every month (recurring)", posts).map((p) => p.id)[0], 2);
  assert.deepEqual(similarPosts("the", posts), []);
  assert.deepEqual(tokens("Please add Dark-Mode to the Reports!"), ["dark", "mode", "report"]);
});

test("recipients: followers who want email, never the actor, once per address", () => {
  const people = [
    { user_id: "a", email: "a@x.test", name: "A", email_updates: true },
    { user_id: "b", email: "b@x.test", name: "B", email_updates: false },
    { user_id: "c", email: "A@x.test", name: "A again", email_updates: true },
    { user_id: "d", email: "not an email", name: "D", email_updates: true },
    { user_id: "e", email: "e@x.test", name: "E", email_updates: true },
    { user_id: "f", email: "f@x.test", name: "F", email_updates: true },
  ];
  assert.deepEqual(recipients(people, ["a", "b", "c", "d", "e", "a"], "e").map((p) => p.user_id), ["a"]);
});

test("merging moves the duplicate's author and voters, once", () => {
  assert.deepEqual(mergeVotes({ author_id: "x", voters: ["x", "y", "z", ""] }, ["y"]), ["x", "z"]);
});

test("slugs", () => {
  assert.equal(slugify("Stripe payouts: match themselves!"), "stripe-payouts-match-themselves");
  assert.equal(slugify("!!!"), "item");
  assert.equal(uniqueSlug("Dark mode", ["dark-mode", "dark-mode-2"]), "dark-mode-3");
  assert.equal(uniqueSlug("Dark mode", []), "dark-mode");
});
