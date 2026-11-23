# Testing Part 7b: moving a workspace into a school

The owner of a workspace can ask to move it into a school where they are already staff. The school's admin sees exactly what will happen, then approves or declines. On approval everything moves in one step and the workspace is deleted:

- **Terms or semesters:** records go to the school's term or semester that overlaps them most. If the school has none for a term in use, the move cannot happen until the admin adds it.
- **Classes and venues:** a name the school already uses gets " (moved)".
- **Courses:** a code the school already has is the same course, so the workspace's students, sessions and records join the school's course.
- **Students:** someone already at the school is joined to their existing record, not duplicated. That means the same account, or for pupils without accounts, the same school ID and the same name. A school ID the school uses for someone else gets a "W" added (ADB4002 becomes ADB4002W).
- **Guardians:** the same phone number is the same guardian.
- **The owner** keeps teaching the moved classes or courses as staff at the school.
- **Nothing is sent to guardians by the move.** Afterwards the school's own alerts apply.
- **The school's student limit** is checked first.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol app on your iPhone
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who | Used for |
|---|---|---|
| basic.teacher1@rollcol.test | Samuel Ankrah, owner of Mr. Ankrah's lessons (Part 7) and staff at Test: Adenta Basic School | Moving a classes workspace |
| basic.admin@rollcol.test | Grace Adjei, admin of Test: Adenta Basic School | Reviewing that move |
| uni.lecturer1@rollcol.test | Mr. Daniel Ocran, owner of Dr. Ocran, Anatomy (Part 7) and lecturer at Test: Accra Nursing College | Moving a courses workspace |
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin of Test: Accra Nursing College | Reviewing that move |
| student1@rollcol.test | Abena Mensah, who joined Dr. Ocran, Anatomy in Part 7 | Checking the app afterwards |
| Your own account | Platform admin | Setting a student limit |

**Before you start:** you need the two workspaces from Part 7 (Tests 3, 4 and 8, 9). If you deleted one, create it again as in Part 7. If you reloaded the test data since, both are gone, so create them again.

---

## Part A: Installation

