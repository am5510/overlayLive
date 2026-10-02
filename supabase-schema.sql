-- Run this once in Supabase SQL Editor.
create table if not exists public.overlay_state (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.overlay_state enable row level security;
-- The Node server uses the service-role key, so no public browser policy is needed.
