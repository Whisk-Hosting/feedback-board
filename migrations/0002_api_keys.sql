-- API keys, made by an admin under Manage > Settings for scripts and agents that use /api/v1.
-- Only a hash of each key is kept, with its first characters to tell keys apart; the key itself
-- is shown once. Keys are for staff, so only staff and the app itself see the rows.
create table api_keys (
  id serial primary key,
  label text not null,
  prefix text not null,
  hash text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table api_keys enable row level security;
alter table api_keys force row level security;
create policy api_keys_staff_only on api_keys using (current_setting('whisk.audience', true) in ('team', 'system'));
