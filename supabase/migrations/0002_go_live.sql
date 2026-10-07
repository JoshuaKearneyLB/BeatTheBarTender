-- Go-live fixes, found running against a real Supabase project.

-- ---------- pgcrypto lives in `extensions` on Supabase ----------
-- 0001 pinned its functions to search_path = public, so crypt() and
-- gen_salt() weren't found and every create_race failed. Widen the path on
-- the two functions that hash PINs (a missing schema is simply skipped,
-- so this is safe where pgcrypto sits in public).

alter function create_race(text, text, int, text, text, text, text)
  set search_path = public, extensions;
alter function _require_manager(races, text)
  set search_path = public, extensions;

-- ---------- short race codes ----------
-- Staff can type "K7Q2P" on the front door instead of opening a long link.
-- Five characters from an alphabet with no lookalikes (no 0/O, 1/I/L),
-- unique per race, assigned on insert.

create or replace function _new_race_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from races where code = v_code);
  end loop;
  return v_code;
end $$;

alter table races add column code text;
update races set code = _new_race_code() where code is null;
alter table races
  alter column code set default _new_race_code(),
  alter column code set not null,
  add constraint races_code_key unique (code);

-- Codes are case-insensitive for whoever types them.
create or replace function race_id_for_code(p_code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from races where code = upper(trim(p_code));
$$;

revoke execute on function _new_race_code() from public, anon;
grant execute on function race_id_for_code(text) to authenticated;
