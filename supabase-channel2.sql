-- รันคำสั่งนี้ใน Supabase -> SQL Editor เพื่อสร้างตารางสำหรับ ช่อง 2 (เหมือนช่อง 1 ทุกประการ)

-- 1. ตาราง overlay_state2
create table if not exists public.overlay_state2 (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.overlay_state2 enable row level security;

insert into public.overlay_state2 (id, data, updated_at)
select id, data, updated_at from public.overlay_state
on conflict (id) do nothing;

-- 2. ตาราง profiles2
create table if not exists public.profiles2 (
  id serial primary key,
  name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  organization_logo text
);

insert into public.profiles2 (id, name, role, created_at, organization_logo)
select id, name, role, created_at, organization_logo from public.profiles
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('public.profiles2', 'id'),
  coalesce((select max(id) from public.profiles2), 1)
);

-- 3. ตาราง projects2
create table if not exists public.projects2 (
  id serial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.projects2 (id, name, created_at)
select id, name, created_at from public.projects
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('public.projects2', 'id'),
  coalesce((select max(id) from public.projects2), 1)
);

-- 4. ตาราง corner_logos2
create table if not exists public.corner_logos2 (
  id serial primary key,
  name text not null,
  image_url text,
  created_at timestamptz not null default now()
);

insert into public.corner_logos2 (id, name, image_url, created_at)
select id, name, image_url, created_at from public.corner_logos
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('public.corner_logos2', 'id'),
  coalesce((select max(id) from public.corner_logos2), 1)
);
