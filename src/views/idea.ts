// One idea with its conversation, the form for a new idea, and the staff tools beside it.
import { html, raw } from "hono/html";
import { markdown } from "../markdown.js";
import {
  ago,
  canComment,
  canDeleteComment,
  canEditPost,
  canModerate,
  displayName,
  longDate,
  plural,
  statusLabel,
  STATUSES,
  type Category,
  type Comment,
  type Entry,
  type Post,
  type Viewer,
} from "../model.js";
import type { Settings, Voter } from "../store.js";
import { icon } from "./icons.js";
import { avatar, labelPill, notice, options, statusPill, voteButton } from "./parts.js";

export type IdeaView = {
  s: Settings;
  v: Viewer;
  post: Post;
  cat?: Category;
  cats: readonly Category[];
  comments: readonly Comment[];
  voted: boolean;
  voters: readonly Voter[];
  shippedIn: readonly Entry[];
  others: readonly Pick<Post, "id" | "title">[];
  now: Date;
  flash?: string;
  error?: string;
};

const commentItem = (b: IdeaView, c: Comment) => {
  const tools = canDeleteComment(b.v, c) || canModerate(b.v)
    ? html`<span class="tools">
        ${canModerate(b.v) && c.kind === "comment"
          ? html`<form method="post" action="/comments/${c.id}/hide"><input type="hidden" name="hidden" value="${c.hidden ? "0" : "1"}"><button class="icon-btn" title="${c.hidden ? "Show" : "Hide"}" aria-label="${c.hidden ? "Show" : "Hide"} comment">${c.hidden ? icon.eye : icon.eyeOff}</button></form>`
          : ""}
        ${canDeleteComment(b.v, c)
          ? html`<form method="post" action="/comments/${c.id}/delete" data-confirm="Delete this?"><button class="icon-btn" title="Delete" aria-label="Delete">${icon.trash}</button></form>`
          : ""}
      </span>`
    : "";
  if (c.kind === "status" && c.status)
    return html`<li class="event">
      <span class="dot s-${c.status}">${c.status === "shipped" ? icon.check : c.status === "closed" ? icon.x : icon.right}</span>
      <div class="head"><b>${c.author_name}</b> moved this to ${statusPill(c.status)} <span>${ago(c.created_at, b.now)}</span>${tools}</div>
      ${c.body ? html`<div class="bubble says prose">${raw(markdown(c.body))}</div>` : ""}
    </li>`;
  if (c.kind === "merged")
    return html`<li class="event"><span class="dot">${icon.merge}</span><div class="head"><b>${c.author_name}</b> ${c.body} <span>${ago(c.created_at, b.now)}</span></div></li>`;
  return html`<li class="${c.team ? "team" : ""} ${c.kind === "note" ? "note" : ""} ${c.hidden ? "is-hidden" : ""}" id="c${c.id}">
    ${avatar(c.author_id, c.author_name || "Someone", "lg")}
    <div class="head"><b>${c.author_name || "Someone"}</b>${c.team ? html`<span class="pill team plain">Team</span>` : ""}${c.kind === "note" ? html`<span class="pill plain" style="--c: var(--progress)">${icon.lock} Staff note</span>` : ""}${c.hidden ? html`<span class="pill plain">Hidden</span>` : ""}<span>${ago(c.created_at, b.now)}</span>${tools}</div>
    <div class="bubble prose">${raw(markdown(c.body))}</div>
  </li>`;
};

const replyForm = (b: IdeaView) => {
  if (!canComment(b.v))
    return html`<p class="reply"><a class="btn" href="/.whisk/login?return=${encodeURIComponent(`/p/${b.post.id}#comments`)}">Sign in to comment</a></p>`;
  return html`<form class="reply" method="post" action="/posts/${b.post.id}/comments">
    ${avatar(b.v.userId, displayName(b.v), "lg")}
    <label class="sr" for="comment">Comment</label>
    <textarea id="comment" name="body" required maxlength="5000" placeholder="Add a comment"></textarea>
    <div class="actions">
      ${canModerate(b.v) ? html`<label class="check"><input type="checkbox" name="note" value="1"> ${icon.lock} Staff note</label>` : html`<span></span>`}
      <button class="btn primary">Comment</button>
    </div>
  </form>`;
};

