// Pure decisions about the board: statuses, who may do what, ordering, similar ideas, who hears
// about a change. No database and no requests: routes load rows, call these, then render or
// store what comes back. Everything here is table-tested in test/model.test.ts.

export const STATUSES = ["review", "planned", "progress", "shipped", "closed"] as const;
export type Status = (typeof STATUSES)[number];

export const statusLabel: Readonly<Record<Status, string>> = {
  review: "Under review",
  planned: "Planned",
  progress: "In progress",
  shipped: "Shipped",
  closed: "Closed",
};

export const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v);

// The roadmap shows the statuses that are promises, in the order work moves through them.
export const ROADMAP: readonly Status[] = ["planned", "progress", "shipped"];

export const LABELS = ["new", "improved", "fixed"] as const;
export type Label = (typeof LABELS)[number];
export const labelText: Readonly<Record<Label, string>> = { new: "New", improved: "Improved", fixed: "Fixed" };
export const isLabel = (v: unknown): v is Label => typeof v === "string" && (LABELS as readonly string[]).includes(v);

export type Category = { readonly id: number; readonly slug: string; readonly name: string; readonly position: number };

export type Post = {
  readonly id: number;
  readonly category_id: number | null;
  readonly title: string;
  readonly body: string;
  readonly status: Status;
  readonly author_id: string;
  readonly author_name: string;
  readonly pinned: boolean;
  readonly hidden: boolean;
  readonly merged_into: number | null;
  readonly vote_count: number;
  readonly comment_count: number;
  readonly created_at: Date;
  readonly status_at: Date;
};

export type CommentKind = "comment" | "note" | "status" | "merged";
export type Comment = {
  readonly id: number;
  readonly post_id: number;
  readonly author_id: string;
  readonly author_name: string;
  readonly team: boolean;
  readonly kind: CommentKind;
  readonly status: Status | null;
  readonly body: string;
  readonly hidden: boolean;
  readonly created_at: Date;
};

export type Entry = {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly body: string;
  readonly label: Label;
  readonly published_at: Date | null;
  readonly created_at: Date;
};

// ----- Who is asking -----

// A viewer is everything the board needs to know about the person on the other end: from the
// platform's X-Whisk-* headers, or a demo guest (demo.ts).
export type Viewer = {
  readonly kind: "anonymous" | "customer" | "team";
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  // Owners, admins and the "feedback-admins" group change settings and categories.
  readonly admin: boolean;
};

export const anonymous: Viewer = { kind: "anonymous", userId: "", email: "", name: "", admin: false };

export const signedIn = (v: Viewer) => v.kind !== "anonymous" && v.userId !== "";
export const isTeam = (v: Viewer) => v.kind === "team" && v.userId !== "";
export const displayName = (v: Pick<Viewer, "name" | "email">) => v.name.trim() || v.email.split("@")[0] || "Someone";

// ----- What each person may do -----

// Anyone sees an idea unless it is hidden (waiting for approval, or taken down); staff see all.
export const canSeePost = (v: Viewer, p: Pick<Post, "hidden" | "author_id">) => !p.hidden || isTeam(v) || (signedIn(v) && p.author_id === v.userId);
export const canPost = signedIn;
export const canVote = signedIn;
export const canComment = signedIn;
// The author may tidy their own wording until the team has picked it up; staff always may.
export const canEditPost = (v: Viewer, p: Pick<Post, "author_id" | "status">) => isTeam(v) || (signedIn(v) && p.author_id === v.userId && p.status === "review");
export const canModerate = isTeam;
export const canAdmin = (v: Viewer) => isTeam(v) && v.admin;
// Staff notes and hidden comments are for staff; everyone else sees the conversation.
export const canSeeComment = (v: Viewer, c: Pick<Comment, "kind" | "hidden">) => isTeam(v) || (c.kind !== "note" && !c.hidden);
export const canDeleteComment = (v: Viewer, c: Pick<Comment, "author_id" | "kind">) => isTeam(v) || (signedIn(v) && c.author_id === v.userId && c.kind === "comment");

