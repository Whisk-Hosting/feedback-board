// The changelog: what shipped, newest first, each entry linked to the ideas it delivers.
import { html, raw } from "hono/html";
import { markdown } from "../markdown.js";
import { canModerate, isTeam, labelText, LABELS, longDate, type Entry, type Label, type Post, type Viewer } from "../model.js";
import type { Settings } from "../store.js";
import { icon } from "./icons.js";
import { empty, labelPill, notice, options, statusPill } from "./parts.js";

const entryBlock = (s: Settings, v: Viewer, e: Entry, posts: readonly Post[], link: boolean) => html`
<div class="entry l-${e.label}" id="${e.slug}">
  <div class="when">${e.published_at ? longDate(e.published_at, s.timezone) : html`<span class="pill draft plain">Draft</span>`}</div>
  <article>
    <div class="row">${labelPill(e.label)}${isTeam(v) ? html`<a class="tag" href="/changelog/${e.id}/edit">${icon.edit} Edit</a>` : ""}</div>
    <h2>${link ? html`<a href="/changelog/${e.slug}">${e.title}</a>` : e.title}</h2>
    <div class="prose">${raw(markdown(e.body))}</div>
    ${posts.length
      ? html`<div class="ships"><span>Ideas this ships</span>${posts.map(
          (p) => html`<a href="/p/${p.id}"><span class="check">${icon.check}</span>${p.title}<span class="n">${icon.up}${p.vote_count}</span></a>`,
        )}</div>`
      : ""}
  </article>
</div>`;

export const changelogPage = (s: Settings, v: Viewer, entries: readonly Entry[], postsFor: (id: number) => readonly Post[], flash?: string) => html`
<div class="wrap">
  <section class="hero">
    <div><h1>Changelog</h1></div>
    ${canModerate(v) ? html`<a class="btn primary" href="/changelog/new">${icon.plus} New entry</a>` : ""}
  </section>
  ${notice(flash)}
  <div class="log">
    ${entries.length === 0 ? empty("Nothing shipped yet") : entries.map((e) => entryBlock(s, v, e, postsFor(e.id), true))}
  </div>
</div>`;

export const entryPage = (s: Settings, v: Viewer, e: Entry, posts: readonly Post[], flash?: string) => html`
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/changelog">${icon.left} Changelog</a></nav>
  ${notice(flash)}
  <div class="log" style="padding-top:12px">${entryBlock(s, v, e, posts, false)}</div>
</div>`;

export type EntryForm = { title: string; body: string; label: Label; posts: readonly number[] };

// The editor. Linking ideas is the point: publishing marks them shipped and emails their voters.
export const entryForm = (o: { entry?: Entry; values: EntryForm; candidates: readonly Post[]; error?: string }) => html`
<div class="wrap narrow">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/changelog">${icon.left} Changelog</a></nav>
  <h1>${o.entry ? "Edit entry" : "New entry"}</h1>
  ${notice(o.error, "error")}
  <form class="form-card" method="post" action="${o.entry ? `/entries/${o.entry.id}/edit` : "/entries"}">
    <div class="grid-2">
      <div class="field" style="grid-column: span 1"><label for="title">Title</label><input id="title" name="title" type="text" required maxlength="140" value="${o.values.title}"></div>
      <div class="field"><label for="label">Label</label><select id="label" name="label">${options(LABELS.map((l) => ({ value: l, label: labelText[l] })), o.values.label)}</select></div>
    </div>
    <div class="field"><label for="body">What changed</label><textarea id="body" name="body" maxlength="20000">${o.values.body}</textarea><span class="hint">Markdown</span></div>
    <div class="field">
      <span class="label">Ideas this ships</span>
      ${o.candidates.length === 0
        ? html`<p class="muted small">No open ideas</p>`
        : html`<div class="pick-posts">${o.candidates.map(
            (p) => html`<label><input type="checkbox" name="posts" value="${p.id}"${o.values.posts.includes(p.id) ? raw(" checked") : ""}>${statusPill(p.status)} ${p.title} <span class="muted small">${p.vote_count}</span></label>`,
          )}</div>`}
    </div>
    <div class="form-foot">
      ${o.entry ? html`<button class="btn ghost danger" formaction="/entries/${o.entry.id}/delete" data-confirm-click="Delete this entry?">${icon.trash} Delete</button>` : ""}
      <button class="btn" name="publish" value="0">Save${o.entry?.published_at ? "" : " draft"}</button>
      ${o.entry?.published_at ? "" : html`<button class="btn primary" name="publish" value="1" data-confirm-click="Publish now? Linked ideas move to Shipped and their voters are emailed.">${icon.spark} Publish</button>`}
    </div>
  </form>
</div>`;
