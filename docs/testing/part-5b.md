# Testing Part 5b: the mobile app, and the website changes

Part 5b brings check-in to the phone, and adds the website changes you asked for: a phone-friendly website, grouped menu, search bars, and lecturers adding courses.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **Phone browser**: Safari on your iPhone, opening the website
- **App**: the RollCol app on your iPhone (the new development build from Part A)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (all use the password `RollCol-Test-2026`, all in "Test: Accra Nursing College" unless shown)

| Account | Who | Notes |
|---|---|---|
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin | |
| uni.lecturer1@rollcol.test | Mr. Daniel Ocran, lecturer | NUR 101, GSC 103 |
| uni.lecturer2@rollcol.test | Mrs. Gifty Amponsah, lecturer | ANA 102 |
| student1@rollcol.test | Abena Mensah, student (RGN25001) | Use this student on your iPhone |
| student2@rollcol.test | Kwame Owusu, student (RGN25002) | Only for Test 15 |
| basic.teacher1@rollcol.test | Teacher at Test: Adenta Basic School | |

**One phone, one student.** The first student who signs in on your iPhone binds it to their account, as it would for a real student. Use **student1** on your iPhone for every student test. Test 15 shows what happens when someone else tries.

---

## Part A: Installation

Do these once, in this order, in the project folder on your computer.

### A1. Code and database

1. **Extract** `rollcol-part5b.zip` into the project folder, replacing files when asked.
2. **Delete two old files.** They moved into the new tabs, and the app will not start while the old copies exist:
   - `apps/mobile/src/app/(app)/index.tsx`
   - `apps/mobile/src/app/(app)/account.tsx`
3. **Install packages** (the app gets its new native modules):
   ```
   pnpm install
   ```
4. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261123000000_part5b.sql`.
5. **Deploy the two senders again** (they now say which one replied, for the platform page):
   ```
   pnpm exec supabase functions deploy send-sms --no-verify-jwt
   pnpm exec supabase functions deploy send-push --no-verify-jwt
   ```
6. **Check the push sender's address is set.** Supabase > SQL Editor, run `select key from private.config;`. It must list `push_sender_url` (added in Part 5a). If it is missing, add it as in the README under **Push notifications (Part 5)**.
7. **Reload the test data:** in Supabase > SQL Editor, run `supabase/test-data/remove.sql`, then `supabase/test-data/load.sql` (with your email and phone at the top, as before).
8. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.

### A2. The app on your iPhone (a new development build)

This build includes everything Parts 5 to 8 need (location, camera, Face ID, notifications, sharing and "Continue with Stediis"), so you should not need another build until launch. Run these from the `apps/mobile` folder.

1. **Check for a project ID.** Open `apps/mobile/app.json` and look for `"extra": { "eas": { "projectId": ... } }`. If it is not there, run:
   ```
   npx eas-cli@latest init
   ```
   and choose to create the project. (Do not delete `app.json`; the new `app.config.ts` only adds to it.)
2. **Register your iPhone** if this Apple team has not built for it before (you did this for Stediis, so it is probably already there):
   ```
   npx eas-cli@latest device:create
   ```
3. **Start the build:**
   ```
   npx eas-cli@latest build --profile development --platform ios
   ```
   - Sign in to your Apple account when asked.
   - When asked **"Would you like to set up Push Notifications for your project?"**, answer **Yes**, and let EAS create the key.
   - The build takes about 15 to 25 minutes in the cloud.
4. **Install it:** open the link EAS shows (or scan its QR code) on your iPhone and install. If iOS says the developer is not trusted: Settings > General > VPN & Device Management > trust your team. If it asks for Developer Mode: Settings > Privacy & Security > Developer Mode > On, then restart.
5. **Run the app's code:** in the project folder on your computer run
   ```
   pnpm dev:mobile
   ```
   Open the new **RollCol** app on your iPhone. It finds your computer on the same Wi-Fi; or scan the QR code in the terminal with the iPhone camera.

Android (optional, only if you also test on an Android phone): Android notifications need a Firebase project. See the README section **Mobile development build (Part 5b)**. Everything else works on Android without it.

---

## Part B: Website

### Test 1: The website fits a phone

- **Where:** Phone browser. **Account:** uni.admin@rollcol.test
1. Sign in. Open **Sessions**, **Students**, **Venues** and **Settings**.
2. **Expected:** no page scrolls sideways. Long dropdowns (Course, Where) stay inside the screen. Wide tables scroll sideways inside their own box only.
3. At the top there is the RollCol mark, the current page's name, and a **Menu** button. Tap **Menu**.
4. **Expected:** a panel slides in from the right with the school name, the menu in groups, the theme choice and **Sign out**. Tap **Close**, or outside the panel, to close it.

### Test 2: Menu groups

- **Where:** Website (computer). **Account:** uni.admin@rollcol.test
1. **Expected:** the sidebar shows **Overview**, then three groups: **Attendance** (Sessions, Venues, Phones), **People** (Students, Staff), **Courses** (Courses, Programmes, Batches, Semesters), then **Settings** and **Your account**.
2. The group of the page you are on is open. Click another group's name: it opens or closes.
3. **Account:** basic.admin@rollcol.test. **Expected:** Attendance has Registers and Messages; the third group is called **Classes**.

### Test 3: Search bars

- **Where:** Website. **Account:** uni.admin@rollcol.test
1. Open **Students**. Above the list there is a search box. Type `kwame`. **Expected:** only Kwame Owusu, and "Showing 1 of 18." under the list.
2. Type `25004`. **Expected:** Kofi Boateng (school ID RGN25004).
3. Type `zzz`. **Expected:** "Nothing matches "zzz"."
4. **Expected:** the same search box on Staff, Courses, Venues, Sessions, Phones, Programmes and Batches.

### Test 4: Lecturers add courses (with approval)

- **Where:** Website. **Account:** uni.lecturer2@rollcol.test
1. Open **Courses**. In **Add a course you teach**, enter Course code `mid 201`, Title `Midwifery Practice`, Semester **First semester**, and click **Add course**.
2. **Expected:** "MID 201 added. You are its lecturer." It is listed with a yellow **Waiting for approval** label.
3. Add `MID 201` again. **Expected:** "MID 201 already runs in First semester. Ask an admin to add you as a lecturer."
4. Open **Sessions**. Start a session for **MID 201**. **Expected:** "This course is waiting for an admin to approve it."
5. **Account:** uni.admin@rollcol.test, **Courses**. **Expected:** MID 201 shows **Waiting for approval** with an **Approve** button. Click it and confirm. The label goes away.
6. **Account:** uni.admin@rollcol.test, **Settings**, card **Lecturers**. Untick **Courses added by lecturers need an admin's approval** and save.
7. **Account:** uni.lecturer2@rollcol.test, **Courses**. Add `MID 202`, `Antenatal Care`. **Expected:** listed straight away, with no waiting label.
8. As the admin, tick the approval box again and save.

### Test 5: A venue at your location (needed for the check-in tests)

- **Where:** Phone browser. **Account:** uni.lecturer1@rollcol.test
1. Stand where you will test check-in (your room). Open **Venues**.
2. Name `My Room`, Radius `75`, tap **Use my current location** and allow location. **Expected:** the coordinates fill in, with the accuracy.
3. Tap **Save venue**. **Expected:** "My Room saved. Other lecturers can use it now; an admin will verify it."

---

## Part C: The app

### Test 6: Tabs for each kind of account

- **Where:** App.
1. **Account:** uni.lecturer1@rollcol.test (sign in with the email). **Expected:** tabs at the bottom: **Today**, **Sessions**, **Account**.
2. Account tab > **Sign out**. **Account:** basic.teacher1@rollcol.test. **Expected:** **Today** (today's registers, as before) and **Account**.
3. Sign out. **Account:** student1@rollcol.test. **Expected:** **Today**, **Courses**, **Notifications**, **Account**.
4. **Expected:** iOS asks to allow notifications. Tap **Allow**. (If you tap Don't Allow, the app still works, but you get no notifications.)

Stay signed in as student1 for Tests 7 to 13.

### Test 7: Pull-down hint and this phone

- **Where:** App. **Account:** student1@rollcol.test
1. On **Today**, the top shows "Pull down to refresh". Pull down. **Expected:** the screen refreshes and the hint disappears for good.
2. Open **Account**. **Expected:** a **This phone** section: "iPhone 12 Pro Max. Your check-in phone. Each student checks in from one phone."

### Test 8: Courses and attendance

- **Where:** App. **Account:** student1@rollcol.test
1. Open **Courses**. **Expected:** "Your courses · First semester" lists ANA 102, GSC 103 and NUR 101, and NUR 101 shows something like "4 of 5 classes · 4 marks" with a percentage.
2. Tap **NUR 101**. **Expected:** the five past classes, each **Present** or **Missed**, with the total at the top.
3. Go back. Under **Other courses this semester**, MID 201 (approved in Test 4) has a **Join** button. Tap it, then **Join** in the dialog. **Expected:** it moves up to your courses with "0 of 0 classes".

### Test 9: Check in (the full flow)

- **Where:** Website on your computer. **Account:** uni.lecturer1@rollcol.test
1. Open **Sessions**. Start a session: Course **NUR 101**, Open for **30**, Where **My Room (75 m), unverified**, Marks **1**, Rotating code ticked, every **15** seconds, Start **Now**.
2. Keep the session page open on the computer screen (the QR code is showing).
- **Where:** App. **Account:** student1@rollcol.test
3. **Expected:** within about a minute, a notification "NUR 101 is open. Check in before (time)." Today shows NUR 101 under **Open now**, with **Location**, **Scan code** and **1 mark** labels.
4. Tap **Check in**.
5. **Expected:** Face ID asks to confirm (the first time, iOS asks whether RollCol may use Face ID: allow).
6. **Expected:** "Finding your location..." (the first time, iOS asks for location: choose **Allow While Using App**).
7. **Expected:** the camera opens (the first time, allow the camera). Point it at the QR code on the computer screen.
8. **Expected:** a short vibration and "You're checked in. NUR 101 at (time), N m from the class. 1 mark."
- **Where:** Website, the session page.
9. **Expected:** without reloading, the count goes up by one, and Abena Mensah shows **Checked in** with the distance.

### Test 10: What stops a check-in

- **Where:** App. **Account:** student1@rollcol.test (with the session from Test 9 still open)
1. On Today, NUR 101 now shows **Checked in at (time)** and no button.
2. **Photo of the code:** on the computer, end the session (**End now**) and start a new NUR 101 session the same way. Take a photo of the QR code with another phone (or a screenshot), wait one minute, then check in from the app and scan the photo. **Expected:** "Scan the code on your lecturer's screen again. It changes every few seconds."
3. Tap **Try again** and scan the live code on the computer. **Expected:** checked in.
4. **Too far away:** on the computer, end that session and start one at **Main Lecture Hall (75 m)** instead (somewhere else in Accra). Check in from the app. **Expected:** "You are about N metres from the class. Check-in works within 75 metres."
5. End the session on the computer.

### Test 11: A lecturer runs a session from the app

- **Where:** App. Sign out of student1 (Account > Sign out). **Account:** uni.lecturer1@rollcol.test
1. Open the **Sessions** tab. **Expected:** **Start a session** and **Add a course** buttons, your courses this semester (GSC 103, NUR 101), and the past two weeks.
2. Tap **Start a session**. Choose **GSC 103**, Where **Here (my location)**, keep Rotating code on, and tap **Start session**. (Allow location if asked.)
3. **Expected:** the session screen: "0 of 18 checked in, closes in 30 min", an **Open** label, a large QR code that changes every 15 seconds, and the student list. The screen does not dim or lock while the code shows.
4. Tap **Add** next to any student. RollCol's dialog asks for a reason. Tap **Mark present** with no reason: "Give a reason." Enter `Battery died` and confirm. **Expected:** they show **Present** with "added by hand", and the count goes up.
5. Tap **End now** and confirm. **Expected:** **Ended**, the QR code disappears, and there are no Add buttons (your school only lets admins change attendance after a session ends).
6. Go back to the **Sessions** tab and tap **Add a course**. Enter `GSC 205`, `Academic Writing`, tap **Add course**. **Expected:** back on Sessions, GSC 205 is listed with **Waiting for approval**.

### Test 12: Notifications

- **Where:** App. Sign out, then **Account:** student1@rollcol.test
1. **Expected:** the **Notifications** tab has a red number. Open it. **Expected:** notifications such as "NUR 101 is open", "NUR 101: present" (sent after a session closes), and the red number clears.
2. Swipe a notification to the left. **Expected:** a red **Remove** area, and the notification is gone.
3. Tap **Clear all** and confirm. **Expected:** the list is empty.

### Test 13: Reinstalling keeps the phone

- **Where:** iPhone. **Account:** student1@rollcol.test
1. Delete the RollCol app from the iPhone. Install the development build again from the EAS link, run `pnpm dev:mobile`, and sign in as student1.
2. Open **Account**. **Expected:** This phone still says "Your check-in phone" (no 48-hour wait), because RollCol recognises the same phone.

### Test 14: The SMS sender card is not confused by notifications

- **Where:** Website. **Account:** your own account (platform owner). Open `/platform`.
1. **Expected:** the **SMS sender** card reflects only SMS replies, even after notifications were sent in Test 12.

### Test 15: A second student on the same phone

- **Where:** App. Sign out of student1. **Account:** student2@rollcol.test
1. **Expected:** on Today: "This phone is registered to another student. Each student checks in from their own phone." Kwame cannot check in from your iPhone.
2. Sign out and sign back in as **student1** for normal use.