// ----- Ordering -----

export const SORTS = ["trending", "top", "new"] as const;
export type Sort = (typeof SORTS)[number];
export const sortLabel: Readonly<Record<Sort, string>> = { trending: "Trending", top: "Top", new: "New" };
export const isSort = (v: unknown): v is Sort => typeof v === "string" && (SORTS as readonly string[]).includes(v);

// trendingScore favours ideas collecting votes and comments now over ideas that collected them
// long ago, the way Hacker News ranks its front page, but measured in days rather than hours.
export const trendingScore = (p: Pick<Post, "vote_count" | "comment_count" | "created_at">, now: Date) => {
  const days = Math.max(0, (now.getTime() - p.created_at.getTime()) / 86_400_000);
  return (p.vote_count + p.comment_count / 2 + 1) / Math.pow(days + 2, 1.2);
};

const compare: Readonly<Record<Sort, (now: Date) => (a: Post, b: Post) => number>> = {
  trending: (now) => (a, b) => trendingScore(b, now) - trendingScore(a, now) || b.id - a.id,
  top: () => (a, b) => b.vote_count - a.vote_count || b.id - a.id,
  new: () => (a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id - a.id,
};

// sortPosts puts pinned ideas first, then orders the rest. It returns a new array.
export const sortPosts = (posts: readonly Post[], sort: Sort, now: Date): Post[] => {
  const by = compare[sort](now);
  return [...posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by(a, b));
};

export type Filter = { readonly category?: number; readonly status?: Status | "open"; readonly q?: string };

// "open" is everything still being decided or worked on: not shipped, not closed.
const statusMatches = (p: Post, s: Filter["status"]) => !s || (s === "open" ? p.status !== "shipped" && p.status !== "closed" : p.status === s);

export const filterPosts = (posts: readonly Post[], f: Filter): Post[] => {
  const words = tokens(f.q ?? "");
  return posts.filter(
    (p) =>
      p.merged_into === null &&
      (f.category === undefined || p.category_id === f.category) &&
      statusMatches(p, f.status) &&
      (words.length === 0 || words.every((w) => tokens(`${p.title} ${p.body}`).some((t) => t.startsWith(w)))),
  );
};

// roadmap groups ideas into the roadmap's columns, most wanted first. Shipped keeps only what
// shipped recently, so the column stays short.
export const roadmap = (posts: readonly Post[], now: Date, shippedDays = 60) =>
  ROADMAP.map((status) => ({
    status,
    posts: posts
      .filter((p) => p.status === status && p.merged_into === null && !p.hidden)
      .filter((p) => status !== "shipped" || now.getTime() - p.status_at.getTime() < shippedDays * 86_400_000)
      .sort((a, b) => (status === "shipped" ? b.status_at.getTime() - a.status_at.getTime() : b.vote_count - a.vote_count || a.id - b.id)),
  }));

export const statusCounts = (posts: readonly Post[]): Readonly<Record<Status, number>> =>
  posts
    .filter((p) => p.merged_into === null && !p.hidden)
    .reduce((acc, p) => ({ ...acc, [p.status]: acc[p.status] + 1 }), { review: 0, planned: 0, progress: 0, shipped: 0, closed: 0 } as Record<Status, number>);

// ----- Similar ideas -----

const STOP = new Set(
  "a an and are as at be but by can could do for from get have i if in into is it its let me my need of on or please should so some that the their them there this to us use we when which will with would you your able add allow".split(" "),
);

// tokens lowercases, drops punctuation and filler words, and trims plural endings, so "Dark
// mode for reports" and "report dark-mode" share their words.
export const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

const sameWord = (w: string, v: string) => w === v || (v.length > 3 && w.length > 3 && (v.startsWith(w) || w.startsWith(v)));

// weights says how telling each word is on this board: a word in every title ("invoice" on an
// invoicing app's board) says little, a rare one ("dark") says a lot.
export const weights = (titles: readonly string[]) => {
  const docs = titles.map((t) => new Set(tokens(t)));
  return (w: string) => Math.log((docs.length + 1) / (docs.filter((d) => [...d].some((v) => sameWord(w, v))).length + 0.5));
};

// similarity is the weight two titles share over the weight of the lighter title (0 to 1), so a
// short existing title found inside a longer new one counts as a match.
export const similarity = (typed: string, other: string, weight: (w: string) => number = () => 1) => {
  const x = [...new Set(tokens(typed))];
  const y = [...new Set(tokens(other))];
  const sum = (ws: readonly string[]) => ws.reduce((acc, w) => acc + Math.max(0, weight(w)), 0);
  const lighter = Math.min(sum(x), sum(y));
  return lighter <= 0 ? 0 : Math.min(1, sum(x.filter((w) => y.some((v) => sameWord(w, v)))) / lighter);
};

// similarPosts answers the ideas a new title most likely repeats, best first.
export const similarPosts = (title: string, posts: readonly Post[], limit = 4, threshold = 0.3): Post[] => {
  const open = posts.filter((p) => p.merged_into === null && !p.hidden);
  const weight = weights(open.map((p) => p.title));
  return tokens(title).length === 0
    ? []
    : open
        .map((p) => ({ p, score: similarity(title, p.title, weight) }))
        .filter((s) => s.score >= threshold)
        .sort((a, b) => b.score - a.score || b.p.vote_count - a.p.vote_count)
        .slice(0, limit)
        .map((s) => s.p);
};

// ----- Who hears about a change -----

export type Person = { readonly user_id: string; readonly email: string; readonly name: string; readonly email_updates: boolean };

// followers are the people who care about an idea: its author, everyone who voted, and everyone
// who commented. The person making the change never emails themselves, and nobody hears twice.
export const recipients = (people: readonly Person[], followerIds: readonly string[], actorId: string): Person[] => {
  const wanted = new Set(followerIds.filter((id) => id !== actorId));
  return people.filter((p) => wanted.has(p.user_id) && p.email_updates && validEmail(p.email)).filter((p, i, all) => all.findIndex((q) => q.email.toLowerCase() === p.email.toLowerCase()) === i);
};

// ----- Merging duplicates -----

// mergeVotes answers the votes the surviving idea gains: everyone who voted for the duplicate and
// not already for the survivor, plus the duplicate's author, who wanted it too.
export const mergeVotes = (from: { readonly author_id: string; readonly voters: readonly string[] }, intoVoters: readonly string[]): string[] => {
  const have = new Set(intoVoters);
  return [...new Set([from.author_id, ...from.voters])].filter((id) => id !== "" && !have.has(id));
};

// ----- Small helpers -----

export const validEmail = (s: string) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) && s.length <= 254;
export const isColor = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);
export const placeholderId = (email: string) => `email:${email.trim().toLowerCase()}`;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";

