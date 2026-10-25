-- Trail Trophy: saved hikes + raw GPX storage.
-- Every row belongs to one user; Row Level Security enforces it. Public share links read
-- rows where is_public = true via their unguessable share_slug.

create table public.hikes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 200),
  recorded_at   timestamptz,                       -- first GPS timestamp, if the GPX has one
  distance_m    double precision not null,
  gain_m        double precision not null,
  peak_m        double precision not null,
  duration_h    double precision,
  start_lat     double precision,
  start_lon     double precision,
  gpx_path      text not null,                     -- object path in the 'gpx' storage bucket
  settings      jsonb not null default '{}'::jsonb, -- diorama style: shape, theme, exaggeration, …
  is_public     boolean not null default false,
  share_slug    text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index hikes_user_created_idx on public.hikes (user_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger hikes_touch before update on public.hikes
  for each row execute function public.touch_updated_at();

alter table public.hikes enable row level security;

create policy "Owners read their hikes"   on public.hikes for select using (auth.uid() = user_id);
create policy "Anyone reads public hikes" on public.hikes for select using (is_public);
create policy "Owners insert hikes"       on public.hikes for insert with check (auth.uid() = user_id);
create policy "Owners update hikes"       on public.hikes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners delete hikes"       on public.hikes for delete using (auth.uid() = user_id);

-- Raw GPX files: private bucket, one folder per user ( <user_id>/<hike_id>.gpx ).
insert into storage.buckets (id, name, public, file_size_limit)
values ('gpx', 'gpx', false, 15728640)
on conflict (id) do nothing;

create policy "Owners manage their GPX files" on storage.objects for all
  using      (bucket_id = 'gpx' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'gpx' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone reads GPX of public hikes" on storage.objects for select
  using (bucket_id = 'gpx' and exists (
    select 1 from public.hikes h where h.gpx_path = storage.objects.name and h.is_public
  ));
