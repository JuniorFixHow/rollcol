# Testing the Part 6 fixes

What changed:

- **Report views:** class and course reports open on **this week**, with arrows to move a week at a time (like Google Calendar). **All** shows the whole term or semester (the register scrolls sideways as before). **Date range** shows the dates you choose. Downloads (Excel and CSV) and printing contain only what the view shows.
- **Printing and Save as PDF:** only the report is printed: school, title, dates, the register and a key. No page title, web address, date or page numbers from the browser, no menu, buttons or explanations.
- **Test data:** marks used to be random on every load, which is why your Kojo Antwi showed 90% and the guide said 70%. They are now the same on every load, so the numbers in the guides match what you see. Ekow Mensah (Basic 5) is now the pupil below 75%.
- **Page not found:** a designed page, inside the dashboard menu when you are signed in.
- **Menu:** the group that held Classes (or Courses), Terms, Programmes and Batches is now called **Academics**.
- **Your account:** staff can change their own name (in every school they belong to) and their email.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **Phone browser**: Safari on your iPhone, opening the website
- **Supabase**: your RollCol project in the Supabase dashboard, then **SQL Editor > New query**

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who | School |
|---|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin | Test: Adenta Basic School |
| basic.teacher1@rollcol.test | Samuel Ankrah, teacher of Basic 4 | Test: Adenta Basic School |
| shs.admin@rollcol.test | Richard Asamoah, admin | Test: Labone SHS |
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin | Test: Accra Nursing College |
| Your own account | You, admin of the three test schools | |

**About the weeks.** The test data has registers on the 10 weekdays before the day you load it (two weeks), and NUR 101 sessions on the last 5. If you load it on a Saturday or Sunday, "this week" has registers. If you load it on a weekday, this week only has the days before today, and on a Monday it has none yet; press the left arrow to see last week.

---

## Part A: Installation

1. **Extract** `rollcol-part6-fixes.zip` into the project folder, replacing files when asked. No new packages this time.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261126000000_report_views_account.sql`.
3. **Reload the test data** (important: the marks have changed): in Supabase > SQL Editor, run `supabase/test-data/remove.sql`, then `supabase/test-data/load.sql` (with your email and phone at the top, as before).
4. **Check one Supabase setting for the email test:** Supabase > **Authentication > URL Configuration**. Under **Redirect URLs** there must be `https://rollcol.vercel.app/**` (it is there if sign-up confirmation works).
5. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.

---

## Part B: Report views

### Test 1: Week view and the arrows
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. Open **Attendance > Reports** and click **Basic 5**.
2. Above the register you see **Week**, **All** and **Date range**, with **Week** chosen, two arrows, and "Week of ..." with this week's dates (for example "Week of 16 to 22 Nov 2026").
3. The register shows **Monday to Friday** of that week. Days without a register (today and later, or a public holiday) are faded and empty, and a line under the register says "Faded days had no register." The totals count only days with a register, for example "4 out of 5" in a week of 5 registers.
4. Click the **left arrow**. The register moves to the week before, and the address ends with `?week=` and that Monday's date. A **This week** button appears.
5. Click the left arrow again. You are now in the first test week. Click it once more: "No registers were taken for this class this week. Use the arrows to see other weeks." and no download buttons.
6. Click **This week**. You are back on the current week.
7. Click the **right arrow** past this week. Next week is empty, as expected.

### Test 2: Downloads follow the week
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. On the Basic 5 report, go to a week with registers (use the arrows).
2. Click **Download Excel**. The file name ends with that week's dates (for example `basic-5-2026-11-16-to-2026-11-22.xlsx`). Open it: the third line reads "Week of 16 to 22 Nov 2026" and the register has only that week's days.
3. Click **Download CSV**. It has only that week's days too.

### Test 3: All
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. On the Basic 5 report, click **All**. The bar reads "Whole term: Term 1".
2. The register has all **10** school days and scrolls sideways, with the names fixed on the left.
3. **Ekow Mensah** shows "6 out of 10" and a red **60%**. In the **For report cards** card, he has a red **Below 75%** badge.
4. Click **Download Excel**. The file is named like `basic-5-term-1.xlsx`, its third line reads "Term: Term 1", and it has all 10 days.
5. Open **Basic 4** from Reports and click **All**: **Kojo Antwi** shows "10 out of 10" and **100%**.

### Test 4: Date range
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. On the Basic 5 report, click **Date range**. A **From** and a **To** date appear, filled with this week's Monday and today.
2. Choose a From date in the first test week and a To date in the second (for example Wednesday to the following Tuesday), and click **Show**.
3. The register shows only the school days from From to To, and the bar shows the range (for example "11 to 17 Nov 2026"). The totals count only those days.
4. Put the To date before the From date and click **Show**. RollCol swaps them and shows the range the right way round.
5. Click **Download Excel**: the file has only the chosen days, and its third line shows the range.

### Test 5: Per-subject summary in a week
**Account:** shs.admin@rollcol.test. **Where:** Website.

1. Open **Attendance > Reports > Form 2 Science**. Use the arrows to find the week with registers.
2. The **By subject** card counts only that week's lessons (at most 5 per subject).
3. Click **All**. The By subject card now counts the whole term.

