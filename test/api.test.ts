import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commentInput,
  entryInput,
  ideaFilter,
  ideaInput,
  ideaPatch,
  keyFrom,
  keyViewer,
  looksLikeKey,
  mergeInput,
  page,
  paginate,
  voteInput,
  type Result,
} from "../src/apiModel.ts";
import type { Category } from "../src/model.ts";

const cats: Category[] = [
  { id: 1, slug: "features", name: "Feature requests", position: 0 },
  { id: 2, slug: "bugs", name: "Bugs", position: 1 },
];
const key = `fb_${"A".repeat(32)}`;
const code = <T>(r: Result<T>) => (r.ok ? "ok" : r.error.code);
const value = <T>(r: Result<T>) => {
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  return r.value;
};

test("where a key is read from", () => {
  const table: [string, Parameters<typeof keyFrom>[0], string][] = [
    ["bearer", { authorization: `Bearer ${key}` }, key],
    ["bearer in any case", { authorization: `bearer  ${key} ` }, key],
    ["basic, the key as the username", { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, key],
    ["basic with a password too", { authorization: `Basic ${Buffer.from(`${key}:x`).toString("base64")}` }, key],
    ["x-api-key", { xApiKey: key }, key],
    ["?token=", { token: key }, key],
    ["the header wins over ?token=", { authorization: `Bearer ${key}`, token: "other" }, key],
    ["nothing", {}, ""],
  ];
  for (const [name, h, want] of table) assert.equal(keyFrom(h), want, name);
});

test("what a key looks like", () => {
  const table: [string, boolean][] = [
    [key, true],
    [`fb_${"a-_9".repeat(8)}`, true],
    [`fb_${"A".repeat(31)}`, false],
    [`sp_${"A".repeat(32)}`, false],
    ["", false],
  ];
  for (const [k, want] of table) assert.equal(looksLikeKey(k), want, k);
  assert.deepEqual(keyViewer({ id: 7, label: "Zapier" }), { kind: "team", userId: "api-key-7", email: "", name: "Zapier", admin: false });
});

test("paging", () => {
  const table: [string, { limit?: string; offset?: string }, string, { limit: number; offset: number } | undefined][] = [
    ["defaults", {}, "ok", { limit: 50, offset: 0 }],
    ["given", { limit: "10", offset: "20" }, "ok", { limit: 10, offset: 20 }],
    ["limit 0", { limit: "0" }, "LIMIT_INVALID", undefined],
    ["limit too big", { limit: "201" }, "LIMIT_INVALID", undefined],
    ["limit not a number", { limit: "ten" }, "LIMIT_INVALID", undefined],
    ["negative offset", { offset: "-1" }, "OFFSET_INVALID", undefined],
  ];
  for (const [name, q, want, v] of table) {
    const r = page(q);
    assert.equal(code(r), want, name);
    if (v) assert.deepEqual(value(r), v, name);
  }
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(paginate(items, { limit: 2, offset: 0 }), { items: [1, 2], total: 5, next_offset: 2 });
  assert.deepEqual(paginate(items, { limit: 2, offset: 4 }), { items: [5], total: 5, next_offset: null });
  assert.deepEqual(paginate(items, { limit: 2, offset: 9 }), { items: [], total: 5, next_offset: null });
});

test("filtering ideas", () => {
  const table: [string, Parameters<typeof ideaFilter>[0], string][] = [
    ["nothing", {}, "ok"],
    ["open", { status: "open" }, "ok"],
    ["a status", { status: "planned" }, "ok"],
    ["an unknown status", { status: "done" }, "STATUS_FILTER_INVALID"],
    ["a sort", { sort: "top" }, "ok"],
    ["an unknown sort", { sort: "best" }, "SORT_INVALID"],
    ["a category by slug", { category: "bugs" }, "ok"],
    ["a category by id", { category: "1" }, "ok"],
    ["an unknown category", { category: "nope" }, "CATEGORY_UNKNOWN"],
  ];
  for (const [name, q, want] of table) assert.equal(code(ideaFilter(q, cats)), want, name);
  assert.deepEqual(value(ideaFilter({ category: "bugs", q: " dark " }, cats)), { status: undefined, category: 2, q: "dark", sort: "trending" });
  const r = ideaFilter({ category: "nope" }, cats);
  assert.equal(r.ok ? 0 : r.error.status, 400);
});

test("a new idea", () => {
  const table: [string, Record<string, unknown>, string][] = [
    ["a title", { title: "Dark mode" }, "ok"],
    ["no title", {}, "TITLE_INVALID"],
    ["a short title", { title: " ab " }, "TITLE_INVALID"],
    ["a category slug", { title: "Dark mode", category: "features" }, "ok"],
    ["an unknown category", { title: "Dark mode", category_id: 9 }, "CATEGORY_UNKNOWN"],
    ["for a customer", { title: "Dark mode", author_email: "Ana@Example.com" }, "ok"],
    ["for a bad email", { title: "Dark mode", author_email: "ana" }, "EMAIL_INVALID"],
  ];
  for (const [name, b, want] of table) assert.equal(code(ideaInput(b, cats)), want, name);
  assert.deepEqual(value(ideaInput({ title: "Dark mode", details: "At night", category_id: 2, author_email: "Ana@Example.com", author_name: "Ana" }, cats)), {
    title: "Dark mode",
    body: "At night",
    category_id: 2,
    author: { email: "ana@example.com", name: "Ana" },
  });
  assert.equal(value(ideaInput({ title: "Dark mode", body: "x" }, cats)).body, "x", "body is accepted for details");
});

test("changing an idea", () => {
  const was = { title: "Dark mode", body: "At night", category_id: 1, status: "review" as const };
  const table: [string, Record<string, unknown>, string, object | undefined][] = [
    ["nothing", {}, "NOTHING_TO_CHANGE", undefined],
    ["a title", { title: "Night mode" }, "ok", { edit: { title: "Night mode", body: "At night", category_id: 1 } }],
    ["clear the category", { category_id: null }, "ok", { edit: { title: "Dark mode", body: "At night", category_id: null } }],
    ["a status, voters told", { status: "planned" }, "ok", { status: { status: "planned", note: "", notify: true } }],
    ["a status, quietly", { status: "planned", notify_voters: false, comment_value: "Soon" }, "ok", { status: { status: "planned", note: "Soon", notify: false } }],
    ["the same status, no note: no change", { status: "review" }, "ok", {}],
    ["the same status with a note", { status: "review", note: "Looking" }, "ok", { status: { status: "review", note: "Looking", notify: true } }],
    ["an unknown status", { status: "done" }, "STATUS_INVALID", undefined],
    ["pin", { pinned: true }, "ok", { pinned: true }],
    ["pin with a string", { pinned: "yes" }, "PINNED_INVALID", undefined],
    ["hide", { hidden: false }, "ok", { hidden: false }],
    ["a short title", { title: "x" }, "TITLE_INVALID", undefined],
  ];
  for (const [name, b, want, v] of table) {
    const r = ideaPatch(b, cats, was);
    assert.equal(code(r), want, name);
    if (v) assert.deepEqual(value(r), v, name);
  }
});

test("a comment", () => {
  const table: [string, Record<string, unknown>, string][] = [
    ["a reply", { value: "On it" }, "ok"],
    ["body for value", { body: "On it" }, "ok"],
    ["empty", { value: "  " }, "VALUE_REQUIRED"],
    ["an internal note", { value: "Ask Sam", internal: true }, "ok"],
    ["internal not a boolean", { value: "x", internal: "yes" }, "INTERNAL_INVALID"],
    ["for a customer", { value: "Me too", author_email: "ana@example.com" }, "ok"],
    ["an internal note for a customer", { value: "x", internal: true, author_email: "ana@example.com" }, "INTERNAL_FOR_CUSTOMER"],
  ];
  for (const [name, b, want] of table) assert.equal(code(commentInput(b)), want, name);
});

test("a vote and a merge", () => {
  assert.deepEqual(value(voteInput({ voter_email: "Ana@Example.com", voter_name: "Ana" })), { email: "ana@example.com", name: "Ana" });
  assert.deepEqual(value(voteInput({ email: "ben@example.com" })), { email: "ben@example.com", name: "" });
  assert.equal(code(voteInput({})), "EMAIL_INVALID");
  const table: [string, Record<string, unknown>, string][] = [
    ["another idea", { into_post_id: 4 }, "ok"],
    ["into for short", { into: "4" }, "ok"],
    ["itself", { into_post_id: 3 }, "MERGE_TARGET_INVALID"],
    ["nothing", {}, "MERGE_TARGET_INVALID"],
    ["not a number", { into_post_id: "x" }, "MERGE_TARGET_INVALID"],
  ];
  for (const [name, b, want] of table) assert.equal(code(mergeInput(b, 3)), want, name);
});

test("a changelog entry", () => {
  const table: [string, Record<string, unknown>, string][] = [
    ["a title", { title: "Dark mode is here" }, "ok"],
    ["no title", {}, "TITLE_INVALID"],
    ["a type", { title: "x", type: "fixed" }, "ok"],
    ["an unknown type", { title: "x", type: "broken" }, "TYPE_INVALID"],
    ["ideas", { title: "x", post_ids: [1, 2, 2] }, "ok"],
    ["ideas not numbers", { title: "x", post_ids: ["a"] }, "POST_IDS_INVALID"],
    ["ideas not a list", { title: "x", post_ids: 3 }, "POST_IDS_INVALID"],
    ["publish not a boolean", { title: "x", publish: 1 }, "PUBLISH_INVALID"],
  ];
  for (const [name, b, want] of table) assert.equal(code(entryInput(b)), want, name);
  assert.deepEqual(value(entryInput({ title: "Dark mode", details: "Here", type: "new", post_ids: [3, 3, 4], publish: true })), { title: "Dark mode", body: "Here", label: "new", posts: [3, 4], publish: true });
  const was = { title: "Old", body: "Words", label: "fixed" as const, posts: [7] };
  assert.deepEqual(value(entryInput({ type: "improved" }, was)), { title: "Old", body: "Words", label: "improved", posts: [7], publish: false }, "a change keeps what it leaves out");
  assert.equal(code(entryInput({ title: "" }, was)), "TITLE_INVALID", "a change cannot empty the title");
});
