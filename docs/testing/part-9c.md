# Testing Part 9c: pickup codes and absence reports

What this part adds:

- **Pickup codes:**
  - When someone else collects a child, the parent makes a six-digit code in the app or on the website, with the collector's name (and phone, if they like). They share it, for example by WhatsApp from the app.
  - A teacher types the code in the app (**Today > Check a pickup code**) or on the website (**Pickups**). RollCol shows the child, the class, the collector and the parent.
  - The teacher confirms the release, and the parent is told who collected the child, when and from whom.
  - A code works once, for one child, only on its day, and the parent can cancel it. Staff never see the codes themselves, and ten wrong codes in an hour stop the checks.
- **Absence reports:**
  - The parent tells the school ahead that a child will be absent, for up to two weeks, with a reason (Sick, Family matter, Travelling, Other) and an optional note. They can cancel it.
  - The class teacher is notified, the register shows "Parent reported absent" next to the child, and **no absence alert** is sent for those days.
  - The school sees all reports under **Absence reports**.
- **Fix:** the app's register now uses RollCol's own dialog for "Submit with children not marked?" instead of the phone's built-in alert.

**Where:** Website, https://rollcol.vercel.app on your computer. App, the development build on your iPhone.

**Accounts** (password `RollCol-Test-2026`)
- **Parent**: your phone number (linked to Abena Mensah, Adwoa Amoah and Akosua Appiah in Basic 4)
- **basic.teacher1@rollcol.test**: Samuel Ankrah, Basic 4's class teacher
- **basic.admin@rollcol.test**: Grace Adjei, admin

## Installation

1. Extract `rollcol-part9c.zip` into the project folder, replacing files when asked.
2. Update the database. It should list `20261206000000_pickups_absences.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
3. Commit and push, then wait for Vercel to finish.
4. App: from `apps/mobile`, run `pnpm exec expo start --dev-client --clear`. No new build.

You need two signed-in places at once: the parent in the **app**, and a teacher on the **website** (or the other way round).

## Tests

### Test 1: a parent makes a pickup code in the app

1. **App**, as the parent: **Children**, tap **Abena Mensah**, scroll down. Expected: **Pickup codes** with **Make a pickup code**, and **Absences you reported** with **Report an absence**.
2. Tap **Make a pickup code**. Type **Uncle Kofi** as **Who collects**, leave the phone empty, keep **Today**, tap **Make a code**.
3. Expected: a big six-digit code, "Works once, today...", **Share the code** and **Done**.
4. Tap **Share the code**. Expected: the phone's share sheet with a message such as "RollCol pickup code for Abena Mensah: 284599...". Close it, tap **Done**.
5. Expected on Abena's screen: the code and **Uncle Kofi**, with **Cancel**.

### Test 2: a teacher checks the code on the website

1. **Website**, as **basic.teacher1@rollcol.test**: open **Pickups** (under Attendance).
2. Expected: **Today** lists Abena Mensah, Basic 4, Uncle Kofi, **Waiting**. No code is shown.
3. Under **Check a code**, type `000000` and click **Check**. Expected: "No code for today matches..."
4. Type the real code and click **Check**. Expected: a green box with **Abena Mensah**, **Basic 4**, **Collected by Uncle Kofi**, **Code made by Test Parent (parent, in RollCol)**, and **Release Abena**.
5. Click **Release Abena**, then **Release Abena** in RollCol's dialog. Expected: "Released. The parent has been told." **Today** shows **Released** with the time and **by Samuel Ankrah**.
6. **App**, as the parent: expected a notification: "Abena Mensah was collected by Uncle Kofi at 2:45pm. Released by Samuel Ankrah." It is listed under **Notifications** (not Messages). On Abena's screen, the code shows **Collected**.
7. **Website**: type the same code again and click **Check**. Expected: "No code for today matches..." (a code works once).

### Test 3: a code checked in the app, and cancelled codes

1. **Website**, as the parent (Parent tab sign-in): **Children > Adwoa Amoah**. Under **Pickup codes**, type **Auntie Ama** and phone `024 555 0000`, keep **Today**, click **Make a code**. Expected: "Code 123456 is ready for Auntie Ama..." and the code in the list.
2. **App**: sign out, sign in as **basic.teacher1** (School ID `BT001`). On **Today**, under the registers, tap **Check a pickup code**. Type the code, tap **Check**. Expected: **Adwoa Amoah**, Basic 4, **Auntie Ama · 024 555 0000**, and **Release Adwoa**. Tap **Check another code** (do not release).
3. **Website**, as the parent: click **Cancel** next to Auntie Ama's code, then confirm. Expected: **Cancelled**.
4. **App**, as the teacher: check the same code. Expected: "No code for today matches..."

### Test 4: a parent reports an absence

1. **Website**, as the parent: **Children > Akosua Appiah**. Under **Report an absence**, choose **From** today, **To** tomorrow, **Reason** Sick, note "Fever", and click **Report absence**. Expected: "Reported. The class teacher has been told." and the report listed with **Cancel**.
2. **App**, as **basic.teacher1**: expected a notification "Absence reported: Akosua Appiah", with the days, "Sick. Fever. Reported by a parent in RollCol."
3. **Website**, as **basic.teacher1@rollcol.test**: open **Absence reports**. Expected: Akosua Appiah, Basic 4, the two days with a **Today** badge, Sick and "Fever".
4. **App**, as **basic.teacher1**: open today's **Basic 4** register. Expected: under Akosua Appiah, "Parent reported absent: Sick (Fever)" in amber. The same shows on the website's register page.

### Test 5: no absence alert for a reported day

1. **App**, as **basic.teacher1**, Basic 4 register: mark **Akosua Appiah** and **Adwoa Amoah** **Absent**, everyone else **Present**, and submit. Leave one child unmarked first, to see RollCol's own "Submit with children not marked?" dialog, then mark them and submit.
2. Wait 15 minutes (the alert delay).
3. **App**, as the parent (sign back in with your number). Expected:
   - **Messages** has an alert for **Adwoa** ("was absent from school");
   - **no** alert for Akosua, because you reported her absence.

### Test 6: the parent cancels a report in the app

1. **App**, as the parent: **Children > Akosua Appiah**. Expected: under **Absences you reported**, today and tomorrow, "Sick · Fever", with **Cancel**.
2. Tap **Report an absence**. Choose **Tomorrow** to the day after, reason **Family matter**, tap **Report absence**. Expected: back on Akosua's screen, with both reports.
3. Tap **Cancel** on the new one, then **Cancel it**. Expected: it disappears. **Website**, as the teacher, **Absence reports**: it shows as **Cancelled**.
