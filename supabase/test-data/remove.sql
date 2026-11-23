-- Removes all RollCol test data: the three "Test:" schools (with their classes,
-- students, guardians and registers), workspaces started by test accounts, and
-- every @rollcol.test account.
-- Your own account stays; it is only removed from the test schools.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.

delete from public.schools where name like 'Test: %';
-- Workspaces that test accounts started (Part 7).
delete from public.schools
where is_workspace
  and created_by in (select id from auth.users where email like '%@rollcol.test' or raw_app_meta_data ->> 'rollcol_test' = 'true');
delete from auth.users where email like '%@rollcol.test' or raw_app_meta_data ->> 'rollcol_test' = 'true';

select 'Test data removed.' as result;