const staffPanel = (b: IdeaView) => html`
<div class="card staff">
  <h3>${icon.settings} Manage</h3>
  <form method="post" action="/posts/${b.post.id}/status">
    <span class="label">Status</span>
    <div class="status-pick">
      ${STATUSES.map((s) => html`<label style="--c: var(--${s})"><input type="radio" name="status" value="${s}"${s === b.post.status ? raw(" checked") : ""}><span>${statusLabel[s]}</span></label>`)}
    </div>
    <label class="sr" for="status-note">Note</label>
    <textarea id="status-note" name="note" maxlength="2000" placeholder="Note to voters" style="min-height:72px"></textarea>
    <label class="check"><input type="checkbox" name="notify" value="1" checked> Email ${plural(b.post.vote_count, "voter")}</label>
    <button class="btn small primary">Update status</button>
  </form>
  <hr>
  <div class="row">
    <form class="inline" method="post" action="/posts/${b.post.id}/pin"><input type="hidden" name="on" value="${b.post.pinned ? "0" : "1"}"><button class="btn small">${icon.pin} ${b.post.pinned ? "Unpin" : "Pin"}</button></form>
    <form class="inline" method="post" action="/posts/${b.post.id}/hide"><input type="hidden" name="on" value="${b.post.hidden ? "0" : "1"}"><button class="btn small">${b.post.hidden ? html`${icon.eye} Approve` : html`${icon.eyeOff} Hide`}</button></form>
    <a class="btn small" href="/p/${b.post.id}/edit">${icon.edit} Edit</a>
  </div>
  <hr>
  <form method="post" action="/posts/${b.post.id}/vote-for">
    <span class="label">Add a vote for a customer</span>
    <input type="email" name="email" required placeholder="Email" autocomplete="off">
    <input type="text" name="name" placeholder="Name" maxlength="120" autocomplete="off">
    <button class="btn small">${icon.plus} Add vote</button>
  </form>
  ${b.others.length
    ? html`<form method="post" action="/posts/${b.post.id}/merge" data-confirm="Merge this idea? Its votes move to the other one and this one closes.">
    <label class="label" for="merge-into">Merge into</label>
    <select id="merge-into" name="into" required>${options([{ value: "", label: "Choose an idea" }, ...b.others.map((o) => ({ value: String(o.id), label: `#${o.id} ${o.title}` }))], "")}</select>
    <button class="btn small">${icon.merge} Merge</button>
  </form>`
    : ""}
  <form method="post" action="/posts/${b.post.id}/delete" data-confirm="Delete this idea, its votes and comments?">
    <button class="btn small ghost danger">${icon.trash} Delete idea</button>
  </form>
</div>
${b.voters.length
  ? html`<div class="card"><h3>${plural(b.voters.length, "voter")}</h3><ul class="voters">${b.voters.map(
      (vt) => html`<li>${avatar(vt.user_id, vt.name || vt.email || "?", "sm")}<span title="${vt.email}">${vt.name || vt.email || "Unknown"}${vt.added_by && vt.added_by !== "merge" ? html` <span class="muted small">· added</span>` : ""}</span></li>`,
    )}</ul></div>`
  : ""}`;

export const ideaPage = (b: IdeaView) => html`
<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">${icon.left} All ideas</a>
    ${b.cat ? html`<span>/</span><a href="/b/${b.cat.slug}">${b.cat.name}</a>` : ""}
  </nav>
  ${notice(b.flash)}${notice(b.error, "error")}
  <div class="idea">
    <article class="idea-main">
      <div class="row">${statusPill(b.post.status)}${b.post.pinned ? html`<span class="pill plain">${icon.pin} Pinned</span>` : ""}${b.post.hidden ? html`<span class="pill plain">${icon.eyeOff} Hidden</span>` : ""}</div>
      <h1>${b.post.title}</h1>
      <div class="byline">${avatar(b.post.author_id, b.post.author_name || "Someone", "sm")}<b>${b.post.author_name || "Someone"}</b><span>${ago(b.post.created_at, b.now)}</span>
        ${canEditPost(b.v, b.post) && !canModerate(b.v) ? html`<a class="tag" href="/p/${b.post.id}/edit">${icon.edit} Edit</a>` : ""}</div>
      ${b.post.body ? html`<div class="prose">${raw(markdown(b.post.body))}</div>` : ""}
      <section class="activity" id="comments" aria-label="Activity">
        <h2>${plural(b.post.comment_count, "comment")}</h2>
        <ol class="thread">${b.comments.map((c) => commentItem(b, c))}</ol>
        ${replyForm(b)}
      </section>
    </article>
    <aside class="side">
      <div class="card side-vote">
        ${voteButton(b.v, b.post, b.voted, `/p/${b.post.id}`, true)}
        <dl class="facts">
          <dt>Status</dt><dd>${statusLabel[b.post.status]}</dd>
          ${b.cat ? html`<dt>Category</dt><dd>${b.cat.name}</dd>` : ""}
          <dt>Posted</dt><dd>${longDate(b.post.created_at, b.s.timezone)}</dd>
        </dl>
      </div>
      ${b.shippedIn.length
        ? html`<div class="card"><h3>Shipped in</h3><ul class="shipped-in">${b.shippedIn.map((e) => html`<li><a href="/changelog/${e.slug}">${e.title}</a> ${labelPill(e.label)}</li>`)}</ul></div>`
        : ""}
      ${canModerate(b.v) ? staffPanel(b) : ""}
    </aside>
  </div>
</div>`;

export type IdeaForm = { title: string; body: string; category_id: number | null };

export const ideaForm = (o: { v: Viewer; cats: readonly Category[]; values: IdeaForm; editing?: Post; error?: string }) => html`
<div class="wrap narrow">
  <h1>${o.editing ? "Edit idea" : "Post an idea"}</h1>
  ${notice(o.error, "error")}
  <form class="form-card" method="post" action="${o.editing ? `/posts/${o.editing.id}/edit` : "/posts"}">
    <div class="field">
      <label for="title">Title</label>
      <input class="title-input" id="title" name="title" type="text" required maxlength="140" value="${o.values.title}" placeholder="Short and specific" autocomplete="off" ${o.editing ? "" : raw("data-similar")} autofocus>
    </div>
    <div class="similar" id="similar" hidden aria-live="polite"><div class="head">Already asked?</div><div class="list-similar"></div></div>
    ${o.cats.length
      ? html`<div class="field">
      <label for="category">Category</label>
      <select id="category" name="category_id">${options([{ value: "", label: "None" }, ...o.cats.map((c) => ({ value: String(c.id), label: c.name }))], o.values.category_id === null ? "" : String(o.values.category_id))}</select>
    </div>`
      : ""}
    <div class="field">
      <label for="body">Details</label>
      <textarea id="body" name="body" maxlength="10000" placeholder="What are you trying to do?">${o.values.body}</textarea>
      <span class="hint">Markdown</span>
    </div>
    <div class="form-foot">
      <a class="btn ghost" href="${o.editing ? `/p/${o.editing.id}` : "/"}">Cancel</a>
      <button class="btn primary">${o.editing ? "Save" : html`${icon.plus} Post idea`}</button>
    </div>
  </form>
</div>`;

