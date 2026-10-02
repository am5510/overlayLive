-- Run this in Supabase SQL Editor to create normalized tables

-- 1. Profiles Table
create table if not exists public.profiles (
  id serial primary key,
  name text not null,
  role text not null,
  created_at timestamptz not null default now()
);

-- Insert initial profiles
insert into public.profiles (name, role) values
  ('ROLLBACK VERIFIED', 'SAFE STATE'),
  ('PIMCHANOK W.', 'CO-HOST · LIVE FROM BANGKOK'),
  ('THANAPOL K.', 'GUEST SPEAKER'),
  ('LIVE TEST', 'SYNC VALID'),
  ('KITTIPONG C.', 'COMMENTATOR'),
  ('MAYURA T.', 'FIELD REPORTER'),
  ('PHURIT P.', 'ANALYST');

-- 2. Projects Table
create table if not exists public.projects (
  id serial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- Insert initial projects
insert into public.projects (name) values
  ('LIVE MAIN'),
  ('INTERVIEW'),
  ('BREAKING NEWS');

-- 3. Corner Logos Table
create table if not exists public.corner_logos (
  id serial primary key,
  name text not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- Insert initial corner logo
insert into public.corner_logos (name) values
  ('logo1');

-- Enable RLS for new tables (optional, allowing public read for overlay but secure write)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.corner_logos enable row level security;
