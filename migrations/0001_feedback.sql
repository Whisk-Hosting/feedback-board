-- The feedback board: categories, ideas, votes, comments, the changelog, the people who take
-- part, and the emails sent to them. Ideas, comments and the changelog are public on the board,
-- so their tables carry no owner policy; people and votes hold each person's own details and
-- are kept to their owner by row-level security.

-- doctor: allow W095 one row of board settings, owned by the business, not by a customer
create table settings (
  id int primary key default 1 check (id = 1),
  board_name text not null default 'Feedback',
  tagline text not null default 'Tell us what would make the product better.',
  accent text not null default '#5b5bd6',
  review_new boolean not null default false,
  email_from text not null default '',
  timezone text not null default 'America/New_York',
  has_sample boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1);

-- doctor: allow W095 categories are public on the board and belong to nobody
create table categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  position int not null default 0
);

-- doctor: allow W095 ideas are public on the board; who may change one is decided in model.ts
create table posts (
  id serial primary key,
  category_id int references categories(id) on delete set null,
  title text not null,
  body text not null default '',
  status text not null default 'review' check (status in ('review', 'planned', 'progress', 'shipped', 'closed')),
  author_id text not null,
  author_name text not null default '',
  pinned boolean not null default false,
  hidden boolean not null default false,
  merged_into int references posts(id) on delete set null,
  vote_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  status_at timestamptz not null default now(),
  -- Sample rows from the first install, removed together from Manage, Settings.
  sample boolean not null default false
);
create index posts_author_id on posts (author_id);
create index posts_status on posts (status) where merged_into is null;

-- doctor: allow W095 comments are public on the board; staff notes are filtered in store.ts
create table comments (
  id serial primary key,
  post_id int not null references posts(id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  team boolean not null default false,
  kind text not null default 'comment' check (kind in ('comment', 'note', 'status', 'merged')),
  status text,
  body text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_post on comments (post_id, id);

-- Everyone who has posted, voted or commented, by their Whisk user id. A vote a staff member
-- adds for a customer who has not signed in yet is held under "email:<address>" until they do.
create table people (
  user_id text primary key,
  email text not null default '',
  name text not null default '',
  email_updates boolean not null default true,
  sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index people_email on people (lower(email));
alter table people enable row level security;
alter table people force row level security;
create policy people_by_audience on people using (
  current_setting('whisk.audience', true) in ('team', 'system')
  or user_id = nullif(current_setting('whisk.user_id', true), '')
);

create table votes (
  post_id int not null references posts(id) on delete cascade,
  user_id text not null,
  added_by text not null default '',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index votes_user_id on votes (user_id);
alter table votes enable row level security;
alter table votes force row level security;
create policy votes_by_audience on votes using (
  current_setting('whisk.audience', true) in ('team', 'system')
  or user_id = nullif(current_setting('whisk.user_id', true), '')
);

-- doctor: allow W095 the changelog is public and written by staff
create table entries (
  id serial primary key,
  slug text not null unique,
  title text not null,
  body text not null default '',
  label text not null default 'new' check (label in ('new', 'improved', 'fixed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  sample boolean not null default false
);

-- doctor: allow W095 links between public changelog entries and public ideas
create table entry_posts (
  entry_id int not null references entries(id) on delete cascade,
  post_id int not null references posts(id) on delete cascade,
  primary key (entry_id, post_id)
);

-- Every email the board sends, written down first and then sent by the queue.
create table emails (
  id serial primary key,
  kind text not null,
  to_email text not null,
  subject text not null,
  html text not null,
  text text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed', 'demo')),
  error text not null default '',
  created_at timestamptz not null default now()
);
alter table emails enable row level security;
alter table emails force row level security;
create policy emails_staff_only on emails using (current_setting('whisk.audience', true) in ('team', 'system'));