1. **Extract** `rollcol-part7b.zip` into the project folder, replacing files when asked.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261129000000_workspace_moves.sql`.
3. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.

No new app build and no test data reload are needed.

---

## Part B: Prepare the classes workspace

### Test 1: Add records that clash with the school
**Account:** basic.teacher1@rollcol.test, in **Mr. Ankrah's lessons**. **Where:** Website.

These records match what Test: Adenta Basic School already has, so the move has something to sort out.

1. **Academics > Classes:** create a class called `Basic 4` (the school has one too). Keep `Evening JHS 3` from Part 7.
2. **Students:** add to Basic 4:
   - `Abena Mensah` with school ID `ADB4001` (the school's Abena Mensah has the same ID and name: the same pupil);
   - `Different Child` with school ID `ADB4002` (the school uses ADB4002 for Kwame Owusu: a different pupil).
3. On **Abena Mensah**, add a guardian with **your own phone number**. The school's test guardians use your number, so it is the same guardian.
4. **Attendance > Registers:** take today's register for Basic 4 (mark both present) and submit it.

---

## Part C: Asking

### Test 2: The checks when asking
**Account:** basic.teacher1@rollcol.test, in Mr. Ankrah's lessons. **Where:** Website, then Supabase.

1. Open **Settings**. Above **Delete this workspace** there is a new card, **Move into a school**, with three steps and a **School code** box.
2. Type `XXXXXX` and click **Ask to move**: "No school has that code. Check it with the school's admin."
3. Get the school codes in Supabase > SQL Editor:
   ```sql
   select name, code from public.schools where name like 'Test:%' order by name;
   ```
4. Enter the code of **Test: Accra Nursing College**: "A classes workspace can only move into a basic or senior high school."
5. Enter the code of **Test: Adenta Basic School** and click **Ask to move**: "Request sent. The school's admins will review it."
6. The card now reads **Waiting for Test: Adenta Basic School**, and shows what will happen:
   - "2 classes, 4 students (3 new to the school), 2 registers, 1 guardian move into Test: Adenta Basic School." (Your numbers depend on what you added in Part 7.)
   - "After the move, guardians get the school's attendance alerts. Nothing is sent by the move itself."
   - Under **Changes along the way**: your term "Term 1" becomes the school's term "Term 1"; "The school already has a class called Basic 4, so this one becomes Basic 4 (moved)"; "Abena Mensah (ADB4001) is already a student at the school, so the records are joined"; "The school ID ADB4002 is used by someone else at the school, so Different Child gets ADB4002W"; "1 guardian is already at the school (same phone number), so the records are joined."
7. Enter the Adenta code again and click **Ask to move**: "This workspace is already waiting to move. Cancel that request first."

### Test 3: Declining
**Account:** basic.admin@rollcol.test, then basic.teacher1@rollcol.test. **Where:** Website.

1. As basic.admin, open **Overview**. A note: "Samuel Ankrah asks to move a workspace into your school", with **See what will happen and decide**. Click it.
2. The page **Move Mr. Ankrah's lessons into Test: Adenta Basic School?** shows the same list under **What will happen**, with **Approve and move** and **Decline**.
3. Click **Decline**. A RollCol dialog asks for a reason. Type `ab` and confirm: "Tell the owner why, so they know what to do." Type `Please talk to me first` and confirm. You are back on the overview: "You declined the move."
4. As basic.teacher1, open **Settings**: a note **Test: Adenta Basic School declined**, with "Please talk to me first", and the School code box is back.
5. If basic.teacher1 is signed in to the app with notifications on, a notification "Workspace not moved" arrives.

### Test 4: Cancelling
**Account:** basic.teacher1@rollcol.test. **Where:** Website.

1. In **Settings**, ask again with the Adenta code.
2. Click **Cancel request** and confirm in the RollCol dialog: "Request cancelled." The School code box is back.
3. Ask once more with the Adenta code (for Test 5).

---

## Part D: Approving

### Test 5: The move
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. Open **Overview > See what will happen and decide**.
2. Click **Approve and move**. A RollCol dialog warns that this cannot be undone. Confirm.
3. You return to the overview: **The workspace has moved into your school**.
4. **Academics > Classes:** you see **Basic 4 (moved)** and **Evening JHS 3**, both with **Samuel Ankrah** as class teacher, next to the school's own Basic 4 and Basic 5.
5. **Students:** search `Abena Mensah`. There is still **one** Abena Mensah (ADB4001), in the school's **Basic 4**. Search `ADB4002W`: **Different Child**, in Basic 4 (moved). The Evening JHS 3 pupils are there with their school IDs.
6. **Attendance > Reports > Basic 4 (moved):** today's register is there, with Abena Mensah and Different Child.
7. Open **Abena Mensah**: her guardian is still the school's own guardian (your number), not a second copy.
8. **No texts:** your phone gets no SMS about guardians being added or removed. To be sure, in Supabase:
   ```sql
   select created_at, body from public.sms_outbox order by created_at desc limit 5;
   ```
   No new message mentions being added or removed as a guardian.

### Test 6: The owner afterwards
**Account:** basic.teacher1@rollcol.test. **Where:** Website, then App.

1. Reload the website. The dashboard opens for one of the schools (the workspace no longer exists). The school switcher no longer lists Mr. Ankrah's lessons.
2. **Your account:** a new card **Workspace moves**: "Mr. Ankrah's lessons moved into Test: Adenta Basic School on (today)." The earlier decline is listed too.
3. In **Test: Adenta Basic School**, **Attendance > Registers** offers Basic 4 (moved) and Evening JHS 3 for Samuel.
4. **App:** the workspace is gone from **Account > Your schools and workspaces**. In Test: Adenta Basic School, Today shows the moved classes' registers. If notifications are on, "Workspace moved" arrived.

---

## Part E: A courses workspace, and what stops a move

### Test 7: Problems block the move
**Account:** uni.lecturer1@rollcol.test, uni.admin@rollcol.test and your own account. **Where:** Website.

1. As uni.lecturer1, in **Dr. Ocran, Anatomy > Settings**, ask to move with the code of **Test: Accra Nursing College**.
2. As yourself, on the **RollCol platform** page, set the college's **Student limit** to `17` and click **Set** (it has 18 students, so it is already over).
3. As uni.admin, open the request from the overview. A red box **Before the move can happen**: "Test: Accra Nursing College can have up to 17 students and has 18. The move adds 0. Turn off students who have left, or ask RollCol for a higher limit." (Abena is already a college student, so she does not add one.) There is **no Approve and move** button, only Decline.
4. As yourself, clear the college's Student limit and click **Set**.
5. As uni.admin, reload the request page: the red box is gone and **Approve and move** is back.

### Test 8: Moving the courses workspace
**Account:** uni.admin@rollcol.test, then uni.lecturer1@rollcol.test and student1@rollcol.test. **Where:** Website, then App.

1. As uni.admin, check the list: "Abena Mensah (RGN25001) is already a student at the school, so the records are joined", and your semester "Semester 1" becomes the school's semester "First semester". Click **Approve and move** and confirm.
2. **Academics > Courses:** **ANA 201 Gross Anatomy** is now a college course for First semester, with Mr. Daniel Ocran as lecturer.
3. **Attendance > Reports > ANA 201 > All:** the session from Part 7 Test 9 is there, with Abena Mensah's check-in.
4. **Students:** still one Abena Mensah (RGN25001).
5. **App** (student1): **Account > Your schools and workspaces** lists only Test: Accra Nursing College. In **Courses**, ANA 201 is there next to her college courses.
6. As uni.lecturer1 on the website: **Your account > Workspace moves** shows the move.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
