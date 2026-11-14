
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_fields() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.claim_first_admin() from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
revoke execute on function public.claim_legacy_account() from public, anon;
revoke execute on function public.set_active_term(bigint) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.claim_first_admin() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.claim_legacy_account() to authenticated;
grant execute on function public.set_active_term(bigint) to authenticated;
