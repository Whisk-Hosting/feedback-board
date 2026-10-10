// Staff pages: ideas waiting for approval, categories, settings and the emails sent.
import { html, raw } from "hono/html";
import { ago, canAdmin, type Category, type Post, type Viewer } from "../model.js";
import type { ApiKey, Email, Settings } from "../store.js";
import { icon } from "./icons.js";
import { empty, notice } from "./parts.js";

export type Tab = "waiting" | "categories" | "settings" | "emails";

const tabs = (on: Tab, v: Viewer, waiting: number) => html`
<nav class="subnav" aria-label="Manage">
  <a href="/manage"${on === "waiting" ? raw(' aria-current="page"') : ""}>${icon.eyeOff} Hidden${waiting ? html` (${waiting})` : ""}</a>
  <a href="/manage/categories"${on === "categories" ? raw(' aria-current="page"') : ""}>${icon.tag} Categories</a>
  ${canAdmin(v) ? html`<a href="/manage/settings"${on === "settings" ? raw(' aria-current="page"') : ""}>${icon.settings} Settings</a>` : ""}
  <a href="/manage/emails"${on === "emails" ? raw(' aria-current="page"') : ""}>${icon.mail} Emails</a>
</nav>`;

const frame = (on: Tab, v: Viewer, waiting: number, flash: string | undefined, body: unknown) => html`
<div class="wrap">
  <section class="page-head"><h1>Manage</h1></section>
  ${tabs(on, v, waiting)}
  ${notice(flash)}
  <div style="padding-bottom:80px; max-width: 820px">${body}</div>
</div>`;

export const waitingPage = (v: Viewer, hidden: readonly Post[], now: Date, flash?: string) =>
  frame(
    "waiting",
    v,
    hidden.length,
    flash,
    hidden.length === 0
      ? empty("Nothing hidden")
      : html`<ul class="list panel">${hidden.map(
          (p) => html`<li>
        <span class="grow"><a href="/p/${p.id}"><b>${p.title}</b></a><br><span class="muted small">${p.author_name || "Someone"} · ${ago(p.created_at, now)}</span></span>
        <form method="post" action="/posts/${p.id}/hide"><input type="hidden" name="on" value="0"><input type="hidden" name="back" value="/manage"><button class="btn small primary">${icon.check} Approve</button></form>
        <form method="post" action="/posts/${p.id}/delete" data-confirm="Delete this idea?"><input type="hidden" name="back" value="/manage"><button class="btn small ghost danger">${icon.trash}</button></form>
      </li>`,
        )}</ul>`,
  );

export const categoriesPage = (v: Viewer, cats: readonly Category[], counts: ReadonlyMap<number, number>, waiting: number, flash?: string, error?: string) =>
  frame(
    "categories",
    v,
    waiting,
    flash,
    html`${notice(error, "error")}
  <div class="panel">
    ${cats.length === 0
      ? html`<p class="muted">No categories</p>`
      : html`<ul class="list">${cats.map(
          (c, i) => html`<li>
        <form class="grow" method="post" action="/manage/categories/${c.id}"><label class="sr" for="cat-${c.id}">Name</label><input id="cat-${c.id}" type="text" name="name" value="${c.name}" required maxlength="60"><button class="btn small">Save</button></form>
        <span class="muted small">${counts.get(c.id) ?? 0} ideas</span>
        <form method="post" action="/manage/categories/${c.id}/move"><input type="hidden" name="dir" value="up"><button class="icon-btn" aria-label="Move up"${i === 0 ? raw(" disabled") : ""}>↑</button></form>
        <form method="post" action="/manage/categories/${c.id}/move"><input type="hidden" name="dir" value="down"><button class="icon-btn" aria-label="Move down"${i === cats.length - 1 ? raw(" disabled") : ""}>↓</button></form>
        <form method="post" action="/manage/categories/${c.id}/delete" data-confirm="Delete ${c.name}? Its ideas stay, without a category."><button class="icon-btn" aria-label="Delete">${icon.trash}</button></form>
      </li>`,
        )}</ul>`}
  </div>
  <form class="panel row" method="post" action="/manage/categories">
    <label class="sr" for="new-cat">New category</label>
    <input id="new-cat" type="text" name="name" required maxlength="60" placeholder="New category" style="flex:1; min-width: 200px">
    <button class="btn primary">${icon.plus} Add</button>
  </form>`,
  );

// The API keys panel. keys is undefined when they could not be loaded; newKey is shown once.
export type KeysView = { keys: readonly ApiKey[] | undefined; newKey?: string; base: string; error?: string };

