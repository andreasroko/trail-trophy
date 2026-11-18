-- Trail Trophy: privacy-rule (RLS) check.
--
-- Paste into the Supabase SQL editor and run. It creates two throwaway users (Alice, Bob),
-- acts as each of them and as an anonymous visitor, and checks every rule.
-- It ALWAYS ends by raising an error on purpose: that rolls back everything it created,
-- and the error message is the report. Look for "N passed, 0 failed".

do $$
declare
  alice  constant uuid := '00000000-0000-4000-a000-00000000a11c';
  bob    constant uuid := '00000000-0000-4000-a000-000000000b0b';
  passed int := 0;
  failed int := 0;
  report text := '';
  ok     boolean;
  n      int;
  priv_id uuid;
  pub_id  uuid;
  slug    text;
  owner   uuid;
begin
  -- ---------------------------------------------------------------- setup (as the admin)
  insert into auth.users (id, email) values (alice, 'alice@rls-test.invalid'), (bob, 'bob@rls-test.invalid');

  -- ---------------------------------------------------------------- act as Alice
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);

  -- 1. Alice can save a private hike; user_id is filled in from her login
  begin
    insert into public.hikes (name, distance_m, gain_m, peak_m, gpx_path)
      values ('Alice private', 1000, 100, 500, alice || '/private.gpx')
      returning id, user_id into priv_id, owner;
    ok := owner = alice;
  exception when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Alice can save a hike (owned by her automatically)';
  else failed := failed + 1; report := report || E'\n  ❌ Alice can save a hike (owned by her automatically)'; end if;

  -- 2. Alice can save a public hike, and it gets a share slug
  begin
    insert into public.hikes (name, distance_m, gain_m, peak_m, gpx_path, is_public)
      values ('Alice public', 2000, 200, 900, alice || '/public.gpx', true)
      returning id, share_slug into pub_id, slug;
    ok := slug is not null and length(slug) >= 10;
  exception when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Public hike gets a share slug';
  else failed := failed + 1; report := report || E'\n  ❌ Public hike gets a share slug'; end if;

  -- 3. Alice cannot create a hike in Bob's name
  begin
    insert into public.hikes (user_id, name, distance_m, gain_m, peak_m, gpx_path)
      values (bob, 'Forged', 1, 1, 1, bob || '/forged.gpx');
    ok := false;
  exception when insufficient_privilege then ok := true;
            when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Alice cannot create a hike in Bob''s name';
  else failed := failed + 1; report := report || E'\n  ❌ Alice cannot create a hike in Bob''s name'; end if;

  -- 4. Alice can upload GPX files into her own folder
  begin
    insert into storage.objects (bucket_id, name) values ('gpx', alice || '/private.gpx'), ('gpx', alice || '/public.gpx');
    ok := true;
  exception when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Alice can upload GPX to her own folder';
  else failed := failed + 1; report := report || E'\n  ❌ Alice can upload GPX to her own folder'; end if;

  -- 5. Alice cannot upload into Bob's folder
  begin
    insert into storage.objects (bucket_id, name) values ('gpx', bob || '/sneaky.gpx');
    ok := false;
  exception when insufficient_privilege then ok := true;
            when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Alice cannot upload into Bob''s folder';
  else failed := failed + 1; report := report || E'\n  ❌ Alice cannot upload into Bob''s folder'; end if;

  -- ---------------------------------------------------------------- act as Bob
  perform set_config('request.jwt.claims', json_build_object('sub', bob, 'role', 'authenticated')::text, true);

  -- 6. Bob sees Alice's public hike but not her private one
  ok := exists (select 1 from public.hikes where id = pub_id)
        and not exists (select 1 from public.hikes where id = priv_id);
  if ok then passed := passed + 1; report := report || E'\n  ✅ Bob sees Alice''s public hike, not her private one';
  else failed := failed + 1; report := report || E'\n  ❌ Bob sees Alice''s public hike, not her private one'; end if;

  -- 7. Bob cannot edit Alice's hike (even the public one)
  begin
    update public.hikes set name = 'Hacked', is_public = true where id in (priv_id, pub_id);
    get diagnostics n = row_count;
    ok := n = 0;
  exception when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Bob cannot edit Alice''s hikes';
  else failed := failed + 1; report := report || E'\n  ❌ Bob cannot edit Alice''s hikes'; end if;

  -- 8. Bob cannot delete Alice's hike
  begin
    delete from public.hikes where id in (priv_id, pub_id);
    get diagnostics n = row_count;
    ok := n = 0;
  exception when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Bob cannot delete Alice''s hikes';
  else failed := failed + 1; report := report || E'\n  ❌ Bob cannot delete Alice''s hikes'; end if;

  -- 9. Bob can read the GPX of Alice's public hike, not her private one
  ok := exists (select 1 from storage.objects where bucket_id = 'gpx' and name = alice || '/public.gpx')
        and not exists (select 1 from storage.objects where bucket_id = 'gpx' and name = alice || '/private.gpx');
  if ok then passed := passed + 1; report := report || E'\n  ✅ Bob reads public GPX only';
  else failed := failed + 1; report := report || E'\n  ❌ Bob reads public GPX only'; end if;

  -- ---------------------------------------------------------------- act as an anonymous visitor
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- 10. Visitors see public hikes only
  ok := exists (select 1 from public.hikes where id = pub_id)
        and not exists (select 1 from public.hikes where id = priv_id);
  if ok then passed := passed + 1; report := report || E'\n  ✅ Signed-out visitors see public hikes only';
  else failed := failed + 1; report := report || E'\n  ❌ Signed-out visitors see public hikes only'; end if;

  -- 11. Visitors cannot create hikes
  begin
    insert into public.hikes (name, distance_m, gain_m, peak_m, gpx_path) values ('Anon', 1, 1, 1, 'x/y.gpx');
    ok := false;
  exception when insufficient_privilege or not_null_violation then ok := true;
            when others then ok := false; report := report || E'\n     error: ' || sqlerrm;
  end;
  if ok then passed := passed + 1; report := report || E'\n  ✅ Signed-out visitors cannot save hikes';
  else failed := failed + 1; report := report || E'\n  ❌ Signed-out visitors cannot save hikes'; end if;

  -- ---------------------------------------------------------------- report + roll back everything
  raise exception E'RLS CHECK: % passed, % failed (this error is intentional — it undoes all test data)%',
    passed, failed, report;
end $$;
