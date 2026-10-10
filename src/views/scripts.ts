// The little JavaScript the board uses. Every page works without it: votes and filters are
// plain forms, and this makes them feel instant.
export const js = String.raw`
(() => {
  // post sends a form to the app. On a route under routes.challenge the edge answers 403
  // CHALLENGE_REQUIRED with a proof-of-work puzzle; post solves it (find n where
  // sha256(salt + n) is the challenge) and sends again with the answer in X-Altcha.
  const sha = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const solve = async (c) => {
    for (let n = 0; n <= c.maxnumber; n++) {
      if ((await sha(c.salt + n)) === c.challenge) return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    }
    throw new Error("unsolved");
  };
  const post = async (url, body, headers = {}) => {
    const send = (extra) => fetch(url, { method: "POST", body, headers: { ...headers, ...extra }, credentials: "same-origin" });
    const res = await send({});
    if (res.status !== 403) return res;
    const out = await res.clone().json().catch(() => null);
    const challenge = out && out.error && out.error.code === "CHALLENGE_REQUIRED" && out.error.details && out.error.details.challenge;
    return challenge ? send({ "x-altcha": await solve(challenge) }) : res;
  };

  // On the demo every change is a challenged public route, so forms go through post and the
  // browser then shows what the app answered.
  if (document.documentElement.hasAttribute("data-demo")) {
    document.addEventListener("submit", async (e) => {
      const form = e.target;
      if (e.defaultPrevented || form.method.toLowerCase() !== "post" || form.hasAttribute("data-vote")) return;
      e.preventDefault();
      const res = await post(e.submitter && e.submitter.hasAttribute("formaction") ? e.submitter.formAction : form.action, new URLSearchParams(new FormData(form, e.submitter)));
      // A redirect goes where it points; a page answered in place (an error, or a new API key
      // shown once) replaces this one.
      if (res.redirected) { location.assign(res.url); return; }
      const page = new DOMParser().parseFromString(await res.text(), "text/html");
      document.replaceChild(document.importNode(page.documentElement, true), document.documentElement);
    });
  }

  // Ask before anything that removes work. Capturing, so it runs before the other handlers.
  document.addEventListener("submit", (e) => {
    const msg = e.target.getAttribute("data-confirm") || (e.submitter && e.submitter.getAttribute("data-confirm-click"));
    if (msg && !confirm(msg)) e.preventDefault();
  }, true);

  // Filters apply as you choose them.
  document.querySelectorAll("[data-autosubmit]").forEach((el) => {
    let t;
    const go = () => el.form.requestSubmit();
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => { clearTimeout(t); t = setTimeout(go, el.tagName === "SELECT" ? 0 : 450); });
  });

  // Votes toggle in place; the server answers the new count.
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!form.hasAttribute("data-vote") || e.defaultPrevented) return;
    e.preventDefault();
    const button = form.querySelector("button");
    const count = form.querySelector(".n");
    const what = form.querySelector(".what");
    const was = form.classList.contains("on");
    const n = Number(count.textContent);
    const show = (on, total) => {
      form.classList.toggle("on", on);
      count.textContent = String(total);
      if (what) what.textContent = on ? "Voted" : "Vote";
      button.setAttribute("aria-pressed", String(on));
    };
    show(!was, n + (was ? -1 : 1));
    form.classList.remove("pop"); void form.offsetWidth; if (!was) form.classList.add("pop");
    try {
      const res = await post(form.action, new URLSearchParams(new FormData(form)), { accept: "application/json" });
      if (!res.ok) throw new Error(String(res.status));
      const out = await res.json();
      show(out.voted, out.votes);
    } catch {
      show(was, n);
      form.removeAttribute("data-vote");
      form.submit();
    }
  });

  // While someone types a new idea's title, show ideas that look the same, so they can vote
  // there instead.
  const title = document.querySelector("[data-similar]");
  const box = document.getElementById("similar");
  if (title && box) {
    const list = box.querySelector(".list-similar");
    let t, last = "";
    const look = async () => {
      const q = title.value.trim();
      if (q === last) return;
      last = q;
      if (q.length < 4) { box.hidden = true; return; }
      const res = await fetch("/similar?q=" + encodeURIComponent(q), { headers: { accept: "application/json" } }).catch(() => null);
      if (!res || !res.ok || q !== last) return;
      const found = await res.json();
      list.replaceChildren(...found.map((p) => {
        const a = document.createElement("a");
        a.href = "/p/" + p.id;
        a.target = "_blank";
        const n = document.createElement("span"); n.className = "count"; n.textContent = String(p.votes);
        const t = document.createElement("span"); t.className = "t"; t.textContent = p.title;
        const s = document.createElement("span"); s.className = "pill s-" + p.status; s.textContent = p.status_label;
        a.append(n, t, s);
        return a;
      }));
      box.hidden = found.length === 0;
    };
    title.addEventListener("input", () => { clearTimeout(t); t = setTimeout(look, 300); });
    look();
  }
})();
`;
