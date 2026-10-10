// What a new board starts with: three categories and a lived-in board for a made-up invoicing
// product, with ideas at every status, votes, comments, staff replies and a changelog. The demo
// and a new copy start the same. Every sample row is flagged, so Manage, Settings can remove them
// all at once. Times are relative to now, so the board always looks current.
import { asSystem, type Tx } from "./db.js";
import type { Label, Status } from "./model.js";

const CATEGORIES = [
  { slug: "features", name: "Feature requests" },
  { slug: "integrations", name: "Integrations" },
  { slug: "bugs", name: "Bugs" },
] as const;

type SampleComment = { by: number | "team"; days: number; body: string; status?: Status };
type SampleIdea = {
  cat: (typeof CATEGORIES)[number]["slug"];
  title: string;
  body: string;
  status: Status;
  by: number;
  days: number;
  votes: number;
  pinned?: boolean;
  comments?: readonly SampleComment[];
};

const NAMES = [
  "Amanda Hayes", "Ben Carter", "Chloe Wilson", "Dev Patel", "Emma Thompson", "Finn O'Brien", "Grace Liu", "Henry Walker",
  "Isla Martin", "Jack Robinson", "Kayla Foster", "Liam Nguyen", "Mia Fraser", "Noah Kim", "Olivia Brown", "Priya Shah",
  "Quinn Taylor", "Ruby Clarke", "Sam Hughes", "Tyler Brooks", "Uma Singh", "Victor Chen", "William Harris", "Xavier Ross",
  "Yasmin Ali", "Zoe Mitchell", "Arlo Evans", "Bella Scott", "Caleb Young", "Daisy King",
];

const IDEAS: readonly SampleIdea[] = [
  {
    cat: "features", title: "Recurring invoices", status: "progress", by: 0, days: 41, votes: 27, pinned: true,
    body: "Most of our customers pay the same amount every month. I'd love to set an invoice to repeat monthly or quarterly and have it go out on its own.\n\nBonus points if it can **charge the saved card** automatically.",
    comments: [
      { by: 4, days: 39, body: "Yes please. I copy the same 14 invoices every month." },
      { by: "team", days: 30, body: "Thanks all, this is our most-wanted idea by a mile. We're designing it now.", status: "planned" },
      { by: 9, days: 22, body: "Will it handle a different amount for the first month? We prorate new clients." },
      { by: "team", days: 12, body: "Building it now. First version does monthly, quarterly and yearly, with an optional different first amount.", status: "progress" },
    ],
  },
  {
    cat: "features", title: "Dark mode", status: "planned", by: 3, days: 26, votes: 21,
    body: "I do my books at night and the white screen is blinding. A dark theme that follows my system setting would be perfect.",
    comments: [
      { by: 12, days: 25, body: "Following the system setting is the key bit for me." },
      { by: "team", days: 9, body: "On the list for next month.", status: "planned" },
    ],
  },
  {
    cat: "integrations", title: "Import from QuickBooks", status: "planned", by: 7, days: 33, votes: 18,
    body: "We're moving over from QuickBooks. Importing contacts, items and open invoices would save us days of retyping.",
    comments: [{ by: "team", days: 14, body: "Planned. Contacts and items first, open invoices straight after.", status: "planned" }],
  },
  {
    cat: "features", title: "Send payment reminders automatically", status: "review", by: 15, days: 6, votes: 14,
    body: "When an invoice is 7 days overdue, send a polite reminder. Again at 14 days. Let me edit the wording.",
    comments: [
      { by: 2, days: 5, body: "This would get us paid a week faster, easily." },
      { by: 18, days: 3, body: "Please let us turn it off for some customers. A couple of ours would not appreciate it." },
    ],
  },
  {
    cat: "features", title: "Scan receipts with my phone", status: "review", by: 20, days: 4, votes: 11,
    body: "Take a photo of a receipt and have the amount, date and supplier filled in for me.",
  },
  {
    cat: "features", title: "Show amounts in more than one currency", status: "review", by: 11, days: 12, votes: 9,
    body: "We bill a few Canadian customers. An invoice in CAD with the USD amount shown for our records would cover it.",
    comments: [{ by: 23, days: 10, body: "Same for EUR here." }],
  },
  {
    cat: "integrations", title: "Stripe payouts matched to invoices", status: "shipped", by: 5, days: 70, votes: 24,
    body: "Each Stripe payout covers several invoices. Matching them by hand every week takes ages.",
    comments: [
      { by: "team", days: 55, body: "Working on it.", status: "progress" },
      { by: "team", days: 18, body: "Live for everyone. Payouts now match to invoices on their own.", status: "shipped" },
      { by: 5, days: 17, body: "This is great, it saves me an hour a week. Thank you!" },
    ],
  },
  {
    cat: "features", title: "Custom invoice templates", status: "shipped", by: 8, days: 88, votes: 19,
    body: "Let us add our logo, choose a color and change the footer text on invoices.",
    comments: [{ by: "team", days: 35, body: "Shipped! Find it under Settings, Invoice look.", status: "shipped" }],
  },
  {
    cat: "bugs", title: "PDF cuts off long item descriptions", status: "shipped", by: 14, days: 21, votes: 6,
    body: "If an item description is longer than two lines the PDF chops off the rest.",
    comments: [{ by: "team", days: 18, body: "Fixed. Descriptions now wrap onto as many lines as they need.", status: "shipped" }],
  },
  {
    cat: "integrations", title: "Google Sheets export", status: "review", by: 25, days: 2, votes: 4,
    body: "A live link to a sheet with every invoice, so our accountant can build her own reports.",
  },
  {
    cat: "bugs", title: "Search doesn't find customers by phone number", status: "progress", by: 17, days: 8, votes: 5,
    body: "Typing a phone number into search finds nothing, even though it's on the customer.",
    comments: [{ by: "team", days: 2, body: "Reproduced, fixing it now.", status: "progress" }],
  },
  {
    cat: "features", title: "Let my bookkeeper sign in with her own login", status: "planned", by: 1, days: 47, votes: 16,
    body: "Right now I share my password with my bookkeeper. She should have her own login that can't see the bank feeds.",
    comments: [{ by: "team", days: 20, body: "Planned, along with roles for read-only and full access.", status: "planned" }],
  },
  {
    cat: "integrations", title: "Shopify orders become invoices", status: "review", by: 22, days: 15, votes: 8,
    body: "For wholesale customers who order through our Shopify store on account.",
  },
  {
    cat: "features", title: "Print checks", status: "closed", by: 28, days: 60, votes: 2,
    body: "Some suppliers still want a paper check.",
    comments: [{ by: "team", days: 50, body: "Thanks for asking. With nearly all of our customers paying online now, we won't be adding this.", status: "closed" }],
  },
];

