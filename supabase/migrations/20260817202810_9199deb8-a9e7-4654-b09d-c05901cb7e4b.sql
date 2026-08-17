revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke all on function public.handle_new_user_role() from public, anon, authenticated;
grant execute on function public.handle_new_user_role() to service_role, supabase_auth_admin;