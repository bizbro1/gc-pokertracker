-- Host recovery: a short, human-readable code that lets the host claim the
-- table from another device (the host secret itself is a cookie tied to one
-- browser). Lives in session_keys, which has no read policies — only the
-- server can check it.

alter table public.session_keys
  add column if not exists host_code text;