// uniqueSlug adds -2, -3… until the slug is free.
export const uniqueSlug = (base: string, taken: readonly string[]) => {
  const used = new Set(taken);
  const root = slugify(base);
  return used.has(root) ? `${root}-${Array.from({ length: used.size + 1 }, (_, i) => i + 2).find((n) => !used.has(`${root}-${n}`))}` : root;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

// A steady color per person, from a small set that reads well on light and dark.
const AVATAR = ["#e85d2a", "#2f8a57", "#5b5bd6", "#c2417a", "#0e8a9a", "#b7791f", "#7a5af8", "#d14343"];
export const avatarColor = (id: string) => AVATAR[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR.length]!;

export const ago = (then: Date, now: Date) => {
  const s = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  const units: readonly [number, string][] = [
    [31_536_000, "year"],
    [2_592_000, "month"],
    [604_800, "week"],
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  const hit = units.find(([n]) => s >= n);
  if (!hit) return "just now";
  const n = Math.floor(s / hit[0]);
  return `${n} ${hit[1]}${n === 1 ? "" : "s"} ago`;
};

export const longDate = (d: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(d);
  }
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

// excerpt is the first lines of an idea's Markdown as plain text, for the list.
export const excerpt = (body: string, n = 160) =>
  clip(
    body
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    n,
  );
