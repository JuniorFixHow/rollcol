# Testing the free plan student limits

What changed:

- **Verified schools** on the free plan can have up to **100 students** (basic and senior high schools) or **200 students** (tertiary). Students who are turned off (for example those who have left) do not count.
- **Workspaces** stay at **50 students** across all of one person's workspaces.
- **Unverified schools** stay at **10 students** and 10 staff until RollCol verifies them.
- Turning a student back on when the school is full is refused, like adding one.
- The **overview** shows "X of 100 (free plan)" under Students, with a warning from 90% of the limit.
- The **platform page** shows each school's limit and lets the RollCol team give a verified school its own limit (for a pilot, until billing in Part 8 sets limits from paid plans).
- The message for too many confirmation emails is now clearer ("RollCol has sent too many confirmation emails in the last hour").

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who | School |
|---|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin | Test: Adenta Basic School (24 students) |
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin | Test: Accra Nursing College (18 students) |
| basic.teacher1@rollcol.test | Samuel Ankrah | Mr. Ankrah's lessons (workspace, from Part 7) |
| Your own account | You, platform admin | |

---

## Part A: Installation

1. **Extract** `rollcol-free-plan-limits.zip` into the project folder, replacing files when asked.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261128000000_free_plan_limits.sql`.
3. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.

No test data reload is needed.

---

## Part B: Tests

### Test 1: The overview shows the limit
**Account:** basic.admin@rollcol.test, then uni.admin@rollcol.test, then basic.teacher1@rollcol.test. **Where:** Website.

1. As basic.admin, open **Overview**. Under **Students**: "24 of 100 (free plan)".
2. As uni.admin: "18 of 200 (free plan)".
3. As basic.teacher1 in **Mr. Ankrah's lessons**: "X of 50 (all your workspaces)", where X is every student in all of Samuel's workspaces.

### Test 2: Reaching the limit
**Account:** basic.admin@rollcol.test, and Supabase. **Where:** Supabase SQL Editor, then Website.

1. Fill the basic school up to 100 students with placeholder pupils:
   ```sql
   insert into public.students (school_id, school_number, full_name)
   select s.id, 'F' || lpad(g::text, 3, '0'), 'Placeholder ' || g
   from public.schools s, generate_series(1, 76) g
   where s.name = 'Test: Adenta Basic School';
   ```
2. On the website, open **Overview**. "100 of 100 (free plan)", and a warning: **Your school has reached its student limit**, explaining that turned-off students do not count.
3. **Students > Add a student:** add one more. You see "This school can have up to 100 students on its current plan. Turn off students who have left, or contact RollCol to add more." Nothing is added.
4. Open **Placeholder 1** (search for it on **Students**) and click **Turn off**, then confirm. Now add the new student again: it works.
5. On Placeholder 1, click **Turn back on** and confirm: the same "up to 100 students" message, and it stays off.

### Test 3: A school's own limit
**Account:** your own account, then basic.admin@rollcol.test. **Where:** Website.

1. As yourself, open the **RollCol platform** page. Each school shows "N of LIMIT students", for example "100 of 100 students" for Test: Adenta Basic School and "18 of 200 students" for the college. Workspaces show "(limit across the owner's workspaces)".
2. For **Test: Adenta Basic School**, type `150` in **Student limit** and click **Set**. You see "Limit set to 150." and an **Own limit** label.
3. As basic.admin, the overview now reads "100 of 150 (this school's plan)", without the warning. Clicking **Turn back on** for Placeholder 1 now works.
4. As yourself, clear the **Student limit** box and click **Set**: "Back to the free plan limit." The school reads "of 100" again. (Students already there stay; only adding more is refused.)
5. Workspaces and unverified schools have no Student limit box.

### Test 4: Clean up
**Account:** Supabase. **Where:** Supabase SQL Editor.

```sql
delete from public.students
where school_number like 'F%' and full_name like 'Placeholder %'
  and school_id = (select id from public.schools where name = 'Test: Adenta Basic School');
```

Also delete the extra student you added in Test 2 from **Students** on the website, or reload the test data.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
