-- =============================================================================
-- myDropbox database schema
-- -----------------------------------------------------------------------------
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query,
-- paste this whole file, and click "Run".
--
-- It creates the tables and Row-Level Security (RLS) policies the app needs.
-- RLS is what keeps each user's files private: every query is automatically
-- filtered to the logged-in user (auth.uid()).
--
-- NOTE: file *bytes* are NOT stored in Supabase. They live in your personal
-- Google Drive, written/read through the Apps Script proxy in
-- google-apps-script/. Supabase only stores metadata — including the Drive file
-- id (drive_id) each row points at.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Folders form a tree via parent_id (NULL parent = top level / "My Files").
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  parent_id  uuid references public.folders (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists folders_owner_parent_idx
  on public.folders (owner_id, parent_id);

-- Files reference the blob stored in Google Drive via drive_id.
create table if not exists public.files (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  folder_id  uuid references public.folders (id) on delete cascade,
  name       text not null,
  drive_id   text not null,
  size       bigint not null default 0,
  mime_type  text,
  created_at timestamptz not null default now()
);

create index if not exists files_owner_folder_idx
  on public.files (owner_id, folder_id);

-- A share is a public, token-addressable pointer to one file. The proxy
-- resolves the token to drive_id (server-side) and streams the file to
-- anonymous visitors; the Drive file itself is never shared inside Drive.
create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  file_id    uuid not null references public.files (id) on delete cascade,
  file_name  text not null,
  mime_type  text,
  size       bigint not null default 0,
  drive_id   text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists shares_token_idx on public.shares (token);
create index if not exists shares_owner_idx on public.shares (owner_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.folders enable row level security;
alter table public.files   enable row level security;
alter table public.shares  enable row level security;

-- Owners have full control over their own folders.
drop policy if exists "own folders" on public.folders;
create policy "own folders" on public.folders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Owners have full control over their own files.
drop policy if exists "own files" on public.files;
create policy "own files" on public.files
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Owners manage their own shares...
drop policy if exists "own shares" on public.shares;
create policy "own shares" on public.shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ...but ANYONE (including anonymous visitors) may read a share row. This is
-- what powers public share links, and lets the proxy validate a token using the
-- public anon key. The token is an unguessable UUID; the drive_id it exposes
-- grants no access on its own because the Drive file is never publicly shared.
drop policy if exists "public read shares" on public.shares;
create policy "public read shares" on public.shares
  for select using (true);
