// The board, the roadmap and a person's own ideas.
import { html } from "hono/html";
import { canPost, longDate, plural, ROADMAP, signedIn, sortLabel, SORTS, statusLabel, STATUSES, type Category, type Entry, type Post, type Sort, type Status, type Viewer } from "../model.js";
import type { Settings } from "../store.js";
import { icon } from "./icons.js";
import { empty, notice, options, postRow, statusPill } from "./parts.js";

export type BoardView = {
  s: Settings;
  v: Viewer;
  posts: readonly Post[];
  voted: ReadonlySet<number>;
  cats: readonly Category[];
  catCounts: ReadonlyMap<number | "all", number>;
  current?: Category;
  sort: Sort;
  status?: Status | "open";
  q: string;
  counts: Readonly<Record<Status, number>>;
  latest: readonly Entry[];
  now: Date;
  here: string;
  flash?: string;
};

const query = (base: string, p: { sort: Sort; status?: string; q: string }, change: Partial<{ sort: Sort; status: string; q: string }>) => {
  const next = { ...p, ...change };
  const qs = new URLSearchParams(
    Object.entries({ sort: next.sort === "trending" ? "" : next.sort, status: next.status ?? "", q: next.q }).filter(([, val]) => val) as [string, string][],
  ).toString();
  return qs ? `${base}?${qs}` : base;
};

const newIdea = (v: Viewer, cat?: Category, kind = "primary") => {
  const href = cat ? `/new?category=${cat.id}` : "/new";
  return html`<a class="btn ${kind}" href="${canPost(v) ? href : `/.whisk/login?return=${encodeURIComponent(href)}`}">${icon.plus} Post an idea</a>`;
};

export const boardPage = (b: BoardView) => {
  const base = b.current ? `/b/${b.current.slug}` : "/";
  const state = { sort: b.sort, status: b.status, q: b.q };
  const catMap = new Map(b.cats.map((c) => [c.id, c]));
  return html`
<div class="wrap">
  <section class="hero">
    <div>
      <h1>${b.current?.name ?? b.s.board_name}</h1>
      ${b.s.tagline && !b.current ? html`<p class="lead">${b.s.tagline}</p>` : ""}
    </div>
    ${newIdea(b.v, b.current)}
  </section>
  ${notice(b.flash)}
  <div class="board">
    <section aria-label="Ideas">
      <form class="toolbar" method="get" action="${base}" role="search">
        <nav class="segmented" aria-label="Sort">
          ${SORTS.map((s) => html`<a href="${query(base, state, { sort: s })}"${s === b.sort ? html` aria-current="page"` : ""}>${sortLabel[s]}</a>`)}
        </nav>
        ${b.sort !== "trending" ? html`<input type="hidden" name="sort" value="${b.sort}">` : ""}
        <select name="status" aria-label="Status" data-autosubmit>
          ${options(
            [{ value: "", label: "Any status" }, { value: "open", label: "Open" }, ...STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))],
            b.status ?? "",
          )}
        </select>
        <label class="search"><span class="sr">Search</span>${icon.search}<input type="search" name="q" value="${b.q}" placeholder="Search ideas" data-autosubmit></label>
      </form>
      ${b.posts.length === 0
        ? empty(b.q || b.status ? "Nothing matches" : "No ideas yet", b.q || b.status ? html`<a class="btn" href="${base}">Clear</a>` : newIdea(b.v, b.current))
        : html`<div class="posts">${b.posts.map((p) => postRow(b.v, p, b.voted.has(p.id), catMap, b.now, b.here))}</div>`}
    </section>
    <aside class="side">
      <div class="card cats-card">
        <h3>Categories</h3>
        <ul class="cats">
          <li><a href="/"${!b.current ? html` aria-current="page"` : ""}>All ideas <span class="n">${b.catCounts.get("all") ?? 0}</span></a></li>
          ${b.cats.map((c) => html`<li><a href="/b/${c.slug}"${b.current?.id === c.id ? html` aria-current="page"` : ""}>${c.name} <span class="n">${b.catCounts.get(c.id) ?? 0}</span></a></li>`)}
        </ul>
      </div>
      <div class="card side-extra">
        <h3>Roadmap</h3>
        <ul class="mini-road">
          ${ROADMAP.map((s) => html`<li><a href="/roadmap">${statusPill(s)}<span class="n">${b.counts[s]}</span></a></li>`)}
        </ul>
      </div>
      ${b.latest.length
        ? html`<div class="card side-extra">
        <h3>Latest updates</h3>
        <ul class="mini-log">
          ${b.latest.map((e) => html`<li><a href="/changelog/${e.slug}">${e.title}</a><time>${e.published_at ? longDate(e.published_at, b.s.timezone) : ""}</time></li>`)}
        </ul>
      </div>`
        : ""}
      ${!signedIn(b.v) ? html`<div class="card cta-card side-extra"><h3>Have an idea?</h3><p>Post it, vote on others, hear when it ships.</p>${newIdea(b.v, undefined, "light")}</div>` : ""}
    </aside>
  </div>
</div>`;
};

export const roadmapPage = (s: Settings, columns: readonly { status: Status; posts: readonly Post[] }[], cats: ReadonlyMap<number, Category>) => html`
<div class="wrap">
  <section class="hero"><div><h1>Roadmap</h1></div></section>
  <div class="road">
    ${columns.map(
      (col) => html`<section class="column s-${col.status}" aria-label="${statusLabel[col.status]}">
      <header><h2>${statusLabel[col.status]}</h2><span class="n">${col.posts.length}</span></header>
      <div class="cards">
        ${col.posts.length === 0
          ? html`<p class="none">Nothing here yet</p>`
          : col.posts.map((p) => {
              const cat = p.category_id === null ? undefined : cats.get(p.category_id);
              return html`<a class="road-card" href="/p/${p.id}" style="--c: var(--${col.status})">
            <span><span class="t">${p.title}</span>${cat ? html`<span class="tag">${cat.name}</span>` : ""}</span>
            <span class="votes" title="${plural(p.vote_count, "vote")}">${icon.up}${p.vote_count}</span>
          </a>`;
            })}
      </div>
    </section>`,
    )}
  </div>
</div>`;

export const mePage = (v: Viewer, mine: readonly Post[], voted: readonly Post[], emailUpdates: boolean, cats: ReadonlyMap<number, Category>, votedIds: ReadonlySet<number>, now: Date, flash?: string) => html`
<div class="wrap">
  <section class="page-head spread">
    <div><h1>Your ideas</h1><p>${v.email}</p></div>
    <a class="btn ghost" href="/.whisk/logout?return=/">Sign out</a>
  </section>
  ${notice(flash)}
  <div class="board">
    <section class="stack">
      <h2>Posted</h2>
      ${mine.length === 0 ? empty("Nothing posted yet", html`<a class="btn primary" href="/new">${icon.plus} Post an idea</a>`) : html`<div class="posts">${mine.map((p) => postRow(v, p, votedIds.has(p.id), cats, now, "/me"))}</div>`}
      <h2>Voted for</h2>
      ${voted.length === 0 ? empty("No votes yet", html`<a class="btn" href="/">See the ideas</a>`) : html`<div class="posts">${voted.map((p) => postRow(v, p, true, cats, now, "/me"))}</div>`}
    </section>
    <aside class="side">
      <form class="card" method="post" action="/me">
        <h3>Email</h3>
        <label class="check"><input type="checkbox" name="email_updates" value="1"${emailUpdates ? html` checked` : ""}> Updates on ideas I follow</label>
        <div class="form-foot"><button class="btn small primary">Save</button></div>
      </form>
    </aside>
  </div>
</div>`;
