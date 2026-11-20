-- Removes all RollCol test data: the three "Test:" schools (with their classes,
-- students, guardians and registers) and every @rollcol.test account.
-- Your own account stays; it is only removed from the test schools.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.

delete from public.schools where name like 'Test: %';
delete from auth.users where email like '%@rollcol.test';

select 'Test data removed.' as result;
