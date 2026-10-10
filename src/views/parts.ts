// Pieces used on more than one page.
import { html, raw } from "hono/html";
import { demoOn } from "../demo.js";
import { ago, avatarColor, excerpt, initials, labelText, plural, signedIn, statusLabel, type Category, type Label, type Post, type Status, type Viewer } from "../model.js";
import { icon } from "./icons.js";

export const avatar = (id: string, name: string, size: "" | "sm" | "lg" = "") =>
  html`<span class="avatar ${size}" style="--bg-av:${raw(avatarColor(id))}" aria-hidden="true">${initials(name)}</span>`;

export const statusPill = (s: Status) => html`<span class="pill s-${s}">${statusLabel[s]}</span>`;
export const labelPill = (l: Label) => html`<span class="pill l-${l}">${labelText[l]}</span>`;

export const notice = (text?: string, kind: "" | "error" = "") =>
  text ? html`<div class="notice ${kind}" role="status">${kind === "error" ? icon.x : icon.check}<span>${text}</span></div>` : "";

export const message = (title: string, body: string, link?: { href: string; label: string }) => html`
<div class="wrap message">
  <h1>${title}</h1>
  <p class="muted">${body}</p>
  ${link ? html`<a class="btn primary" href="${link.href}">${link.label}</a>` : ""}
</div>`;

export const empty = (title: string, action?: unknown) => html`<div class="empty">${icon.bulb}<h2>${title}</h2>${action ?? ""}</div>`;

// The vote button. Signed in: a form the script turns into a toggle in place. On the demo,
// "Look around" first. Otherwise: sign in, then back here.
export const voteButton = (v: Viewer, p: Pick<Post, "id" | "vote_count">, on: boolean, here: string, big = false) => {
  const inner = html`${icon.up}<span class="n">${p.vote_count}</span>${big ? html`<span class="what">${on ? "Voted" : "Vote"}</span>` : ""}`;
  const label = `${on ? "Remove your vote" : "Vote for this"} (${plural(p.vote_count, "vote")})`;
  if (signedIn(v))
    return html`<form class="vote${on ? " on" : ""}${big ? " big" : ""}" method="post" action="/posts/${p.id}/vote" data-vote>
      <input type="hidden" name="back" value="${here}"><button aria-pressed="${on ? "true" : "false"}" aria-label="${label}">${inner}</button></form>`;
  if (demoOn())
    return html`<form class="vote${big ? " big" : ""}" method="post" action="/demo/start?return=${encodeURIComponent(here)}"><button aria-label="${label}">${inner}</button></form>`;
  return html`<div class="vote${big ? " big" : ""}"><a href="/.whisk/login?return=${encodeURIComponent(here)}" aria-label="${label}">${inner}</a></div>`;
};

export const postRow = (v: Viewer, p: Post, voted: boolean, cats: ReadonlyMap<number, Category>, now: Date, here: string) => {
  const cat = p.category_id === null ? undefined : cats.get(p.category_id);
  return html`<article class="post-row${p.hidden ? " hidden-post" : ""}">
  ${voteButton(v, p, voted, here)}
  <div class="body">
    <h2>${p.pinned ? html`<span class="flag" title="Pinned">${icon.pin}</span> ` : ""}${p.hidden ? html`<span class="flag" title="Hidden">${icon.eyeOff}</span> ` : ""}<a href="/p/${p.id}">${p.title}</a></h2>
    ${p.body ? html`<p>${excerpt(p.body)}</p>` : ""}
    <div class="meta">
      ${statusPill(p.status)}
      ${cat ? html`<span class="tag">${icon.tag}${cat.name}</span>` : ""}
      <span class="tag" title="${plural(p.comment_count, "comment")}">${icon.chat}${p.comment_count}</span>
      <span class="tag">${ago(p.created_at, now)}</span>
    </div>
  </div>
</article>`;
};

export const options = <T extends string | number>(items: readonly { value: T; label: string }[], selected: T | undefined) =>
  items.map((i) => html`<option value="${String(i.value)}"${i.value === selected ? raw(" selected") : ""}>${i.label}</option>`);
