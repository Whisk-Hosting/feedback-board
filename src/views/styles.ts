// The whole stylesheet. Served once at /assets/app.css and cached. Colors are tokens on :root;
// the board's accent color comes from Settings and everything accented follows it.
export const css = String.raw`
@font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: swap; src: url(/fonts/figtree-latin-wght-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Figtree"; font-style: normal; font-weight: 300 900; font-display: swap; src: url(/fonts/figtree-latin-ext-wght-normal.woff2) format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+20A0-20AB, U+20AD-20C0, U+2C60-2C7F, U+A720-A7FF; }
:root {
  --bg: #f7f5f0; --surface: #ffffff; --surface-2: #f0ede6; --ink: #1f1d1a; --muted: #6b665d; --faint: #9a948a;
  --line: #e6e2d9; --line-strong: #d2ccbf;
  --accent: #5b5bd6; --on-accent: #ffffff;
  --accent-soft: color-mix(in oklab, var(--accent) 12%, transparent);
  --accent-ink: color-mix(in oklab, var(--accent) 80%, var(--ink));
  --review: #6b7280; --planned: #2f6fdb; --progress: #d9822b; --shipped: #22a06b; --closed: #b4483c;
  --new: #22a06b; --improved: #2f6fdb; --fixed: #d9822b;
  --shadow-sm: 0 1px 2px rgb(30 25 15 / .06);
  --shadow: 0 1px 2px rgb(30 25 15 / .05), 0 10px 28px -12px rgb(30 25 15 / .18);
  --radius: 16px; --font: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121110; --surface: #1b1a18; --surface-2: #26241f; --ink: #f1ede6; --muted: #a8a196; --faint: #7d776d;
    --line: #2f2c27; --line-strong: #46423b;
    --accent-ink: color-mix(in oklab, var(--accent) 65%, white);
    --accent-soft: color-mix(in oklab, var(--accent) 22%, transparent);
    --review: #9aa3b2; --planned: #6c9cf0; --progress: #f0a254; --shipped: #4cc58f; --closed: #e0766a;
    --new: #4cc58f; --improved: #6c9cf0; --fixed: #f0a254;
    --shadow: 0 1px 2px rgb(0 0 0 / .4), 0 12px 32px -12px rgb(0 0 0 / .7);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: inherit; }
img { max-width: 100%; }
h1, h2, h3 { line-height: 1.2; letter-spacing: -0.018em; margin: 0 0 .4em; }
h1 { font-size: clamp(2rem, 4.6vw, 3rem); font-weight: 780; }
h2 { font-size: 1.45rem; font-weight: 720; }
h3 { font-size: 1.1rem; font-weight: 680; }
p { margin: 0 0 1em; }
.icon { flex: none; vertical-align: -0.2em; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
.muted { color: var(--muted); }
.small { font-size: .875rem; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.spread { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.stack { display: grid; gap: 16px; }

/* Demo bar */
.demo-bar { background: var(--ink); color: var(--bg); font-size: .9rem; }
.demo-bar .wrap { display: flex; gap: 12px; align-items: center; justify-content: space-between; min-height: 46px; flex-wrap: wrap; padding-top: 6px; padding-bottom: 6px; }
.demo-bar form { margin: 0; }
.demo-bar .btn { padding: 7px 14px; font-size: .85rem; }
.demo-bar b { font-weight: 700; }

/* Header */
.site-header { border-bottom: 1px solid var(--line); background: color-mix(in oklab, var(--bg) 88%, transparent); backdrop-filter: saturate(1.4) blur(12px); position: sticky; top: 0; z-index: 20; }
.site-header .wrap { display: flex; align-items: center; gap: 20px; height: 64px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 760; font-size: 1.08rem; text-decoration: none; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.brand-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); flex: none; }
.nav { display: flex; gap: 2px; margin-left: auto; align-items: center; }
.nav a { text-decoration: none; padding: 8px 12px; border-radius: 10px; color: var(--muted); font-weight: 580; font-size: .95rem; display: inline-flex; gap: 7px; align-items: center; white-space: nowrap; }
.nav a:hover, .nav a[aria-current] { color: var(--ink); background: var(--surface-2); }
.nav .me { padding: 4px; border-radius: 99px; }
@media (max-width: 720px) { .nav a .label { display: none; } .nav a { padding: 9px; } .site-header .wrap { gap: 10px; } }

/* Buttons, pills, avatars */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font: 620 .95rem/1 var(--font); padding: 12px 18px; border-radius: 12px; text-decoration: none; cursor: pointer; transition: transform .12s, box-shadow .12s, background .12s, border-color .12s; white-space: nowrap; }
.btn:hover { transform: translateY(-1px); box-shadow: var(--shadow); }
.btn:active { transform: none; box-shadow: none; }
.btn.primary { background: var(--accent); border-color: transparent; color: var(--on-accent); box-shadow: 0 1px 0 rgb(255 255 255 / .15) inset, 0 6px 16px -8px var(--accent); }
.btn.ghost { background: transparent; border-color: transparent; }
.btn.ghost:hover { background: var(--surface-2); box-shadow: none; }
.btn.light { background: var(--bg); color: var(--ink); border-color: transparent; }
.btn.small { padding: 8px 12px; font-size: .85rem; border-radius: 10px; }
.btn.danger { color: var(--closed); }
.btn.block { width: 100%; }
.pill { display: inline-flex; align-items: center; gap: 6px; font: 650 .78rem/1 var(--font); padding: 5px 9px 5px 8px; border-radius: 999px; white-space: nowrap; color: var(--c, var(--muted)); background: color-mix(in oklab, var(--c, var(--muted)) 13%, transparent); }
.pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pill.plain::before { display: none; }
.pill.s-review { --c: var(--review); } .pill.s-planned { --c: var(--planned); } .pill.s-progress { --c: var(--progress); } .pill.s-shipped { --c: var(--shipped); } .pill.s-closed { --c: var(--closed); }
.pill.l-new { --c: var(--new); } .pill.l-improved { --c: var(--improved); } .pill.l-fixed { --c: var(--fixed); }
.pill.team { --c: var(--accent); }
.pill.draft { --c: var(--muted); }
.tag { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: .85rem; font-weight: 550; text-decoration: none; }
a.tag:hover { color: var(--ink); }
.avatar { --size: 28px; width: var(--size); height: var(--size); border-radius: 50%; display: inline-grid; place-items: center; font: 700 calc(var(--size) * .38)/1 var(--font); color: #fff; background: var(--bg-av, var(--accent)); flex: none; letter-spacing: .02em; box-shadow: 0 0 0 2px var(--surface); }
.avatar.lg { --size: 40px; }
.avatar.sm { --size: 22px; }
.avatars { display: flex; }
.avatars .avatar + .avatar { margin-left: -7px; }
.byline { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .9rem; flex-wrap: wrap; }
.byline b { color: var(--ink); font-weight: 650; }

/* The vote button: a rounded column with an arrow above the count. */
.vote { margin: 0; flex: none; }
.vote button, .vote a { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; width: 56px; height: 64px; border-radius: 14px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); font: 760 1.05rem/1.1 var(--font); font-variant-numeric: tabular-nums; transition: transform .15s, border-color .15s, background .15s, color .15s, box-shadow .15s; }
.vote button:hover, .vote a:hover { border-color: var(--accent); color: var(--accent-ink); box-shadow: 0 0 0 4px var(--accent-soft); }
.vote .icon { width: 22px; height: 22px; stroke-width: 2.6; margin-bottom: -2px; transition: transform .2s cubic-bezier(.3,1.6,.5,1); }
.vote.on button { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.vote.on button:hover { box-shadow: 0 0 0 4px var(--accent-soft); color: var(--on-accent); }
.vote.on .icon { transform: translateY(-2px); }
.vote.pop button { animation: pop .35s cubic-bezier(.3,1.6,.5,1); }
@keyframes pop { 40% { transform: scale(1.12); } }
.vote.big button, .vote.big a { width: 100%; height: auto; flex-direction: row; gap: 10px; padding: 14px 18px; font-size: 1.05rem; }
.vote.big .icon { margin: 0; }
.vote.big .what { font-weight: 600; }

/* Board */
.hero { padding: 56px 0 28px; display: flex; gap: 24px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; }
.hero p.lead { font-size: 1.15rem; color: var(--muted); max-width: 38rem; margin: 0; }
.hero h1 { margin-bottom: .25em; }
.board { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; padding-bottom: 80px; align-items: start; }
.board > *, .idea > * { min-width: 0; }
@media (max-width: 920px) { .board { grid-template-columns: 1fr; } .board aside { order: -1; } .board aside .side-extra { display: none; } }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0 0 14px; }
.toolbar .search { position: relative; flex: 1; min-width: 180px; }
.toolbar .search .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--faint); width: 18px; height: 18px; }
.toolbar .search input { padding-left: 38px; }
.toolbar select { width: auto; }
.segmented { display: inline-flex; border: 1px solid var(--line); background: var(--surface-2); border-radius: 12px; padding: 3px; gap: 2px; }
.segmented a { text-decoration: none; padding: 7px 12px; border-radius: 9px; font-weight: 620; font-size: .88rem; color: var(--muted); }
.segmented a:hover { color: var(--ink); }
.segmented a[aria-current] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.posts { display: grid; gap: 10px; }
.post-row { display: flex; gap: 16px; align-items: flex-start; padding: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); transition: border-color .15s, box-shadow .15s, transform .15s; position: relative; }
.post-row:hover { border-color: var(--line-strong); box-shadow: var(--shadow); }
.post-row .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
.post-row h2 { font-size: 1.07rem; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.post-row h2 a { text-decoration: none; }
.post-row h2 a::after { content: ""; position: absolute; inset: 0; border-radius: var(--radius); }
.post-row .vote { position: relative; z-index: 1; }
.post-row p { margin: 0; color: var(--muted); font-size: .94rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.post-row .meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.post-row .meta .tag .icon { width: 15px; height: 15px; }
.post-row .flag { color: var(--accent-ink); display: inline-flex; }
.post-row .flag .icon { width: 16px; height: 16px; }
.post-row.hidden-post { border-style: dashed; }
.side { display: grid; gap: 16px; position: sticky; top: 84px; }
@media (max-width: 920px) { .side { position: static; } }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; }
.card h3 { font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); font-weight: 700; margin: 0 0 12px; }
.cats { list-style: none; margin: 0 -8px; padding: 0; display: grid; gap: 2px; }
.cats a { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; text-decoration: none; font-weight: 580; color: var(--muted); }
.cats a:hover { background: var(--surface-2); color: var(--ink); }
.cats a[aria-current] { background: var(--accent-soft); color: var(--accent-ink); }
.cats .n { font-variant-numeric: tabular-nums; font-size: .85rem; font-weight: 600; }
@media (max-width: 920px) { .cats { display: flex; gap: 6px; overflow-x: auto; margin: 0; padding-bottom: 2px; } .cats a { border: 1px solid var(--line); background: var(--surface); white-space: nowrap; } .cats-card { padding: 0; border: 0; background: none; } .cats-card h3 { display: none; } }
.mini-road { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mini-road a { display: flex; align-items: center; justify-content: space-between; text-decoration: none; font-weight: 580; padding: 4px 0; }
.mini-road a:hover { color: var(--accent-ink); }
.mini-road .n { color: var(--muted); font-variant-numeric: tabular-nums; }
.mini-log { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.mini-log a { text-decoration: none; font-weight: 620; display: block; line-height: 1.35; }
.mini-log a:hover { color: var(--accent-ink); }
.mini-log time { color: var(--muted); font-size: .82rem; }
.cta-card { background: linear-gradient(135deg, color-mix(in oklab, var(--accent) 92%, white), var(--accent)); color: var(--on-accent); border: 0; position: relative; overflow: hidden; }
.cta-card h3 { color: inherit; opacity: .8; }
.cta-card p { margin: 0 0 14px; font-weight: 600; font-size: 1.05rem; line-height: 1.4; }
.cta-card::after { content: ""; position: absolute; right: -40px; bottom: -40px; width: 140px; height: 140px; border-radius: 50%; background: rgb(255 255 255 / .12); }
.cta-card .btn { position: relative; z-index: 1; }

/* Idea page */
.crumbs { color: var(--muted); font-size: .9rem; font-weight: 580; margin: 32px 0 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.crumbs a { text-decoration: none; display: inline-flex; gap: 6px; align-items: center; }
.crumbs a:hover { color: var(--ink); }
.crumbs .icon { width: 16px; height: 16px; }
.idea { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; padding-bottom: 80px; align-items: start; }
@media (max-width: 920px) { .idea { grid-template-columns: 1fr; gap: 16px; } .idea > aside { display: contents; } .idea .side-vote { order: -1; } }
.idea-main { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: clamp(20px, 4vw, 36px); }
.idea-main h1 { font-size: clamp(1.6rem, 3.6vw, 2.25rem); margin: 10px 0 14px; }
.idea-main .prose { margin: 20px 0 8px; }
.prose { max-width: 68ch; overflow-wrap: anywhere; }
.prose > :last-child { margin-bottom: 0; }
.prose a { color: var(--accent-ink); text-decoration-thickness: 2px; text-underline-offset: 3px; }
.prose ul, .prose ol { padding-left: 1.4em; margin: 0 0 1em; }
.prose li { margin: .25em 0; }
.prose blockquote { margin: 1.2em 0; padding: 12px 16px; border-radius: 12px; background: var(--accent-soft); border-left: 4px solid var(--accent); }
.prose blockquote p:last-child { margin: 0; }
.prose code { font: .88em ui-monospace, monospace; background: var(--surface-2); padding: 2px 6px; border-radius: 6px; }
.prose pre { background: var(--surface-2); padding: 14px 16px; border-radius: 12px; overflow: auto; }
.prose pre code { background: none; padding: 0; }
.prose img { border-radius: 12px; border: 1px solid var(--line); }
.prose h1, .prose h2, .prose h3 { margin-top: 1.4em; font-size: 1.15rem; }
.side-vote { display: grid; gap: 14px; }
.side-vote .who { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: .9rem; }
.facts { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; font-size: .92rem; }
.facts dt { color: var(--muted); }
.facts dd { margin: 0; font-weight: 580; text-align: right; }
.shipped-in { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.shipped-in a { text-decoration: none; font-weight: 620; }
.shipped-in a:hover { color: var(--accent-ink); }

/* The thread of activity on an idea: comments hang off one line, status changes sit on it. */
.activity { margin-top: 36px; padding-top: 28px; border-top: 1px solid var(--line); }
.activity h2 { font-size: 1.1rem; margin-bottom: 18px; }
.thread { list-style: none; margin: 0; padding: 0; position: relative; }
.thread::before { content: ""; position: absolute; left: 19px; top: 8px; bottom: 8px; width: 2px; background: var(--line); }
.thread > li { position: relative; padding-left: 56px; margin-bottom: 20px; }
.thread > li > .avatar, .thread > li > .dot { position: absolute; left: 0; top: 0; }
.thread .dot { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 2px solid var(--c, var(--line-strong)); color: var(--c, var(--muted)); }
.thread .dot .icon { width: 18px; height: 18px; }
.thread .dot.s-review { --c: var(--review); } .thread .dot.s-planned { --c: var(--planned); } .thread .dot.s-progress { --c: var(--progress); } .thread .dot.s-shipped { --c: var(--shipped); } .thread .dot.s-closed { --c: var(--closed); }
.thread .bubble { background: var(--surface-2); border-radius: 4px 16px 16px 16px; padding: 12px 16px; }
.thread .team .bubble { background: var(--accent-soft); }
.thread .note .bubble { background: repeating-linear-gradient(-45deg, transparent 0 10px, color-mix(in oklab, var(--progress) 7%, transparent) 10px 20px), color-mix(in oklab, var(--progress) 10%, var(--surface)); border: 1px dashed color-mix(in oklab, var(--progress) 50%, transparent); }
.thread .is-hidden .bubble { opacity: .55; }
.thread .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: .88rem; color: var(--muted); margin-bottom: 4px; }
.thread .head b { color: var(--ink); font-weight: 680; }
.thread .event { padding-top: 9px; font-size: .95rem; }
.thread .event .head { margin: 0; }
.thread .event .says { margin-top: 8px; }
.thread .tools { display: flex; gap: 2px; margin-left: auto; }
.thread .tools form { margin: 0; }
.thread .prose p { margin-bottom: .6em; }
.reply { margin-top: 8px; padding-left: 56px; position: relative; }
.reply > .avatar { position: absolute; left: 0; top: 4px; }
.reply textarea { min-height: 88px; }
.reply .actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }

/* Staff panel */
.staff { border-color: color-mix(in oklab, var(--accent) 35%, var(--line)); }
.staff h3 { display: flex; gap: 6px; align-items: center; color: var(--accent-ink); }
.staff h3 .icon { width: 16px; height: 16px; }
.staff > form { margin: 0 0 16px; display: grid; gap: 8px; }
.staff > form:last-child { margin-bottom: 0; }
.staff .row form { margin: 0; }
.staff hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }
.status-pick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.status-pick label { margin: 0; }
.status-pick input { position: absolute; opacity: 0; pointer-events: none; }
.status-pick span { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); font-weight: 600; font-size: .85rem; cursor: pointer; color: var(--muted); }
.status-pick span::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.status-pick input:checked + span { border-color: var(--c); color: var(--ink); background: color-mix(in oklab, var(--c) 12%, transparent); }
.status-pick input:focus-visible + span { outline: 3px solid var(--accent); outline-offset: 2px; }
.voters { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 420px; overflow: auto; }
.voters li { display: flex; align-items: center; gap: 10px; font-size: .9rem; min-width: 0; }
.voters li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* New idea */
.narrow { max-width: 720px; margin: 0 auto; padding: 40px 0 80px; }
.form-card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: clamp(20px, 4vw, 32px); }
.similar { margin: -6px 0 18px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--bg); }
.similar[hidden] { display: none; }
.similar .head { padding: 10px 14px; font-size: .82rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); border-bottom: 1px solid var(--line); }
.similar a { display: flex; align-items: center; gap: 12px; padding: 10px 14px; text-decoration: none; border-bottom: 1px solid var(--line); }
.similar a:last-child { border-bottom: 0; }
.similar a:hover { background: var(--surface); }
.similar .count { min-width: 42px; text-align: center; font-weight: 750; font-variant-numeric: tabular-nums; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); }
.similar .t { flex: 1; font-weight: 620; }

/* Roadmap */
.road { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; padding-bottom: 80px; align-items: start; }
@media (max-width: 900px) { .road { grid-template-columns: minmax(0, 1fr); } }
.column { background: color-mix(in oklab, var(--surface-2) 70%, transparent); border: 1px solid var(--line); border-radius: 20px; padding: 14px; }
.column > header { display: flex; align-items: center; gap: 10px; padding: 6px 6px 14px; }
.column > header h2 { font-size: 1.05rem; margin: 0; flex: 1; }
.column > header .n { color: var(--muted); font-weight: 650; font-variant-numeric: tabular-nums; }
.column > header::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 4px color-mix(in oklab, var(--c) 18%, transparent); }
.column.s-planned { --c: var(--planned); } .column.s-progress { --c: var(--progress); } .column.s-shipped { --c: var(--shipped); }
.column .cards { display: grid; gap: 10px; }
.road-card { display: flex; gap: 12px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px; text-decoration: none; transition: transform .15s, box-shadow .15s, border-color .15s; border-top: 3px solid var(--c); }
.road-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.road-card .t { font-weight: 680; line-height: 1.35; display: block; }
.road-card .tag { margin-top: 6px; font-size: .8rem; }
.road-card .votes { margin-left: auto; display: flex; flex-direction: column; align-items: center; font-weight: 750; font-variant-numeric: tabular-nums; color: var(--muted); font-size: .9rem; line-height: 1; gap: 2px; }
.road-card .votes .icon { width: 16px; height: 16px; stroke-width: 2.6; }
.column .none { color: var(--muted); text-align: center; padding: 24px 8px; font-size: .92rem; }

/* Changelog */
.log { padding-bottom: 80px; max-width: 900px; }
.entry { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 28px; position: relative; padding-bottom: 40px; }
.entry::before { content: ""; position: absolute; left: 195px; top: 10px; bottom: -10px; width: 2px; background: var(--line); }
.entry:last-child::before { bottom: 40px; }
.entry .when { text-align: right; padding-top: 4px; color: var(--muted); font-weight: 620; font-size: .92rem; position: sticky; top: 84px; align-self: start; }
.entry article { position: relative; padding-left: 28px; }
.entry article::before { content: ""; position: absolute; left: -9px; top: 9px; width: 14px; height: 14px; border-radius: 50%; background: var(--surface); border: 3px solid var(--c, var(--accent)); box-shadow: 0 0 0 5px var(--bg); }
.entry.l-new { --c: var(--new); } .entry.l-improved { --c: var(--improved); } .entry.l-fixed { --c: var(--fixed); }
.entry h2 { margin: 10px 0 10px; font-size: 1.5rem; }
.entry h2 a { text-decoration: none; }
.entry h2 a:hover { color: var(--accent-ink); }
.entry .ships { margin-top: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 6px; display: grid; gap: 2px; }
.entry .ships > span { padding: 8px 10px 4px; font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.entry .ships a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; text-decoration: none; font-weight: 600; }
.entry .ships a:hover { background: var(--surface-2); }
.entry .ships .n { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; display: inline-flex; gap: 4px; align-items: center; font-size: .88rem; }
.entry .ships .n .icon { width: 14px; height: 14px; stroke-width: 2.6; }
.entry .ships .check { color: var(--shipped); display: inline-flex; }
.entry .ships .check .icon { width: 16px; height: 16px; stroke-width: 2.6; }
@media (max-width: 720px) { .entry { grid-template-columns: 1fr; gap: 4px; } .entry::before { left: 1px; } .entry .when { text-align: left; position: static; padding-left: 28px; } }

/* Forms */
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.field label, .label { font-weight: 650; font-size: .9rem; }
.field .hint { color: var(--muted); font-size: .82rem; }
input[type=text], input[type=email], input[type=search], textarea, select { font: inherit; font-size: .95rem; color: var(--ink); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 11px; padding: 10px 12px; width: 100%; transition: border-color .15s, box-shadow .15s; }
input.title-input { font-size: 1.15rem; font-weight: 650; padding: 12px 14px; }
input[type=color] { width: 52px; height: 42px; border: 1px solid var(--line-strong); border-radius: 11px; background: var(--surface); padding: 3px; cursor: pointer; }
textarea { min-height: 140px; resize: vertical; line-height: 1.55; }
input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.check { display: flex; gap: 10px; align-items: center; font-weight: 580; font-size: .92rem; cursor: pointer; }
.check input { accent-color: var(--accent); width: 18px; height: 18px; margin: 0; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
.form-foot { display: flex; justify-content: flex-end; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.inline { display: inline; margin: 0; }
.icon-btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; padding: 0; }
.icon-btn:hover { background: var(--surface); color: var(--ink); border-color: var(--line); }
.icon-btn .icon { width: 16px; height: 16px; }

/* Staff pages */
.page-head { padding: 44px 0 20px; }
.page-head p { color: var(--muted); margin: 0; }
.subnav { display: flex; gap: 4px; margin: 0 0 24px; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
.subnav a { text-decoration: none; padding: 10px 14px; font-weight: 620; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; display: inline-flex; gap: 7px; align-items: center; }
.subnav a:hover { color: var(--ink); }
.subnav a[aria-current] { color: var(--ink); border-color: var(--accent); }
.subnav .icon { width: 17px; height: 17px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
.list { list-style: none; margin: 0; padding: 0; }
.list > li { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.list > li:last-child { border-bottom: 0; }
.list > li .grow { flex: 1; min-width: 160px; }
.list form { margin: 0; display: flex; gap: 8px; align-items: center; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.table th { text-align: left; font-weight: 650; color: var(--muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.table td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.table tr:last-child td { border-bottom: 0; }
.codeblock { font: .84rem/1.55 ui-monospace, monospace; background: var(--surface-2); padding: 14px 16px; border-radius: 12px; overflow-x: auto; white-space: pre; margin: 8px 0 12px; }
.keyfield { font: .9rem ui-monospace, monospace !important; }
code.small { font: .8rem ui-monospace, monospace; color: var(--muted); }
.pick-posts { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 12px; padding: 6px 12px; background: var(--surface); }
.pick-posts label { display: flex; gap: 10px; align-items: center; padding: 6px 0; font-weight: 550; font-size: .92rem; cursor: pointer; }
.pick-posts input { accent-color: var(--accent); }

/* Notices and empty states */
.notice { padding: 12px 16px; border-radius: 12px; background: color-mix(in oklab, var(--shipped) 13%, var(--surface)); margin: 0 0 18px; font-weight: 580; display: flex; gap: 10px; align-items: center; }
.notice .icon { color: var(--shipped); }
.notice.error { background: color-mix(in oklab, var(--closed) 12%, var(--surface)); }
.notice.error .icon { color: var(--closed); }
.empty { text-align: center; padding: 56px 24px; border: 2px dashed var(--line); border-radius: 20px; color: var(--muted); }
.empty .icon { width: 36px; height: 36px; color: var(--faint); margin-bottom: 8px; }
.empty h2 { color: var(--ink); font-size: 1.2rem; }
.message { max-width: 520px; margin: 0 auto; padding: 96px 0; text-align: center; }

footer.site { border-top: 1px solid var(--line); padding: 28px 0 40px; color: var(--muted); font-size: .85rem; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