### Test 6: Course weeks
**Account:** uni.admin@rollcol.test. **Where:** Website.

1. Open **Attendance > Reports > NUR 101**. It opens on this week, with the same Week, All and Date range bar.
2. Use the arrows to reach the week with the NUR 101 sessions. Only that week's sessions show.
3. Click **All**: all 5 sessions. **Yaw Ofori** shows "2 of 5" and a red **40%**, **Kwabena Osei** "3 of 5" and a red **60%**.
4. Download Excel in a week view and in All, and check each file has only the sessions shown.

---

## Part C: Printing and Save as PDF

### Test 7: Only the report is printed
**Account:** basic.admin@rollcol.test. **Where:** Website (Chrome or Edge on your computer).

1. Open the Basic 5 report in a week with registers. Click **Print or save as PDF**.
2. In the print preview you see one landscape page with only:
   - the school name, "Basic 5 attendance register" and "Week of ..." at the top, with "Printed" and today's date on the right;
   - the register with coloured P, L and A, and the totals;
   - one line explaining P, L, A and "(low)".
3. There is **no** page title, web address, date or page number from the browser at the edges, no menu, no buttons, no Week/All bar, and no "For report cards" card. If the browser still shows its own header and footer, open **More settings** and check that **Headers and footers** is not ticked.
4. Choose **Save as PDF** and open the PDF: the same.
5. Click **All**, then **Print or save as PDF**: all 10 days fit across the page width.
6. Repeat on the NUR 101 report (uni.admin@rollcol.test): the course sheet prints the same way.

### Test 8: Printing from the phone
**Account:** basic.admin@rollcol.test. **Where:** Phone browser.

1. Open the Basic 5 report and tap **Print or save as PDF**.
2. The print preview shows only the report, as in Test 7.

---

## Part D: Page not found

### Test 9: Signed out
**Account:** none (sign out first, or use a private window). **Where:** Website.

1. Go to `https://rollcol.vercel.app/no-such-page`.
2. You see the RollCol logo at the top, a small register drawing with a question mark, "Error 404", **This page is absent** and a short explanation.
3. Click **Go to the home page**: the home page opens. Go back, and click **Go back**: you return to the page before.

### Test 10: Signed in
**Account:** basic.teacher1@rollcol.test. **Where:** Website, then Phone browser.

1. Sign in. Paste the Basic 5 report address (copy it as basic.admin) or type `https://rollcol.vercel.app/dashboard/reports/class/00000000-0000-0000-0000-000000000000`.
2. The same design shows inside the dashboard, with the menu still there, and the button **Go to the overview**.
3. Do the same on your iPhone: the drawing, text and buttons fit the screen.

---

## Part E: Menu names

### Test 11: Academics
**Account:** uni.admin@rollcol.test, then basic.admin@rollcol.test, then basic.teacher1@rollcol.test. **Where:** Website.

1. As uni.admin: the menu groups are **Attendance**, **People** and **Academics**. Academics holds Courses, Programmes, Batches and Semesters.
2. As basic.admin: **Academics** holds Classes and Terms.
3. As basic.teacher1: there is just a **Classes** link (a group with one link shows only the link).

---

## Part F: Your account

### Test 12: Change your name
**Account:** basic.teacher1@rollcol.test. **Where:** Website.

1. Sign in and open **Your account** (at the bottom of the menu).
2. The new **Your details** card has **Full name** ("Samuel Ankrah") and **Email** (basic.teacher1@rollcol.test).
3. Change the name to `Mr. Samuel Ankrah` and click **Save name**. You see "Your name is saved." The menu at the top left now reads "Mr. Samuel Ankrah, Teacher".
4. Use the school switcher to open **Test: Labone SHS**. The name is "Mr. Samuel Ankrah" there too.
5. Clear the name and click **Save name**: "Enter the full name." and nothing changes.
6. Sign in as basic.admin@rollcol.test in another browser and open **People > Staff**. The teacher shows as "Mr. Samuel Ankrah".
7. Back as the teacher: the **Sign-in details** card still shows the school code and school ID, which only an admin can change.

### Test 13: Change your email
**Account:** your own account. **Where:** Website, then your email inbox.

Test accounts cannot receive emails, so use your own account and a second address of yours. With Gmail, adding `+rollcol` before the @ gives a new address that still arrives in your inbox (for example `yourname+rollcol@gmail.com`).

1. Sign in with your own account and open **Your account**.
2. Type the same email you have now and click **Change email**: "This is already your email."
3. Type `basic.admin@rollcol.test` and click **Change email**: "Another RollCol account already uses this email."
4. Type your second address and click **Change email**. You see "We sent a link to ... Your email changes when you open it."
5. Reload the page. A note says it is waiting for you to confirm the new address, and you still sign in with the old one.
6. Open your inbox. Supabase may send two emails (one to the old address and one to the new, when "Secure email change" is on); open the link in each. The second link opens **Your account**, now showing the new email.
7. Sign out and sign in with the **new** email and your usual password. It works.
8. As basic.admin@rollcol.test, open **People > Staff** in Test: Adenta Basic School: your row shows the new email.
9. **Change it back** the same way (steps 4 to 7 with your original email), so the test data's top line still matches your account.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
