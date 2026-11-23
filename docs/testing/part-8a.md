# Testing Part 8a: staff notifications, notification settings and complete reports

Part 8 comes in two pieces. This first piece fixes what Part 7b testing found:

- **Staff get push notifications.** Before, only students registered their phone, so notifications to teachers, lecturers and admins went nowhere ("Workspace not moved" in 7b Test 3). Staff now register their phone for notifications when they sign in to the app (no phone binding; that stays for students' check-in). Signing out stops notifications on that phone.
- **Notifications tab for staff**, like students have.
- **Notification settings:** **Account > Notifications** in the app. Students choose **Classes** and **Check-in reminders**; staff choose **Workspace moves**. Security notices (your account signing in on a new phone) are always sent. A turned-off notification still appears in the Notifications tab, just without a banner or sound.
- **Reports include every pupil with marks.** A class report used to show only the pupils who are in that class now, so Abena Mensah, whose own class is Basic 4, disappeared from **Basic 4 (moved)** although her marks were there. Now everyone marked in the class's registers in the dates shown is listed. The student page shows other classes under **Also marked in**.

Part 8b (billing with Paystack, the Billing page and the public Pricing page) follows.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol app on your iPhone (the development build you already have)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who |
|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin of Test: Adenta Basic School |
| basic.teacher1@rollcol.test | Samuel Ankrah, teacher at Test: Adenta Basic School |
| student1@rollcol.test | Abena Mensah, student at Test: Accra Nursing College |

You use one iPhone, so the tests sign in and out of the app between accounts.

---

## Part A: Installation

1. **Extract** `rollcol-part8a.zip` into the project folder, replacing files when asked.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261130000000_push_settings_reports.sql`.
3. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.
4. **The app:** no new build is needed. Run
   ```
   pnpm dev:mobile
   ```
   and open the RollCol app on your iPhone.

---

## Part B: Staff notifications

### Test 1: An admin is told about a move request
**Account:** basic.admin@rollcol.test in the App, basic.teacher1@rollcol.test on the Website.

1. **App:** sign out of whichever account is signed in (**Account > Sign out**). Sign in as **basic.admin@rollcol.test**.
2. The iPhone asks whether RollCol may send notifications. Tap **Allow**. (If you allowed it before for another account, it does not ask again.)
3. The tabs now include **Notifications**.
4. **Website** (basic.teacher1): if Samuel has no workspace now, start one (**Your account > Start a workspace**, Classes). In its **Settings > Move into a school**, ask to move with the code of Test: Adenta Basic School.
5. **App:** within about a minute a notification arrives: **Workspace move request**, "Samuel Ankrah asks to move the workspace ... into Test: Adenta Basic School. Review it on the RollCol website." It is also in the **Notifications** tab.
6. **Website** (basic.admin): decline it with the reason `Testing notifications`.

### Test 2: The owner is told about a decline
**Account:** basic.teacher1@rollcol.test in the App and on the Website, basic.admin@rollcol.test on the Website.

1. **App:** **Account > Sign out**, then sign in as **basic.teacher1@rollcol.test**.
2. **Website** (basic.teacher1): ask to move again.
3. **Website** (basic.admin): decline it with the reason `Second test`.
4. **App:** a notification arrives: **Workspace not moved**, "Test: Adenta Basic School declined moving ...: Second test".
5. **Signing out stops notifications:** the admin was signed out of the app in step 1, so the request in step 2 did **not** reach this phone as "Workspace move request". Check the Notifications tab: only Samuel's notifications are there.

### Test 3: Notification settings for staff
**Account:** basic.teacher1@rollcol.test. **Where:** App, then Website.

1. Open **Account**. Under **Your schools and workspaces** there is a new row **Notifications**. Tap it.
2. You see one switch, **Workspace moves**, turned on, and a line saying security notices are always sent.
3. Turn **Workspace moves** off.
4. **Website** (basic.teacher1 asks again, and basic.admin declines with any reason).
5. **App:** no banner or sound this time. Open the **Notifications** tab: "Workspace not moved" is still listed there.
6. Turn **Workspace moves** back on.

### Test 4: Notification settings for students
**Account:** student1@rollcol.test. **Where:** App.

1. **Account > Sign out**, then sign in as **student1@rollcol.test**.
2. **Account > Notifications:** two switches, **Classes** and **Check-in reminders**, both on. No Workspace moves.
3. Turn **Check-in reminders** off, go back, open Notifications settings again: it is still off. Turn it back on.

### Test 5: Notifications turned off on the phone
**Account:** any. **Where:** iPhone Settings, then App.

1. In the iPhone's **Settings > Notifications > RollCol**, turn **Allow Notifications** off.
2. In the app, open **Account > Notifications**: a card **Notifications are off** with **Open Settings**. Tap it: the iPhone's settings for RollCol open.
3. Turn notifications back on and return to the app: the card is gone.

---

## Part C: Reports

### Test 6: A joined pupil appears in the moved class
**Account:** basic.admin@rollcol.test. **Where:** Website.

This uses **Basic 4 (moved)** from Part 7b Test 5. If you reloaded the test data since, do Part 7b Tests 1, 2 and 5 again first.

1. Open **Attendance > Reports > Basic 4 (moved)**, then **All**.
2. The register lists **both Abena Mensah and Different Child**, each with the days they were marked.
3. On **Attendance > Reports**, the Basic 4 (moved) row counts both pupils.
4. Open **People > Students > Abena Mensah**. The **Attendance** card shows her own class (Basic 4) as before, and below it **Also marked in**: **Basic 4 (moved)** with "Attendance X out of Y". Click it: the moved class's report opens.
5. **App** (sign in as basic.teacher1): **Reports > Basic 4 (moved) > All** also lists Abena.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