const ENTRIES: readonly { title: string; label: Label; days: number; body: string; ships: readonly string[] }[] = [
  {
    title: "Stripe payouts match themselves",
    label: "new",
    days: 18,
    ships: ["Stripe payouts matched to invoices"],
    body: "Every Stripe payout is now split across the invoices it pays, and those invoices are marked paid. Fees go to their own expense line.\n\nTurn it on under **Settings, Payments, Stripe**.",
  },
  {
    title: "Long descriptions fit on the PDF",
    label: "fixed",
    days: 16,
    ships: ["PDF cuts off long item descriptions"],
    body: "Item descriptions now wrap onto as many lines as they need, on screen and on the PDF.",
  },
  {
    title: "Your invoices, your look",
    label: "improved",
    days: 35,
    ships: ["Custom invoice templates"],
    body: "Add your logo, pick your color and write your own footer. Every invoice and quote picks it up.\n\n> Find it under **Settings, Invoice look**.",
  },
];

const ago = (days: number) => new Date(Date.now() - days * 86_400_000 - Math.round(days * 3_100_000));

const addCategories = (tx: Tx) =>
  tx`insert into categories (slug, name, position) select * from unnest(${tx.array(CATEGORIES.map((c) => c.slug))}::text[], ${tx.array(CATEGORIES.map((c) => c.name))}::text[], ${tx.array(CATEGORIES.map((_, i) => i))}::int[])`;

