// The emails the board sends, as pure functions from what happened to a message. Plain, short,
// one button, and a link to stop them.
import { escape } from "./markdown.js";
import { labelText, statusLabel, type Entry, type Person, type Post, type Status } from "./model.js";
import type { Settings } from "./store.js";

export type Mail = { readonly to: string; readonly subject: string; readonly html: string; readonly text: string };

type Frame = { s: Settings; base: string; heading: string; lines: readonly string[]; button: { href: string; label: string } };

const frame = ({ s, base, heading, lines, button }: Frame) => {
  const accent = /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "#5b5bd6";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1d1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e6e3dc">
<tr><td style="padding:28px 32px 8px"><span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:${accent};vertical-align:middle"></span>
<span style="font-weight:700;font-size:15px;vertical-align:middle;margin-left:8px">${escape(s.board_name)}</span></td></tr>
<tr><td style="padding:12px 32px 4px"><h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${escape(heading)}</h1>
${lines.map((l) => `<p style="font-size:16px;line-height:1.55;margin:0 0 12px;color:#4a4640">${escape(l)}</p>`).join("")}</td></tr>
<tr><td style="padding:8px 32px 28px"><a href="${escape(base + button.href)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(button.label)}</a></td></tr>
</table>
<p style="font-size:12px;color:#8a857c;margin:16px 0 0">You follow this because you posted, voted or commented. <a href="${escape(base)}/me" style="color:#8a857c">Email settings</a></p>
</td></tr></table></body></html>`;
  const text = [heading, "", ...lines, "", `${button.label}: ${base}${button.href}`, "", `Email settings: ${base}/me`].join("\n");
  return { html, text };
};

export const postPath = (p: Pick<Post, "id">) => `/p/${p.id}`;

export const statusEmail = (s: Settings, base: string, to: Person, post: Post, status: Status, note: string): Mail => ({
  to: to.email,
  subject: `${statusLabel[status]}: ${post.title}`,
  ...frame({
    s,
    base,
    heading: `"${post.title}" is now ${statusLabel[status].toLowerCase()}`,
    lines: [
      status === "shipped" ? "It's live. Thank you for asking for it." : status === "closed" ? "We've closed this idea." : `The team has moved this idea to ${statusLabel[status]}.`,
      ...(note ? [note] : []),
    ],
    button: { href: postPath(post), label: "See the idea" },
  }),
});

export const replyEmail = (s: Settings, base: string, to: Person, post: Post, from: { name: string; team: boolean }, body: string): Mail => ({
  to: to.email,
  subject: `${from.team ? `${s.board_name} team` : from.name} replied: ${post.title}`,
  ...frame({
    s,
    base,
    heading: `New reply on "${post.title}"`,
    lines: [`${from.name}${from.team ? " (team)" : ""} wrote:`, body.length > 600 ? `${body.slice(0, 599)}…` : body],
    button: { href: `${postPath(post)}#comments`, label: "Read and reply" },
  }),
});

export const shippedEmail = (s: Settings, base: string, to: Person, entry: Entry, posts: readonly Post[]): Mail => ({
  to: to.email,
  subject: `${labelText[entry.label]}: ${entry.title}`,
  ...frame({
    s,
    base,
    heading: entry.title,
    lines: [`This ships what you asked for: ${posts.map((p) => `"${p.title}"`).join(", ")}.`],
    button: { href: `/changelog/${entry.slug}`, label: "Read what's new" },
  }),
});
