# Testing Part 6: records, reports and downloads

Part 6 turns the registers and check-ins into reports:

- **Basic and senior high schools:** a term register for each class (every pupil by every school day, P, L or A), each pupil's "Attendance X out of Y" for the terminal report, and a per-subject summary for schools that mark every period.
- **Tertiary:** a semester sheet for each course (every student by every session), and a download for a single session.
- **Downloads:** Excel (laid out like the register book, in colour), CSV (Comma Separated Values, which Excel and Google Sheets open), and print or save as PDF (Portable Document Format).
- **Flags:** a new setting, "Flag students below (%)", default 75. Students below it are marked everywhere.
- **Student page:** each student's attendance for the current term or semester.
- **App:** a Reports tab for teachers and lecturers, with sharing as a spreadsheet. When scheduling a session for Today, past times are hidden.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **Phone browser**: Safari on your iPhone, opening the website
- **App**: the RollCol app on your iPhone (the development build you already have)
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (all use the password `RollCol-Test-2026`)

| Account | Who | School |
|---|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin | Test: Adenta Basic School (registers once a day) |
| basic.teacher1@rollcol.test | Samuel Ankrah, class teacher of Basic 4 | Test: Adenta Basic School |
| shs.admin@rollcol.test | Richard Asamoah, admin | Test: Labone SHS (registers every period) |
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin | Test: Accra Nursing College |
| uni.lecturer1@rollcol.test | Mr. Daniel Ocran, lecturer | NUR 101, GSC 103 |
| uni.lecturer2@rollcol.test | Mrs. Gifty Amponsah, lecturer | ANA 102 |

**About the numbers below.** The test data creates registers for the 10 school days before the day you load it, and 5 NUR 101 sessions. The marks are the same on every load, so the numbers in this guide are what you see straight after loading. If you have run sessions or marked registers since, your numbers will differ a little.

**Reports open on this week.** Where a test below speaks of the whole term (10 school days), first click **All** above the register (see `part-6-fixes.md` for the week view).

---

## Part A: Installation

Do these once, in this order, in the project folder on your computer.

1. **Extract** `rollcol-part6.zip` into the project folder, replacing files when asked.
2. **Install packages** (the website gets `exceljs`, which writes the Excel files):
   ```
   pnpm install
   ```
3. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261125000000_reports.sql`.
4. **Reload the test data** so the numbers match this guide: in Supabase > SQL Editor, run `supabase/test-data/remove.sql`, then `supabase/test-data/load.sql` (with your email and phone at the top, as before).
5. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.
6. **The app:** no new build is needed (sharing was already in the build). In the project folder run
   ```
   pnpm dev:mobile
   ```
   and open the RollCol app on your iPhone.

---

## Part B: Website, basic school

### Test 1: The Reports page
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. Sign in. In the menu, open **Attendance**. You see a new link, **Reports**. Open it.
2. You see a card titled **Term 1** with a table of classes: **Basic 4** and **Basic 5**.
3. Check the columns: Students **12**, School days **10**, Attendance **95%** for Basic 4 and **89.2%** for Basic 5, and in "Below 75%" **0** for Basic 4 and **1** for Basic 5.
4. Type `5` in **Search classes**. Only Basic 5 is left. Clear it.
5. The line above the table says students below 75% are counted, with a link to **Settings**.

### Test 2: A class register
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. On Reports, click **Basic 5**, then click **All**.
2. The **Register** card shows every pupil down the side and the 10 school days across the top (for example "Mon 9 Nov"). Each cell is **P** (green), **L** (amber) or **A** (red).
3. Scroll the register sideways. The names stay on the left.
4. At the end of each row: Present, Late, Absent, **Attendance** (for example "9 out of 10") and **%**.
5. **Ekow Mensah** shows "6 out of 10" and a red **60%**. (In Basic 4, Kojo Antwi shows "10 out of 10" and **100%**.)
6. Below, the **For report cards** card lists each pupil as "Attendance X out of 10". Ekow Mensah has a red **Below 75%** badge. Under the table: "1 pupil is below 75%."
7. Click a pupil's name in the register. Their student page opens (see Test 6). Go back.

### Test 3: Downloads
**Account:** basic.admin@rollcol.test. **Where:** Website (with Excel, Numbers or Google Sheets to open the files).

1. On the Basic 5 report (with **All** chosen), click **Download Excel**. A file named like `basic-5-term-1.xlsx` downloads.
2. Open it. You see three lines at the top (school name, "Basic 5 attendance register", "Term: Term 1"), then the register in colour with the names fixed on the left.
3. Open the second sheet, **Report card line**: each pupil with "X out of 10" style attendance, and "Yes" under "Below 75%" for Ekow Mensah.
4. In Excel, choose **Print preview**: the register is on landscape pages, all days on one page width.
5. Back on the website, click **Download CSV**. Open it: the same register as plain rows (P, L, A).
6. Click **Print or save as PDF**. The print window opens in landscape, without the menu, the buttons or the term chips. Choose **Save as PDF** to keep a copy, or cancel.

### Test 4: Teachers see only their own classes
**Account:** basic.teacher1@rollcol.test. **Where:** Website.

1. Sign in. If you see a school switcher, choose **Test: Adenta Basic School**.
2. Open **Attendance > Reports**. Only **Basic 4** is listed (Samuel Ankrah is its class teacher).
3. Open Basic 4. The register and downloads work as in Tests 2 and 3.
4. **Try another class:** sign in as basic.admin@rollcol.test in another browser, open the Basic 5 report and copy its address. Paste it in the teacher's browser. You get **Page not found**. Try adding `/export?format=xlsx` to that address too: also **Page not found**, no file.

### Test 5: The threshold setting
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. Open **Settings**. Near the bottom there is a new **Reports** card with **Flag students below (%)**, set to **75**.
2. Change it to `95` and click **Save settings**. You see "Settings saved."
3. Open **Attendance > Reports**. The last column is now **Below 95%**, with higher numbers.
4. Open Basic 4 and click **All**: more pupils have red percentages and the report card line says "Below 95%".
5. **Wrong values:** in Settings try `0`, then `101`. Each time you see "Enter a percentage from 1 to 100." and nothing is saved.
6. Set it back to `75` and save.

### Test 6: A pupil's record
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. Open **People > Students** and click **Ekow Mensah**.
2. Near the top there is an **Attendance, Term 1** card: "Attendance 6 out of 10" with a red **60%, below 75%** badge.
3. Under it: how many present, late and absent, and a list of the days he was late or absent, newest first.
4. Click **See the class register**. The Basic 5 report opens.

---

## Part C: Website, senior high school (registers every period)

### Test 7: Per-subject summary
**Account:** shs.admin@rollcol.test. **Where:** Website.

1. Sign in. Open **Attendance > Reports**. You see **Form 2 Science** (and Form 2 Arts, with no data yet).
2. Open **Form 2 Science**. The register shows **5** school days. A day counts as present if the student was present (or late) in any period that day.
3. Below **For report cards** there is a **By subject** card: each student with English Language, Physics and Core Mathematics, **5** lessons each, and how many present, late and absent.
4. Click **Download Excel**. The file has a third sheet, **Subjects**, with the same table.

---

## Part D: Website, tertiary

### Test 8: Course reports
**Account:** uni.admin@rollcol.test. **Where:** Website.

1. Sign in. Open **Attendance > Reports**. You see **First semester** with ANA 102, GSC 103 and NUR 101 (code with the title under it).
2. NUR 101: Students **18**, Sessions **5**, Attendance **85.6%**, **2** below 75%. The other two show "Nothing yet".
3. Click **NUR 101**, then **All**. The **Sessions** card shows every student by every session (date and time across the top). **P** checked in, **P\*** added by a lecturer, **A** absent.
4. **Yaw Ofori** shows "2 of 5" and a red **40%**; **Kwabena Osei** shows "3 of 5" and a red **60%**. Under the grid: "2 students are below 75%."
5. Click a session date at the top. That session's page opens. Go back.
6. Click **Download Excel**, then **Download CSV**, then **Print or save as PDF**. Check them as in Test 3.

### Test 9: One session's download
**Account:** uni.admin@rollcol.test. **Where:** Website.

1. Open **Attendance > Sessions** and open any session that has ended.
2. At the top right, next to the status, there are **Download Excel** and **Download CSV**.
3. Download Excel. Each student with Present or Absent, the time, how (Checked in, or Added by lecturer), the distance in metres, and the reason for lecturer additions.
4. A session that is still **Scheduled** has no download buttons (nothing to download yet).

### Test 10: A student's courses
**Account:** uni.admin@rollcol.test. **Where:** Website.

1. Open **People > Students** and click **Abena Mensah** (RGN25001).
2. The **Attendance, First semester** card lists her courses: NUR 101 "5 of 5" with **100%**, and "No sessions yet" for the others.
3. Click **NUR 101**. The course report opens.

### Test 11: Lecturers see only their own courses
**Account:** uni.lecturer2@rollcol.test. **Where:** Website.

1. Sign in. Open **Attendance > Reports**. Only **ANA 102** is listed.
2. Open **People > Students** and click any student. There is **no** Attendance card (lecturers see attendance in their course reports).
3. Paste the NUR 101 report address from Test 8 into this browser. You get **Page not found**.

### Test 12: Reports on a phone
**Account:** basic.admin@rollcol.test. **Where:** Phone browser.

1. Sign in and open **Menu > Attendance > Reports**, then **Basic 4**.
2. The page fits the screen. The register scrolls sideways inside its card, with the names fixed on the left. The page itself does not move sideways.
3. Tap **Download Excel**. Safari offers to open or save the file.

---

## Part E: The app

### Test 13: Reports tab for teachers
**Account:** basic.teacher1@rollcol.test. **Where:** App.

1. Sign in (if you are signed in as a student, sign out first from **Account**). If asked, choose **Test: Adenta Basic School**.
2. A new **Reports** tab is at the bottom. Open it. You see **Term 1** and **Basic 4** with **95%** and "12 students · 10 school days".
3. Tap **Basic 4**. You see "10 school days", then each pupil with "Attendance X out of 10" and present, late and absent counts. Kojo Antwi shows "Attendance 10 out of 10" and **100%** (no pupil in Basic 4 is below 75%).
4. Type `kojo` in the search box. Only Kojo Antwi is left. Clear it.
5. Tap **Share as a spreadsheet**. The iPhone share sheet opens with a file named like `basic-4-term-1.csv`. Choose **Save to Files** (or send it to yourself on WhatsApp or by email), then open it: every pupil by every day, P, L or A.
6. Pull down on the list. It refreshes.

### Test 14: Reports tab for lecturers
**Account:** uni.lecturer1@rollcol.test. **Where:** App.

1. Sign in. You see the tabs Today, Sessions, **Reports** and Account.
2. Open **Reports**. You see **NUR 101** and **GSC 103** (not ANA 102).
3. Tap **NUR 101**: "5 sessions", 18 students, "2 below 75%". Each student shows how many of the 5 sessions they attended; Yaw Ofori has a red **40%**.
4. Tap **Share as a spreadsheet** and save or send the file as in Test 13.
5. **Students do not get this tab:** sign out, sign in as student1@rollcol.test. The tabs are Today, Courses, Notifications and Account, with no Reports.

### Test 15: Scheduling hides past times
**Account:** uni.lecturer1@rollcol.test. **Where:** App.

1. Open **Sessions** and tap **Start a session**. Choose **NUR 101**.
2. Under **Start**, tap **Later**. **Today** is selected.
3. The hours start from the current hour. For example at 2:20pm the first hour is **2pm**, and 6am to 1pm are not shown.
4. Tap the current hour (for example **2pm**). Only the minutes still ahead are shown (at 2:20pm: **:30** and **:45**).
5. Tap **Tomorrow**. All hours from 6am to 9pm come back, and all four minute choices.
6. Choose a time tomorrow, then tap **Today** again. If that hour has already passed today, the hour is cleared and the line under the chips asks you to choose the hour again.
7. **Late in the evening:** after 9:45pm there is nothing left today, so the day chips start at **Tomorrow**.
8. Leave this screen without starting (tap back).

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
