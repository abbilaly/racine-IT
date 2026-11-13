-- Local-only restore prelude. The dump creates auth.users itself, so this file
-- deliberately does not: it only provides what the dump expects to already
-- exist (the auth schema and auth.uid(), the storage tables for the RLS
-- policies). Never apply to a Supabase project.
-- auth.uid() itself is created by the dump (it lives in the auth schema), so it
-- must not be pre-created here or the restore hits "function already exists".
create schema if not exists auth;

create schema if not exists storage;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);