const sample = async (tx: Tx) => {
  await tx`update settings set board_name = 'Acme feedback', tagline = 'Tell us what would make Acme better. Vote for the ideas you want most.', has_sample = true where id = 1`;
  const sampleId = (i: number) => `sample-${String(i).padStart(3, "0")}`;
  const team = { id: "sample-team", name: "Alex from Acme" };
  await tx`insert into people (user_id, email, name, email_updates, sample)
    select *, true from unnest(${tx.array(NAMES.map((_, i) => sampleId(i)))}::text[], ${tx.array(NAMES.map((n) => `${n.split(" ")[0]!.toLowerCase()}@example.com`))}::text[], ${tx.array([...NAMES])}::text[], ${tx.array(NAMES.map(() => false))}::bool[])`;
  const cats = new Map((await tx<{ id: number; slug: string }[]>`select id, slug from categories`).map((c) => [c.slug, c.id]));
  const ids = new Map<string, number>();
  for (const idea of IDEAS) {
    const statusDays = idea.comments?.filter((c) => c.status).at(-1)?.days ?? idea.days;
    const [row] = await tx<{ id: number }[]>`insert into posts (category_id, title, body, status, author_id, author_name, pinned, created_at, status_at, sample)
      values (${cats.get(idea.cat) ?? null}, ${idea.title}, ${idea.body}, ${idea.status}, ${sampleId(idea.by)}, ${NAMES[idea.by]!}, ${idea.pinned ?? false}, ${ago(idea.days)}, ${ago(statusDays)}, true) returning id`;
    ids.set(idea.title, row!.id);
    const voters = [idea.by, ...Array.from({ length: NAMES.length }, (_, i) => (idea.by + 3 + i * 7) % NAMES.length)].filter((v, i, all) => all.indexOf(v) === i).slice(0, Math.min(idea.votes, NAMES.length));
    const extra = Math.max(0, idea.votes - voters.length);
    const voterIds = [...voters.map(sampleId), ...Array.from({ length: extra }, (_, i) => `sample-extra-${row!.id}-${i}`)];
    await tx`insert into votes (post_id, user_id, created_at) select ${row!.id}, unnest(${tx.array(voterIds)}::text[]), ${ago(idea.days / 2)}`;
    for (const c of idea.comments ?? []) {
      const byTeam = c.by === "team";
      if (c.status)
        await tx`insert into comments (post_id, author_id, author_name, team, kind, status, body, created_at) values (${row!.id}, ${team.id}, ${team.name}, true, 'status', ${c.status}, ${c.body}, ${ago(c.days)})`;
      else
        await tx`insert into comments (post_id, author_id, author_name, team, kind, body, created_at)
          values (${row!.id}, ${byTeam ? team.id : sampleId(c.by as number)}, ${byTeam ? team.name : NAMES[c.by as number]!}, ${byTeam}, 'comment', ${c.body}, ${ago(c.days)})`;
    }
  }
  await tx`insert into comments (post_id, author_id, author_name, team, kind, body, created_at)
    values (${ids.get("Dark mode")!}, ${team.id}, ${team.name}, true, 'note', 'Three enterprise trials asked for this on calls last week.', ${ago(8)})`;
  await tx`update posts p set vote_count = (select count(*) from votes v where v.post_id = p.id),
    comment_count = (select count(*) from comments c where c.post_id = p.id and c.kind = 'comment' and not c.hidden)`;
  for (const e of ENTRIES) {
    const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [row] = await tx<{ id: number }[]>`insert into entries (slug, title, body, label, published_at, created_at, sample) values (${slug}, ${e.title}, ${e.body}, ${e.label}, ${ago(e.days)}, ${ago(e.days)}, true) returning id`;
    for (const t of e.ships) await tx`insert into entry_posts (entry_id, post_id) values (${row!.id}, ${ids.get(t)!})`;
  }
  await tx`insert into entries (slug, title, body, label, sample) values ('recurring-invoices', 'Recurring invoices', 'Set any invoice to repeat monthly, quarterly or yearly.', 'new', true)`;
};

// seed fills an empty board.
export const seed = (opts: { sample: boolean } = { sample: true }) =>
  asSystem(async (tx) => {
    // doctor: allow W098 counts every row to see whether the board is empty, as the system
    const [row] = await tx<{ n: number }[]>`select (select count(*) from categories) + (select count(*) from posts) as n`;
    if (Number(row?.n) > 0) return false;
    await addCategories(tx);
    if (opts.sample) await sample(tx);
    return true;
  });
