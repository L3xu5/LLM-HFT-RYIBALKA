-- Fishing app schema + RLS.
-- Apply with: supabase db push   (or run manually in SQL Editor)

create extension if not exists "pgcrypto";

-- =========================
-- profiles
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- catches
-- =========================
create table if not exists public.catches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  fish_species text,
  weight_g int,
  bait text,
  gear text,
  notes text,
  caught_at timestamptz not null default now(),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists catches_user_idx on public.catches (user_id);
create index if not exists catches_public_idx on public.catches (is_public);
create index if not exists catches_caught_at_idx on public.catches (caught_at desc);

alter table public.catches enable row level security;

drop policy if exists catches_select on public.catches;
create policy catches_select on public.catches
  for select
  using (is_public = true or user_id = auth.uid());

drop policy if exists catches_insert_self on public.catches;
create policy catches_insert_self on public.catches
  for insert with check (user_id = auth.uid());

drop policy if exists catches_update_self on public.catches;
create policy catches_update_self on public.catches
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists catches_delete_self on public.catches;
create policy catches_delete_self on public.catches
  for delete using (user_id = auth.uid());

-- =========================
-- catch_photos
-- =========================
create table if not exists public.catch_photos (
  id uuid primary key default gen_random_uuid(),
  catch_id uuid not null references public.catches on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists catch_photos_catch_idx on public.catch_photos (catch_id);

alter table public.catch_photos enable row level security;

drop policy if exists catch_photos_select on public.catch_photos;
create policy catch_photos_select on public.catch_photos
  for select using (
    exists (
      select 1 from public.catches c
      where c.id = catch_id
        and (c.is_public = true or c.user_id = auth.uid())
    )
  );

drop policy if exists catch_photos_modify on public.catch_photos;
create policy catch_photos_modify on public.catch_photos
  for all using (
    exists (select 1 from public.catches c where c.id = catch_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.catches c where c.id = catch_id and c.user_id = auth.uid())
  );

-- =========================
-- Storage bucket: catch-photos
-- =========================
insert into storage.buckets (id, name, public)
values ('catch-photos', 'catch-photos', true)
on conflict (id) do nothing;

drop policy if exists "catch-photos public read" on storage.objects;
create policy "catch-photos public read" on storage.objects
  for select to public
  using (bucket_id = 'catch-photos');

drop policy if exists "catch-photos auth write own folder" on storage.objects;
create policy "catch-photos auth write own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catch-photos auth update own" on storage.objects;
create policy "catch-photos auth update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catch-photos auth delete own" on storage.objects;
create policy "catch-photos auth delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
