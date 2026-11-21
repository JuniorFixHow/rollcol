# Testing Part 5a: tertiary sessions (web)

Part 5a is the lecturer and admin side of check-in sessions, on the **website only**. Nothing changes in the mobile app yet: students check in from the app in Part 5b. Where a test needs a student to check in, you run a short SQL snippet in Supabase that does exactly what a student's phone will do.

**Where things happen**
- **Website**: https://rollcol.vercel.app (or http://localhost:3000 if you run it locally)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**
- **Phone browser**: Safari on your iPhone, opening the website (only for one venue step)

**Test accounts** (all use the password `RollCol-Test-2026`, all in "Test: Accra Nursing College")

| Account | Role | Courses |
|---|---|---|
| uni.admin@rollcol.test | Admin | All |
| uni.lecturer1@rollcol.test | Lecturer | NUR 101, GSC 103 |
| uni.lecturer2@rollcol.test | Lecturer | ANA 102 |

---

## Part A: Installation

Do these once, in this order, on your Windows computer in the project folder (`rollcol`).

1. **Extract** `rollcol-part5a.zip` into the project folder, replacing files when asked.
2. **Install packages** (the website gets a small QR code library called `uqr`):
   ```
   pnpm install
   ```
3. **Update the database** (adds venues, phones, sessions and check-ins):
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261122000000_sessions.sql`.
4. **Deploy the push sender** (it waits until phones register in Part 5b):
   ```
   pnpm exec supabase functions deploy send-push --no-verify-jwt
   ```
5. **Tell the database where the push sender is.** Supabase > SQL Editor > New query, paste, replace `YOUR-PROJECT-REF` with your project reference (the same one in `sms_sender_url`), and click **Run**:
   ```sql
   insert into private.config (key, value) values
     ('push_sender_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-push')
   on conflict (key) do update set value = excluded.value;
   ```
6. **Reload the test data.** Supabase > SQL Editor: open `supabase/test-data/remove.sql` from the project, paste it and **Run**. Then do the same with `supabase/test-data/load.sql` (first change `my_email` and `my_phone` at the top to your own, as before). It now also adds a venue, "Main Lecture Hall", and five past NUR 101 sessions.
7. **Publish the website.** Commit and push to GitHub so Vercel deploys it, and wait for the deployment to finish. (Or run `pnpm dev:web` and use http://localhost:3000.)

---

## Part B: Test procedure

Do the tests in order. Each one says where and as whom.

### Test 1: Lecturer menu and past sessions

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. Sign in.
2. **Expected:** the sidebar shows **Sessions** (and no Registers).
3. Click **Sessions**. **Expected:** under "Past two weeks", five NUR 101 sessions at 09:00, each about 14 of 18 checked in, status **Ended**.
4. Click one of them. **Expected:** the student list shows who checked in at 09:05 and how many metres away, and who **Missed**.

### Test 2: Start a session

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. Click **Sessions**. In **Start a session**, fill in:
   - Course: **NUR 101: Foundations of Nursing**
   - Open for: **30**
   - Where: **Main Lecture Hall (75 m)**
   - Radius: leave empty
   - Marks: **1**
   - Rotating code: leave ticked
   - Start: **Now**
2. Click **Start session**.
3. **Expected:** the session page opens with:
   - a green **Open** label at the top right;
   - **Checked in: 0 of 18** and a countdown ("29:58 left") ticking every second;
   - a QR code on the right that changes every 15 seconds (watch it for a while);
   - all 18 students listed as **Not yet**.
4. Click **Show full screen** under the QR code. **Expected:** the code fills the screen. Press **Esc** to come back.

**Keep this page open** in your browser for Test 3.

### Test 3: Live count (a student checks in while you watch)

Here you watch the lecturer's page update by itself when a student checks in. In Part 5b this happens when a student taps Check in on their phone. For now, the SQL below records the same check-in in the database.

1. **Where:** Website, the session page from Test 2, still open. Don't reload it.
2. **Where:** Supabase, in another browser tab. Open **SQL Editor > New query**, paste this and click **Run**:
   ```sql
   insert into public.session_checkins (session_id, student_id, school_id, method, distance_m, accuracy_m)
   select s.id, st.id, s.school_id, 'self', 14, 10
   from public.attendance_sessions s
   join public.students st on st.school_id = s.school_id and st.school_number = 'RGN25001'
   where s.voided_at is null and now() between s.starts_at and s.ends_at;
   ```
   Supabase should say "Success" (1 row).
3. Switch back to the website tab, **without reloading**.
4. **Expected:** within about two seconds the count shows **1 of 18**, and **Abena Mensah** moves to the top with a green **Checked in**, "14 m away".
5. Back in Supabase, change `RGN25001` to `RGN25002` and run it again. **Expected:** on the website, **2 of 18**, with **Kwame Owusu** added.

If the count only changes after you reload, the live updates are not reaching the browser: tell me, and say whether the Supabase dashboard shows `session_checkins` under **Database > Publications > supabase_realtime**.

### Test 4: Marking a student present by hand

- **Where:** Website, same session page. **Account:** uni.lecturer1@rollcol.test
1. On any student showing **Not yet**, click **Mark present**.
2. **Expected:** RollCol's own dialog opens (not a browser pop-up), asking for a reason.
3. Leave the reason empty and click **Mark present** in the dialog. **Expected:** "Give a reason." in red.
4. Type **Battery died** and click **Mark present**.
5. **Expected:** the dialog closes; the student shows **Added by hand** with "Battery died"; the count goes up by one; a **Changes** list at the bottom says "Marked present: (name)", the time, "by Mr. Daniel Ocran", and the reason.

### Test 5: Removing a check-in

- **Where:** Website, same session page. **Account:** uni.lecturer1@rollcol.test
1. On **Kwame Owusu** (checked in in Test 3), click **Remove**, type **Not in class**, confirm.
2. **Expected:** he goes back to **Not yet**, the count goes down by one, and Changes records it.

### Test 6: Starting a second session for the same course

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. Click **Sessions**. Start another session for **NUR 101**, Start: **Now**.
2. **Expected:** a red message: this course already has a session at that time.
3. Now choose Where: **No location check (rotating code only)**, untick **Rotating code**, and click Start session.
4. **Expected:** "Without a venue, use the rotating code, or students could check in from anywhere."

### Test 7: Ending and cancelling

- **Where:** Website, the NUR 101 session page from Test 2. **Account:** uni.lecturer1@rollcol.test
1. Click **End now** and confirm in the dialog.
2. **Expected:** the label changes to **Ended**, the countdown says "Closed", the QR code disappears, and students who did not check in show **Missed**. **Mark present** still works (corrections are allowed for 14 days).
3. Click **Cancel session**, type **Opened for the wrong course**, confirm.
4. **Expected:** a red notice "This session was cancelled" with your reason, the label says **Cancelled**, and the Mark present and Remove buttons are gone.

### Test 8: Scheduling a session for later

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. Click **Sessions**. Start a session for **GSC 103**, Start: **Later**, Start time: tomorrow at 09:00.
2. **Expected:** the session page shows **Scheduled** and "Opens at 09:00". On the Sessions page it is under "Open and scheduled".
3. On the session page, click **Cancel** and confirm. **Expected:** you are back on Sessions and it is gone.
4. Try Start: **Later** with a time earlier today. **Expected:** refused, with a message to choose a time that has not passed.

### Test 9: Another lecturer cannot see your courses

- **Where:** Website. **Account:** uni.lecturer2@rollcol.test
1. Sign out, and sign in as uni.lecturer2@rollcol.test.
2. Click **Sessions**. **Expected:** the Course list only offers **ANA 102**, and the past NUR 101 sessions are not listed.

### Test 10: Venues

- **Where:** Website. **Account:** uni.admin@rollcol.test
1. Sign in as the admin. **Expected:** the sidebar also shows **Venues** and **Phones**.
2. Click **Venues**. **Expected:** "Main Lecture Hall", 75 m. Click its coordinates: Google Maps opens at that spot.
3. In **Add a venue**, type Name **Test Hall**, Radius **20**, any latitude and longitude, and Save. **Expected:** "At least 50 metres."
4. Set the radius to **60** and Save. **Expected:** "Test Hall saved." and it appears in the list.
5. Save another venue named **Test Hall**. **Expected:** "A venue with that name already exists."
6. **Where:** Phone browser (Safari on your iPhone), same admin account, Venues page. Tap **Use my current location** and allow location. **Expected:** latitude and longitude fill in, with "Accurate to about N metres." Save it as **My Location** with radius 75. (This is the venue you will use in Part 5b to check in from where you are.)
7. Back on the computer, click **Remove** on Test Hall and confirm. **Expected:** it is gone.

### Test 11: The admin runs any course

- **Where:** Website. **Account:** uni.admin@rollcol.test
1. Click **Sessions**. **Expected:** the Course list offers all three courses.
2. Start a session for **ANA 102** at **My Location**, then end it with **End now**.

### Test 12: Approving a new phone

Phones are registered by the mobile app in Part 5b. This SQL makes it look as if Abena Mensah signed in on a new phone.

1. **Where:** Supabase > SQL Editor. Paste and **Run**:
   ```sql
   insert into public.devices (user_id, secret_hash, label, platform, status, is_first)
   select user_id, encode(extensions.digest('test-old-phone', 'sha256'), 'hex'), 'Old Android', 'android', 'active', true
   from public.students where school_number = 'RGN25001';
   insert into public.devices (user_id, secret_hash, label, platform, status, active_from)
   select user_id, encode(extensions.digest('test-new-phone', 'sha256'), 'hex'), 'Tecno Spark 20', 'android', 'pending', now() + interval '48 hours'
   from public.students where school_number = 'RGN25001';
   ```
2. **Where:** Website. **Account:** uni.admin@rollcol.test. Click **Phones**.
3. **Expected:** Abena Mensah, new phone **Tecno Spark 20**, current phone **Old Android**, becoming active in 48 hours.
4. Click **Approve now**, read the dialog, confirm. **Expected:** the list is empty ("No phone changes waiting").

---

## What comes in Part 5b (mobile app)

- Students check in from the app: location, fingerprint or face, and scanning the rotating code.
- The app binds the student's phone and registers for notifications.
- Lecturers start sessions from the app using their phone's location, and watch the count.
