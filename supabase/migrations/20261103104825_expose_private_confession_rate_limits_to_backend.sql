alter table private.confession_rate_limits set schema public;
revoke all on public.confession_rate_limits from anon, authenticated;
grant all on public.confession_rate_limits to service_role;
