# Testing Part 7: teacher and lecturer workspaces, and weekly reports in the app

Part 7 lets one teacher or lecturer use RollCol without a school, like Google Classroom:

- **Workspaces:** "Just me" on the sign-up page, or **Start a workspace** from Your account. A workspace for **classes** (registers for pupils, for example extra classes or a school not yet on RollCol) or for **courses** (students check in with the app, as at a college).
- **Just one person:** the owner does everything. No Staff page, no Programmes or Batches, and the owner is automatically the teacher of every class and the lecturer of every course. Courses need no approval.
- **Free:** up to 50 students across all of one person's workspaces. Free workspaces send no SMS. (Paid plans come in Part 8.)
- **Students** join a lecturer's workspace in the app with the workspace code and their student ID, straight away (no approval, unless the owner turns it on).
- **Switching:** a workspace appears next to your schools in the school switcher, on Your account and in the app.
- **Deleting:** the owner can delete a workspace from Settings by typing its name.
- **Weekly reports in the app:** the report screen has **Week** (arrows to move a week at a time), **All** and **Dates** (a calendar to choose From and To). Sharing follows what is shown.
- **Small fix:** radio buttons no longer shrink to a dot when their text wraps.

Moving a workspace into a school comes later (it needs the school's approval and careful merging of classes and students).

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol app on your iPhone (the development build you already have)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**
- **Your inbox**: the email account you use for your own RollCol account

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who | Used for |
|---|---|---|
| basic.teacher1@rollcol.test | Samuel Ankrah, teacher at Test: Adenta Basic School | A classes workspace |
| uni.lecturer1@rollcol.test | Mr. Daniel Ocran, lecturer at Test: Accra Nursing College | A courses workspace |
| student1@rollcol.test | Abena Mensah, student RGN25001 | Joining the lecturer's workspace on your iPhone |
| Your own account | You (platform admin) | The platform page |
| A new account | A second address of yours | Signing up with "Just me" (Test 2) |

---

## Part A: Installation

1. **Extract** `rollcol-part7.zip` into the project folder, replacing files when asked.
2. **Install packages** (nothing new is downloaded, but the shared package changed):
   ```
   pnpm install
   ```
3. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261127000000_workspaces.sql`.
4. **Reload the test data:** in Supabase > SQL Editor, run `supabase/test-data/remove.sql` (it now also removes workspaces made by test accounts), then `supabase/test-data/load.sql` (with your email and phone at the top, as before).
5. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.
6. **The app:** no new build is needed. In the project folder run
   ```
   pnpm dev:mobile
   ```
   and open the RollCol app on your iPhone.

---

## Part B: Starting a workspace

### Test 1: "A school" or "Just me"
**Account:** none (signed out, or a private window). **Where:** Website.

1. Open the home page. Under the buttons: "Teaching on your own, without a school? **Start a free workspace**." Click it.
2. The sign-up page shows two tabs at the top, **A school** and **Just me**, with **Just me** chosen, and the title **Start your own workspace** ("Free for up to 50 students").
3. Click **Create workspace** without filling anything in. Every field shows what is missing in red, and "Some fields need attention" appears.
4. Choose **Classes (basic, JHS or SHS level)**. **How do you take registers?** appears, with **Once a day** chosen. Choose **Courses (university or college level)**: that question goes away.
5. Click **A school**. The school form opens, with a line pointing to **Just me** for people teaching on their own.

### Test 2: Sign up with "Just me"
**Account:** a new account with a second address of yours (with Gmail, `yourname+rollcolws@gmail.com` arrives in your inbox). **Where:** Website, then your inbox.

1. On **Sign up > Just me**, choose **Courses (university or college level)**, workspace name `Test: My lectures`, your name, your phone number, the second address and a password. Click **Create workspace**.
2. You see the "Check your email" page. Open the email and click the link.
3. The page **Finish setting up your workspace** opens with your details filled in. Click **Create workspace**.
4. The dashboard opens for **Test: My lectures**. Under the name at the top left: "(your name), your workspace".
5. Keep this account; Test 12 deletes the workspace.

### Test 3: A teacher starts a classes workspace
**Account:** basic.teacher1@rollcol.test. **Where:** Website.

1. Sign in. Open **Your account**. The card is now called **Your schools and workspaces**, with buttons **Register another school** and **Start a workspace**. Click **Start a workspace**.
2. The form has no email or password (you are signed in). Choose **Classes**, keep **Once a day**, name it `Mr. Ankrah's lessons`, enter `Mr. Samuel Ankrah` and your phone number. Click **Create workspace**.
3. The dashboard opens for **Mr. Ankrah's lessons**:
   - The heading reads "Your own workspace, Mr. Samuel Ankrah. Only you can see and change it."
   - A note: "A free workspace. You can have up to 50 students in all your workspaces. Guardians can be recorded, but free workspaces do not send SMS alerts."
   - Two counters only: **Students** and **Classes** (no Staff).
   - A **Workspace code** card.
   - **Getting started** with three steps: add the current term, create your classes, add your pupils.
4. The menu shows: Overview, **Attendance** (Registers, Reports), **Students**, **Academics** (Classes, Terms), Settings, Your account. There is **no** Messages and **no** Staff.
5. Type `/dashboard/staff` at the end of the address. You are taken back to the overview. Try `/dashboard/messages`: **Page not found**.

### Test 4: Use the classes workspace
**Account:** basic.teacher1@rollcol.test (in Mr. Ankrah's lessons). **Where:** Website, then App.

1. **Academics > Terms:** add `Term 1` from 4 weeks ago to 8 weeks from today.
2. **Academics > Classes:** the **Create a class** card has only **Class name** (no class teacher to choose). Create `Evening JHS 3`. The table shows **Mr. Samuel Ankrah** as its class teacher.
3. **Students:** add three pupils to Evening JHS 3 (any names, school IDs like `EV001`, `EV002`, `EV003`).
4. **Attendance > Registers:** take today's register for Evening JHS 3 and submit it.
5. **Attendance > Reports:** Evening JHS 3 shows 3 students and 1 school day. Open it: this week shows today's marks.
6. **App:** sign in as basic.teacher1@rollcol.test. Open **Account > Your schools and workspaces**: Mr. Ankrah's lessons is listed as **Your workspace**. Choose it. **Today** greets you with "Mr. Ankrah's lessons · Your workspace" and shows Evening JHS 3's register.

### Test 5: Switching between schools and the workspace
**Account:** basic.teacher1@rollcol.test. **Where:** Website.

1. The school switcher at the top left lists Test: Adenta Basic School, Test: Labone SHS and Mr. Ankrah's lessons. Choose **Test: Adenta Basic School**: the menu has Messages again, and the header reads "Mr. Samuel Ankrah, Teacher".
2. Switch back to **Mr. Ankrah's lessons**.

### Test 6: Workspace settings
**Account:** basic.teacher1@rollcol.test (in Mr. Ankrah's lessons). **Where:** Website.

1. Open **Settings**. The first card is **Workspace** with **Workspace name** and **Your phone number**.
2. There is a **Registers** card and a **Reports** card, but **no** "SMS to guardians" card.
3. At the bottom, a separate red-edged card: **Delete this workspace** (do not use it yet).
4. Change the workspace name to `Mr. Ankrah's extra classes` and click **Save settings**. The new name shows at the top left.

### Test 7: The free student limit
**Account:** basic.teacher1@rollcol.test, and Supabase. **Where:** Supabase SQL Editor, then Website.

1. In Supabase > SQL Editor, lower the limit for this test:
   ```sql
   insert into private.config (key, value) values ('workspace_free_students', '3')
   on conflict (key) do update set value = excluded.value;
   ```
2. On the website, in the workspace, add a fourth pupil. You see: "Free workspaces can have up to 3 students in all. Remove students you no longer teach to add others." Nothing is added.
3. Put the limit back:
   ```sql
   delete from private.config where key = 'workspace_free_students';
   ```
4. Add the fourth pupil again. It works now (the limit is back to 50).

### Test 8: A lecturer's courses workspace
**Account:** uni.lecturer1@rollcol.test. **Where:** Website.

1. Sign in, open **Your account > Start a workspace**. Choose **Courses**, name it `Dr. Ocran, Anatomy`, enter your name and phone number. Click **Create workspace**.
2. The menu shows: Overview, **Attendance** (Sessions, Venues, Reports, Phones), **Students**, **Academics** (Courses, Semesters), Settings, Your account. No Staff, Programmes or Batches.
3. The **Workspace code** card says students enter it in the RollCol app with their student ID. **Write the code down** for Test 9.
4. **Academics > Semesters:** add `Semester 1` from 2 weeks ago to 10 weeks from today.
5. **Academics > Courses:** add `ANA 201`, `Gross Anatomy`, for Semester 1. It is ready straight away (no "Waiting for approval"), with Mr. Daniel Ocran as its lecturer and no Add lecturer or Remove buttons.
6. **Attendance > Venues:** add a venue at your current location (as in Part 5).
7. **Settings:** the **Students** card reads "Students can join with the workspace code" (on) and "You approve each new student" (off). There is no Lecturers card.

### Test 9: A student joins the workspace and checks in
**Account:** student1@rollcol.test on your iPhone, and uni.lecturer1@rollcol.test on the website. **Where:** App and Website.

1. **App** (student1): open **Account > Your schools and workspaces** and tap **Join a school or workspace as a student**. Enter the **School or workspace code** from Test 8, school ID `RGN25001` and the name `Abena Mensah`, and tap **Join school**.
2. She joins straight away. The list shows Dr. Ocran, Anatomy as **Student in a workspace**. Choose it.
3. **Courses:** join **ANA 201**.
4. **Website** (uni.lecturer1, in Dr. Ocran, Anatomy): **Attendance > Sessions**, start a session for ANA 201 at your venue, with the QR code shown.
5. **App** (student1): check in as in Part 5 (Face ID, location, scan the code). It succeeds.
6. **Website:** the live count goes to 1. **Students** lists Abena Mensah.
7. **App:** switch back to Test: Accra Nursing College. Her college courses are still there; the workspace does not mix with the school.

### Test 10: The platform page
**Account:** your own account. **Where:** Website.

1. Open **RollCol platform** (bottom of the menu).
2. The description says how many teacher and lecturer workspaces there are, "(never verified)".
3. Mr. Ankrah's extra classes, Dr. Ocran, Anatomy and Test: My lectures each have a **Workspace** badge, show "Active" instead of "unverified", "Not used" for SMS, and have **Suspend** but **no Verify** button.
4. Schools waiting for verification are counted without the workspaces.

### Test 11: One person only
**Account:** your own account, and Supabase. **Where:** Supabase SQL Editor.

1. Try to add a second staff member to a workspace directly in the database:
   ```sql
   insert into public.staff (school_id, user_id, school_number, full_name, role)
   select s.id, (select id from auth.users where email = 'uni.lecturer2@rollcol.test'), 'T002', 'Second person', 'teacher'
   from public.schools s where s.name = 'Dr. Ocran, Anatomy';
   ```
   It fails with "A workspace is for one person. To work with colleagues, register a school."
2. Try to verify a workspace:
   ```sql
   update public.schools set status = 'verified' where name = 'Dr. Ocran, Anatomy';
   ```
   It fails with "Workspaces are not verified. Only schools are."

### Test 12: Delete a workspace
**Account:** the new account from Test 2. **Where:** Website.

1. Sign in with the second address. Open **Settings**, scroll to **Delete this workspace**.
2. Type `wrong name` and click **Delete workspace**: "Type the workspace name exactly as shown." Nothing is deleted.
3. Type `Test: My lectures` and click **Delete workspace**. You are taken to the page for starting a school or workspace (this account has nothing else).
4. To remove the account too: **Your account > Delete account** (or keep it for later tests).

---

## Part C: Weekly reports in the app

### Test 13: A class in weeks
**Account:** basic.teacher1@rollcol.test. **Where:** App.

1. Switch to **Test: Adenta Basic School** (Account > Your schools and workspaces).
2. Open **Reports**, tap **Basic 4**. At the top: **Week**, **All** and **Dates**, with **Week** chosen, arrows on each side of this week's dates (for example "16 to 22 Nov 2026") and "This week" under them.
3. The card shows how many school days this week had a register, and each pupil's "Attendance X out of Y" counts only those days. If this week has no registers yet, you see "No registers were taken this week. Use the arrows to see other weeks."
4. Tap the **left arrow**: last week. Under the dates: **Back to this week**. Tap the left arrow again, then once more: "No registers were taken this week."
5. Tap **Back to this week**.
6. Tap **All**: "Whole term: Term 1", **10 school days**. Kojo Antwi shows "Attendance 10 out of 10" and **100%**.
7. Tap **Dates**. Two boxes, **From** and **To**. Tap **From**: a calendar opens (Monday first, arrows for months). Choose a day in the first test week. Tap **To** and choose a day in the second week. The list counts only those days.
8. Choose a **To** date before the **From** date. RollCol swaps them.
9. In the calendar, tap outside it or **Cancel**: nothing changes.

### Test 14: Sharing follows the view
**Account:** basic.teacher1@rollcol.test. **Where:** App.

1. On Basic 4, choose **Week** and go to a week with registers. Tap **Share as a spreadsheet**. The file name ends with that week's dates (for example `basic-4-2026-11-16-to-2026-11-22.csv`). Save or send it, and open it: only that week's days.
2. Choose **All** and share again: the file is named like `basic-4-term-1.csv` and has all 10 days.

### Test 15: A course in weeks
**Account:** uni.lecturer1@rollcol.test. **Where:** App.

1. Switch to **Test: Accra Nursing College**. Open **Reports > NUR 101**.
2. **Week** shows only that week's sessions ("No sessions were held this week" in a week without any). Use the arrows to reach the week with the 5 sessions.
3. **All**: 5 sessions; Yaw Ofori shows "2 of 5 sessions" and a red **40%**.
4. **Dates** and sharing work as in Tests 13 and 14.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