const keysPanel = (k: KeysView, now: Date) => html`
  <section class="panel" id="api">
    <h2 style="margin:0 0 6px;font-size:1.15rem">${icon.lock} API keys</h2>
    <p class="muted small" style="margin:0 0 16px">Scripts and AI agents use a key to do what staff do here: list and post ideas, reply, change statuses, merge, and publish the changelog. Anyone with a key can act as staff, so keep it secret.</p>
    ${notice(k.error, "error")}
    ${k.newKey
      ? html`<div class="notice" role="status" style="flex-direction:column;align-items:stretch">
      <span>Copy the key now. It won't show again.</span>
      <label class="sr" for="new-key">New API key</label>
      <input id="new-key" class="keyfield" type="text" readonly value="${k.newKey}" onfocus="this.select()">
    </div>`
      : ""}
    ${k.keys === undefined
      ? html`<p class="muted">The keys could not be loaded. Reload the page to try again.</p>`
      : k.keys.length === 0
        ? html`<p class="muted">No keys yet.</p>`
        : html`<ul class="list">${k.keys.map(
            (key) => html`<li>
        <span class="grow"><b>${key.label}</b><br><code class="small">${key.prefix}…</code></span>
        <span class="muted small">${key.last_used_at ? `Used ${ago(key.last_used_at, now)}` : "Not used yet"} · made ${ago(key.created_at, now)}</span>
        <form method="post" action="/manage/settings/keys/${key.id}/revoke" data-confirm="Revoke ${key.label}? Anything using it stops working."><button class="btn small ghost danger">${icon.trash} Revoke</button></form>
      </li>`,
          )}</ul>`}
    <form class="row" method="post" action="/manage/settings/keys" style="margin-top:16px">
      <label class="sr" for="key-label">Key name</label>
      <input id="key-label" type="text" name="label" required maxlength="80" placeholder="Name, like Support inbox" style="flex:1;min-width:200px">
      <button class="btn primary">${icon.plus} Make key</button>
    </form>
    <p class="label" style="margin:20px 0 0">Base URL</p>
    <pre class="codeblock">${k.base}/api/v1</pre>
    <pre class="codeblock">curl ${k.base}/api/v1/ideas?status=open \
  -H "Authorization: Bearer YOUR_KEY"

curl -X POST ${k.base}/api/v1/ideas \
  -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"title": "Dark mode", "author_email": "ana@example.com"}'</pre>
    <p class="muted small" style="margin:0">GET ${k.base}/api/v1 lists every endpoint. Errors come back as {"error": {"code", "message", "fix"}}.</p>
  </section>`;

export const settingsPage = (v: Viewer, s: Settings, waiting: number, flash?: string, error?: string, keys?: KeysView) =>
  frame(
    "settings",
    v,
    waiting,
    flash,
    html`${notice(error, "error")}
  <form class="panel" method="post" action="/manage/settings">
    <div class="field"><label for="board_name">Board name</label><input id="board_name" name="board_name" type="text" required maxlength="60" value="${s.board_name}"></div>
    <div class="field"><label for="tagline">Tagline</label><input id="tagline" name="tagline" type="text" maxlength="200" value="${s.tagline}"></div>
    <div class="grid-2">
      <div class="field"><label for="accent">Color</label><input id="accent" name="accent" type="color" value="${s.accent}"></div>
      <div class="field"><label for="timezone">Time zone</label><input id="timezone" name="timezone" type="text" maxlength="60" value="${s.timezone}"></div>
    </div>
    <div class="field"><label for="email_from">Send email from</label><input id="email_from" name="email_from" type="email" maxlength="254" value="${s.email_from}" placeholder="feedback@yourdomain.com"></div>
    <div class="field"><label class="check"><input type="checkbox" name="review_new" value="1"${s.review_new ? raw(" checked") : ""}> Hide new ideas until approved</label></div>
    <div class="form-foot"><button class="btn primary">Save</button></div>
  </form>
  ${s.has_sample
    ? html`<form class="panel spread" method="post" action="/manage/sample/remove" data-confirm="Remove the sample ideas, votes, comments and changelog entries?">
    <span class="label">Sample data</span><button class="btn danger">${icon.trash} Remove sample data</button>
  </form>`
    : ""}
  ${keys ? keysPanel(keys, new Date()) : ""}`,
  );

export const emailsPage = (v: Viewer, emails: readonly Email[], now: Date, waiting: number) =>
  frame(
    "emails",
    v,
    waiting,
    undefined,
    emails.length === 0
      ? empty("No emails yet")
      : html`<div class="panel table-wrap"><table class="table">
    <thead><tr><th>To</th><th>Subject</th><th>Status</th><th>When</th></tr></thead>
    <tbody>${emails.map(
      (e) => html`<tr><td>${e.to_email}</td><td>${e.subject}</td><td><span class="pill plain" style="--c: var(--${e.status === "sent" ? "shipped" : e.status === "failed" ? "closed" : "review"})" title="${e.error}">${e.status}</span></td><td class="muted">${ago(e.created_at, now)}</td></tr>`,
    )}</tbody>
  </table></div>`,
  );
