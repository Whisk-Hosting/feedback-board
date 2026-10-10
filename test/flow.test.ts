// End to end through HTTP, as the platform would call the app: identity in X-Whisk-* headers.
// Runs against a local copy started with a fresh database (see README, "Test it"):
//   BASE_URL=http://localhost:8080 npm test
// Without BASE_URL it is skipped.
import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.BASE_URL;
const run = Date.now().toString(36);

type Who = { audience: "customer" | "team" | "anonymous"; id?: string; email?: string; name?: string; roles?: string };
const ana: Who = { audience: "customer", id: `cust-ana-${run}`, email: `ana-${run}@example.com`, name: "Ana" };
const ben: Who = { audience: "customer", id: `cust-ben-${run}`, email: `ben-${run}@example.com`, name: "Ben" };
const staff: Who = { audience: "team", id: `team-sam-${run}`, email: `sam-${run}@acme.test`, name: "Sam", roles: "owner" };
const nobody: Who = { audience: "anonymous" };

const headers = (w: Who): Record<string, string> =>
  w.audience === "anonymous"
    ? { "x-whisk-audience": "anonymous" }
    : { "x-whisk-audience": w.audience, "x-whisk-user-id": w.id!, "x-whisk-email": w.email!, "x-whisk-name": w.name!, "x-whisk-roles": w.roles ?? "" };

const get = (w: Who, path: string) => fetch(base + path, { headers: headers(w), redirect: "manual" });
const post = (w: Who, path: string, form: Record<string, string>, json = false) =>
  fetch(base + path, { method: "POST", headers: { ...headers(w), "content-type": "application/x-www-form-urlencoded", ...(json ? { accept: "application/json" } : {}) }, body: new URLSearchParams(form), redirect: "manual" });

test("a customer posts and votes, staff move it along, followers are emailed", { skip: !base }, async () => {
  // A visitor reads the board but is sent to sign in to post.
  assert.equal((await get(nobody, "/")).status, 200);
  assert.match((await post(nobody, "/posts", { title: "x" })).headers.get("location") ?? "", /^\/\.whisk\/login/);

  // Ana posts an idea; it starts with her vote.
  const created = await post(ana, "/posts", { title: `Offline mode ${run}`, body: "When the internet drops" });
  assert.equal(created.status, 302);
  const path = created.headers.get("location")!.split("?")[0]!;
  const id = path.split("/").pop()!;
  assert.match(await (await get(nobody, path)).text(), new RegExp(`Offline mode ${run}`));

  // Ben votes, then the count is 2; voting again takes it back.
  assert.deepEqual(await (await post(ben, `/posts/${id}/vote`, {}, true)).json(), { voted: true, votes: 2 });
  assert.deepEqual(await (await post(ben, `/posts/${id}/vote`, {}, true)).json(), { voted: false, votes: 1 });
  await post(ben, `/posts/${id}/vote`, {}, true);

  // Customers cannot use staff tools.
  assert.equal((await post(ben, `/posts/${id}/status`, { status: "planned" })).status, 403);
  assert.equal((await get(ben, "/manage")).status, 403);

  // Similar ideas find it while someone types.
  const similar = (await (await get(ben, `/similar?q=${encodeURIComponent("mode offline please")}`)).json()) as { id: number }[];
  assert.ok(similar.some((s) => String(s.id) === id));

  // Staff plan it with a note; both followers get an email, and only staff can see the log.
  assert.equal((await post(staff, `/posts/${id}/status`, { status: "planned", note: "Next month", notify: "1" })).status, 302);
  const emails = await (await get(staff, "/manage/emails")).text();
  assert.match(emails, new RegExp(`ana-${run}@example.com`));
  assert.match(emails, new RegExp(`ben-${run}@example.com`));
  assert.match(await (await get(nobody, "/roadmap")).text(), new RegExp(`Offline mode ${run}`));

  // A staff note is invisible to customers.
  await post(staff, `/posts/${id}/comments`, { body: `secret-${run}`, note: "1" });
  assert.doesNotMatch(await (await get(ana, path)).text(), new RegExp(`secret-${run}`));
  assert.match(await (await get(staff, path)).text(), new RegExp(`secret-${run}`));

  // Staff vote for a customer by email; when that customer signs in, the vote is theirs.
  const cleo: Who = { audience: "customer", id: `cust-cleo-${run}`, email: `cleo-${run}@example.com`, name: "Cleo" };
  await post(staff, `/posts/${id}/vote-for`, { email: cleo.email!, name: "Cleo" });
  await post(cleo, `/posts/${id}/comments`, { body: "Thanks for adding me" });
  assert.deepEqual(await (await post(cleo, `/posts/${id}/vote`, {}, true)).json(), { voted: false, votes: 2 }, "her vote was already there");

  // A duplicate merges into it: votes move, the duplicate redirects.
  const dup = (await post(ben, "/posts", { title: `Work offline ${run}` })).headers.get("location")!.split("?")[0]!.split("/").pop()!;
  await post(staff, `/posts/${dup}/merge`, { into: id });
  assert.equal((await get(nobody, `/p/${dup}`)).headers.get("location"), `/p/${id}`);

  // A changelog entry ships it.
  const entry = await post(staff, "/entries", { title: `Offline ${run}`, body: "It works offline now.", label: "new", posts: id, publish: "1" });
  assert.match(entry.headers.get("location") ?? "", /ok=published/);
  assert.match(await (await get(nobody, path)).text(), /Shipped/);
});
