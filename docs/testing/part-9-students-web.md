# Testing students on the website

What this adds:

- **Students now have their own pages on the website,** instead of the old "Students use the RollCol app" page. The menu has **Courses**, **Notifications** and **Account**.
- **Courses:** each course with the classes attended and the attendance rate. Classes **open now** are listed with a note to check in with the app. Students can also join other courses this semester.
- **A course:** every class, with **Present**, **Missed**, **Open** or **Cancelled**, and the marks.
- **Notifications:** the same list as the app, with **Remove** and **Clear all**.
- **Account:**
  - your schools and workspaces, with **Show** to switch, and joining another school or a lecturer's workspace;
  - the same notification settings as the app;
  - Appearance, **Change password**, **Sign out** and **Delete my account**.
- **Checking in stays in the app,** because it needs the phone's location and the student's one registered phone. The website says so wherever it matters.
- **Signing up on the website:** a student who signs up and confirms their email there now joins their school straight away and lands on their courses. Before, they had to open the app.

**Where:** Website, https://rollcol.vercel.app on your computer, and on your phone's browser where a step says so. App, the development build on your iPhone.

**Accounts** (password `RollCol-Test-2026`)
- **student1@rollcol.test**: Abena Mensah, a student at Test: Accra Nursing College (School ID `RGN25001`)
- **uni.lecturer1@rollcol.test**: Mr. Daniel Ocran, who lectures NUR 101

## Installation

1. Extract `rollcol-part9-students-web.zip` into the project folder, replacing files when asked. No migration, no function and no app change.
2. Commit and push, then wait for Vercel to finish.

## Tests

### Test 1: a student signs in on the website

1. **Website**, signed out: **Sign in**, tab **Email**, as **student1@rollcol.test**.
2. Expected: **Your courses** for Test: Accra Nursing College, with the semester, and the menu **Courses**, **Notifications** and **Account**. On a wide screen, the school's name shows beside the menu.
3. Expected: each course you are enrolled in (for example **NUR 101**) with "X of Y classes", the marks if any, the lecturers, and a coloured percentage. The numbers match the app's **Courses** tab.

### Test 2: one course

1. **Website**, as **student1@rollcol.test**: click **NUR 101**.
2. Expected: "X of Y classes attended (Z%)", then each class with its date and time and **Present**, **Missed** or **Cancelled**, as in the app.
3. Click **Your courses** to go back.

### Test 3: a class open now

1. **App**, as the lecturer: open a class for **NUR 101**, as in Part 5b.
2. **Website**, as **student1@rollcol.test**: refresh **Courses**. Expected: an **Open now** card with NUR 101, its times and **Check in in the app**.
3. **App**, as Abena (student1), check in. **Website**: refresh. Expected: **Checked in**.
4. **App**, as the lecturer: close the class.

### Test 4: notifications

1. **Website**, as **student1@rollcol.test**: open **Notifications**. Expected: the same notifications as the app (for example the class you just opened), newest first. The count in the menu clears.
2. Click **Remove** on one. Expected: it disappears here and in the app.

### Test 5: account

1. **Website**, as **student1@rollcol.test**: open **Account**. Expected:
   - **Your schools and workspaces**: Test: Accra Nursing College, with its code, **School ID RGN25001** and **Showing**;
   - **Join another school or a lecturer's workspace** (closed until clicked);
   - **Check-in phone**, saying the phone is managed in the app;
   - **Notifications**: **Classes** and **Check-in reminders**;
   - **Appearance**;
   - **Change password**, **Sign out** and **Delete my account**.
2. Turn **Check-in reminders** off. **App**, as Abena: **Account > Notifications**. Expected: off there too. Turn it back on.
3. If Abena also belongs to a lecturer's workspace (Part 7), it is listed with **Show**. Click **Show**. Expected: **Courses** shows that workspace's courses, and the workspace is marked **Showing** in Account.

### Test 6: students and staff stay in their own areas

1. **Website**, as **student1@rollcol.test**: go to `https://rollcol.vercel.app/dashboard`. Expected: you land on **Your courses**.
2. Go to `https://rollcol.vercel.app/parent`. Expected: you land on **Your courses** too.
3. **Account > Sign out.**

### Test 7: on a phone's browser

1. **Phone browser**: sign in as **student1@rollcol.test**.
2. Expected: the menu fits under the RollCol logo, and the courses and classes are easy to read without sideways scrolling.
