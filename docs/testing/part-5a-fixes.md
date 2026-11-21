# Testing the Part 5a fixes (web)

These are the changes from your Part 5a feedback. Everything is on the **website**; nothing changes in the mobile app.

**Where things happen**
- **Website**: https://rollcol.vercel.app (or http://localhost:3000 if you run it locally)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**
- **Phone browser**: Safari on your iPhone, opening the website

**Test accounts** (password `RollCol-Test-2026`)

| Account | School | Role |
|---|---|---|
| uni.admin@rollcol.test | Test: Accra Nursing College | Admin |
| uni.lecturer1@rollcol.test | Test: Accra Nursing College | Lecturer (NUR 101, GSC 103) |
| uni.lecturer2@rollcol.test | Test: Accra Nursing College | Lecturer (ANA 102) |
| basic.admin@rollcol.test | Test: Adenta Basic School | Admin |

---

## Part A: Installation

On your computer, in the project folder:

1. **Extract** `rollcol-part5a-fixes.zip` into the project folder, replacing files when asked.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261122010000_session_rules.sql`.
3. **Reload the test data.** Supabase > SQL Editor: paste `supabase/test-data/remove.sql` and **Run**, then paste `supabase/test-data/load.sql` (with your email and phone at the top, as before) and **Run**.
4. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish deploying. (Or run `pnpm dev:web`.)

No `pnpm install` is needed this time.

---

## Part B: Test procedure

### Test 1: Start time only for "Later"

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test. **Page:** Sessions.
1. In **Start a session**, look at **Start**: **Now** is chosen. **Expected:** there is no start time box.
2. Choose **Later**. **Expected:** a **Start time** box appears.
3. Choose **Now** again. **Expected:** the box disappears.

### Test 2: How often the code changes

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test. **Page:** Sessions.
1. **Expected:** under **Rotating code** (ticked) there is **Code changes every (seconds)** set to **15**.
2. Untick **Rotating code**. **Expected:** the seconds box disappears. Tick it again.
3. Set the seconds to **5**, choose NUR 101, Where: Main Lecture Hall, and click **Start session**. **Expected:** "At least 10 seconds." in red under the box, and above the button: "One field needs attention: see the message in red above."
4. Set it to **20** and start. **Expected:** the session page says "It changes every 20 seconds" under the QR code, and the code changes about every 20 seconds.
5. Click **End now** and confirm (you will need the course free for Test 4).

### Test 3: No venue and no rotating code

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test. **Page:** Sessions.
1. Choose NUR 101, Where: **No location check (rotating code only)**, untick **Rotating code**, click **Start session**.
2. **Expected:** under the Rotating code box, in red: "Without a venue, use the rotating code, or students could check in from anywhere." **Rotating code stays unticked**, and Where still shows "No location check".

### Test 4: My current location

- **Where:** Phone browser. **Account:** uni.lecturer1@rollcol.test. **Page:** Sessions.
1. On your iPhone, open the website in Safari and sign in as the lecturer.
2. In **Start a session**, choose NUR 101 and set Where to **My current location (this device)**. Allow location when Safari asks.
3. **Expected:** "Found, accurate to about N metres" with a **Check on the map** link that opens your position.
4. Click **Start session**. **Expected:** the session page shows "Lecturer's location (75 m)".
5. Click **End now** and confirm.
6. **Where:** Website on your computer, same account. Choose **My current location**. **Expected:** either it is found, or (most laptops) "Accurate to about N metres, which is too rough". Starting then gives a message to choose a venue or use the phone.

### Test 5: Lecturers add venues (unverified until an admin verifies)

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test.
1. **Expected:** the sidebar shows **Venues** (lecturers now see it). Open it.
2. Add Name **Lab 3**, Radius **60**, Latitude **5.6510**, Longitude **-0.1872**, click **Save venue**. **Expected:** "Lab 3 saved. Other lecturers can use it now; an admin will verify it." It is listed with a yellow **Unverified** label and "Added by you", and a **Remove** button.
3. Add another venue named **lab  3** (lowercase, two spaces). **Expected:** "\"Lab 3\" is already saved. Choose it from the list."
4. Add one named **main lecture hall**. **Expected:** "\"Main Lecture Hall\" is already saved."
5. Open **Sessions**. **Expected:** Where offers "Lab 3 (60 m), unverified".
6. **Account:** uni.lecturer2@rollcol.test, page **Venues**. **Expected:** Lab 3 is listed as added by Mr. Daniel Ocran, with **no Remove button** (only the lecturer who added it, or an admin, can remove it).
7. **Account:** uni.admin@rollcol.test, page **Venues**. **Expected:** a yellow notice "1 venue to verify". Lab 3 has **Verify** and **Remove**. Click **Verify** and confirm. **Expected:** it shows a green **Verified** label, and the notice is gone.

### Test 6: School rules for lecturers (Settings)

- **Where:** Website. **Account:** uni.admin@rollcol.test. **Page:** Settings.
1. **Expected:** a new **Sessions** card with three boxes:
   - Lecturers can add venues: **ticked**
   - Lecturers can remove a student who checked in themselves: **unticked**
   - Lecturers can change attendance after a session ends: **unticked**
2. Untick **Lecturers can add venues** and click **Save settings**.
3. **Account:** uni.lecturer1@rollcol.test, page **Venues**. **Expected:** no add form; a notice says only admins add venues. On Sessions, the Where hint says "Admins add halls on the Venues page", and "My current location" is still offered.
4. Back as the admin, tick it again and save.

### Test 7: Self check-ins cannot be removed by the lecturer

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test.
1. Start a NUR 101 session at Main Lecture Hall, Start: Now. Keep the page open.
2. **Where:** Supabase > SQL Editor. Run this (it does what Abena's phone will do in Part 5b):
   ```sql
   insert into public.session_checkins (session_id, student_id, school_id, method, distance_m, accuracy_m)
   select s.id, st.id, s.school_id, 'self', 14, 10
   from public.attendance_sessions s
   join public.students st on st.school_id = s.school_id and st.school_number = 'RGN25001'
   where s.voided_at is null and now() between s.starts_at and s.ends_at;
   ```
3. **Where:** Website, the session page (it updates by itself). **Expected:** Abena Mensah shows **Checked in** and has **no Remove button**. Under the list: "Students who checked in themselves passed every check (their own phone, location and the rotating code), so only an admin can remove them."
4. On another student, click **Mark present**, reason **Battery died**. **Expected:** they show **Added by hand**, and they **do** have a Remove button (a lecturer can undo their own addition).

### Test 8: No changes after the session ends (lecturer)

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test. **Page:** the session from Test 7.
1. Click **End now** and confirm.
2. **Expected:** no **Mark present** or **Remove** buttons at all, and the note "Your school only lets admins change attendance after a session ends."
3. **Account:** uni.admin@rollcol.test. Open **Sessions**, then this NUR 101 session.
4. **Expected:** the admin sees **Mark present** on absent students and **Remove** on everyone, including Abena. Remove Abena with the reason **Left after checking in**. **Expected:** she shows **Missed**, and **Changes** records it with the admin's name.
5. **Account:** uni.admin@rollcol.test, page **Settings**. Tick **Lecturers can change attendance after a session ends**, save. Back as **uni.lecturer1@rollcol.test** on the same session: **Expected:** Mark present is offered again.

### Test 9: Quiet hours times follow the switch

- **Where:** Website. **Account:** basic.admin@rollcol.test. **Page:** Settings, card **SMS to guardians**.
1. Untick **Hold SMS during quiet hours**. **Expected:** the two time boxes grey out and cannot be changed.
2. Click **Save settings**, reload the page. **Expected:** still unticked, and the times still show what they were (they are kept, just not used).
3. Tick it again. **Expected:** the times can be changed again. Save.

### Test 10: Messages do not stay after you leave a page

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test.
1. On **Venues**, try to add **Main Lecture Hall** again, so the red "already saved" message shows.
2. Click **Sessions** in the sidebar, then **Venues** again.
3. **Expected:** the red message is gone.

### Test 11: Programmes and batches have their own pages

- **Where:** Website. **Account:** uni.admin@rollcol.test.
1. **Expected:** the sidebar has **Programmes** and **Batches**, and the Courses page no longer has a "Programmes and batches" card.
2. **Programmes**: "Diploma in Registered General Nursing" with 1 batch and 18 students. Add **BSc Midwifery**, code **BMW**.
3. **Batches**: "2025 intake". In **Add a batch**, choose BSc Midwifery, Batch **2026 intake**, Entry year **-2025**, click **Add batch**. **Expected:** "Enter a year from 1990." The arrows on the year box stop at 1990 and next year.
4. Set the year to **2026** and add. **Expected:** listed with 0 students.

### Test 12: Phone check, unchanged (quick)

- **Where:** Website. **Account:** uni.admin@rollcol.test. **Page:** Phones. **Expected:** "No phone changes waiting" after a fresh load of the test data. (The full phone test is Test 12 of the Part 5a guide.)
