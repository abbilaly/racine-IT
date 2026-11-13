-- Re-apply the privileges Supabase's default ACLs normally grant to the API
-- roles. Dumps are taken with --no-privileges so the archive stays portable;
-- without this step a restored database can leave the storefront unable to
-- read its own catalogue. RLS still applies on top of these grants.
begin;

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

commit;
