import { createHash } from "node:crypto";
import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { demoOn } from "../demo.js";
import { canModerate, displayName, isColor, signedIn, type Viewer } from "../model.js";
import type { Settings } from "../store.js";
import { icon } from "./icons.js";
import { avatar } from "./parts.js";
import { js } from "./scripts.js";
import { css } from "./styles.js";

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;
export type Section = "ideas" | "roadmap" | "changelog" | "manage" | "me";

// A hash of the stylesheet and script, so browsers fetch them again whenever they change.
export const ASSET_VERSION = createHash("sha256").update(css).update(js).digest("hex").slice(0, 10);

type Page = { s: Settings; v: Viewer; title: string; section?: Section; body: Html; here?: string };

const current = (on: boolean) => (on ? raw(' aria-current="page"') : "");

const demoBar = (v: Viewer, here: string) =>
  !demoOn()
    ? ""
    : html`<div class="demo-bar"><div class="wrap">
  ${v.userId.startsWith("demo-")
    ? html`<span><b>You're looking around as staff.</b> Sample data, reset every night. No emails are sent.</span>
      <form method="post" action="/demo/leave"><button class="btn small light">Leave</button></form>`
    : html`<span><b>Demo board.</b> Sample data, reset every night.</span>
      <form method="post" action="/demo/start?return=${encodeURIComponent(here)}"><button class="btn small light">Look around ${icon.right}</button></form>`}
</div></div>`;

export const layout = ({ s, v, title, section, body, here = "/" }: Page) => {
  const accent = isColor(s.accent) ? s.accent : "#5b5bd6";
  return html`<!doctype html>
<html lang="en"${demoOn() ? raw(" data-demo") : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title === s.board_name ? title : `${title} · ${s.board_name}`}</title>
<link rel="preload" href="/fonts/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
<style>:root { --accent: ${raw(accent)}; }</style>
<meta name="theme-color" content="${raw(accent)}">
<link rel="icon" href="data:image/svg+xml,${raw(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="${accent}"/></svg>`))}">
<script src="/assets/app.js?v=${ASSET_VERSION}" defer></script>
</head>
<body>
${demoBar(v, here)}
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><span class="brand-dot"></span>${s.board_name}</a>
    <nav class="nav" aria-label="Main">
      <a href="/"${current(section === "ideas")}>${icon.bulb}<span class="label">Ideas</span></a>
      <a href="/roadmap"${current(section === "roadmap")}>${icon.map}<span class="label">Roadmap</span></a>
      <a href="/changelog"${current(section === "changelog")}>${icon.spark}<span class="label">Changelog</span></a>
      ${canModerate(v) ? html`<a href="/manage"${current(section === "manage")}>${icon.settings}<span class="label">Manage</span></a>` : ""}
      ${signedIn(v)
        ? html`<a class="me" href="/me" title="${displayName(v)}"${current(section === "me")}>${avatar(v.userId, displayName(v))}<span class="sr">Your ideas</span></a>`
        : html`<a href="/.whisk/login?return=${encodeURIComponent(here)}">${icon.user}<span class="label">Sign in</span></a>`}
    </nav>
  </div>
</header>
<main>${body}</main>
<footer class="site"><div class="wrap spread"><span>${s.board_name}</span><span>Runs on <a href="https://whisk.run">Whisk</a></span></div></footer>
</body>
</html>`;
};
