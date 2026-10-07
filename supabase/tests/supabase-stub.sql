-- Minimal stand-in for the Supabase platform surface our migrations touch.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
alter table storage.objects enable row level security;

create publication supabase_realtime;

-- Supabase installs pgcrypto in its own schema, not public. Mirror that so
-- functions that forget to look there fail here too.
create schema extensions;
create extension pgcrypto with schema extensions;
