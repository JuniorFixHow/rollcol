# Testing parents on the website

What this adds:

- **Parent sign-in on the website:** a **Parent** tab on the sign-in page. A parent types the phone number the school has, gets a six-digit code by SMS, and signs in. No password.
- **The parent pages:** the same as the app, with a menu of **Children**, **Messages**, **Notifications** and **Account**. Messages and Notifications show unread counts.
- **Children:** each child's mark today and this term's "Attendance X out of Y". Click a child for the week view with arrows.
- **Add your child:** linking by one of a child's names, as in the app.
- **Messages:** two-line previews with a dot on new ones. Click one to read it in full; you can delete one message or all of them.
- **Notifications:** notices about the account and links, with **Remove** and **Clear all**.
- **Account:** the schools with their children (**Remove**, **Add a child**), the same notification settings as the app, Appearance, **Sign out**, and **Delete my account**.
- **Separate areas:** parents cannot open the school dashboard, and staff cannot open the parent pages. Each is sent to their own.
- **Fix:** on the school's **Messages** page, each message now really shows only two lines (it showed everything before).

**Where:** Website, https://rollcol.vercel.app on your computer, and on your phone's browser where a step says so. App, the development build on your iPhone.

**Accounts** (password `RollCol-Test-2026`): the parent (your number), **basic.admin@rollcol.test**.

## Installation

1. Extract `rollcol-part9-parents-web.zip` into the project folder, replacing files when asked. No migration, no function and no app change.
2. Commit and push, then wait for Vercel to finish.

## Tests

### Test 1: the school's message list shows two lines

1. **Website**, as **basic.admin@rollcol.test**: open **Messages**.
2. Expected: the long PTA message from the last test shows only two lines, ending with "...". Clicking it still opens the whole message.
3. Sign out (top right menu, **Sign out**).

### Test 2: parent sign-in on the website

1. **Website**, signed out: open **Sign in**. Expected: three tabs, **School ID**, **Email** and **Parent**, and "For school admins, teachers and parents."
2. Click **Parent**, type `020 000 0001`, and click **Send code**. Expected: "This number is not on your child's school records in RollCol..."
3. Type your own number and click **Send code**. Expected: "We sent a code to ..." with a **Code** box, **Sign in**, **Send a new code** and **Use another number**. The SMS arrives.
4. Type `000000` and click **Sign in**. Expected: "That code is not right, or it has expired..."
5. Type the code from the SMS and click **Sign in**. Expected: the **Your children** page, with the menu **Children**, **Messages**, **Notifications** and **Account** at the top.

### Test 3: children and the week view

1. **Website**, as the parent, **Children**. Expected: a card for each child (the three Basic 4 children and Kwame Owusu), with **Today** and "Attendance X out of Y". The numbers match the app.
2. Click **Abena Mensah**. Expected: this week, Monday to Friday, each with its mark, and the week's attendance under it.
3. Click **‹**. Expected: last week, and **Back to this week**. The **›** arrow works until this week, then is dimmed.

### Test 4: messages

1. **Website**, as **basic.admin@rollcol.test** in another browser (or a private window): send "Test: Website messages check." to **Basic 4**.
2. **Website**, as the parent: refresh. Expected: **Messages** in the menu shows a count.
3. Click **Messages**. Expected: the new message at the top with a blue dot, two lines at most per message. The count in the menu clears.
4. Click the message. Expected: its page with the school, the label, the time and the whole text, and **Delete**.
5. Click **Delete**, then confirm in RollCol's dialog. Expected: back on Messages, without it. **App**, Messages: it is gone there too.
6. Click **Delete all**, then confirm. Expected: "No messages yet."

### Test 5: notifications

1. **Website**, as **basic.admin@rollcol.test**: **People > Parent app**, **Remove** Test Parent's link.
2. **Website**, as the parent: refresh. Expected: **Notifications** in the menu shows a count, and **Children** no longer shows the Basic 4 children.
3. Open **Notifications**. Expected: **Link removed**, and the count clears. Click **Remove** on it. Expected: it disappears.
4. **Website**, as the parent: **Children > Add your child** (or **Account > Add a child**), type `Akosua`, click **Link**. Expected: back on Children with the three Basic 4 children.

### Test 6: account

1. **Website**, as the parent: open **Account**. Expected:
   - your number and "Parent account";
   - **Your children's schools**, with each school's children and **Remove**, and **Add a child**;
   - **Notifications**, with **Absent and late**, **In school** and **School messages**;
   - **Appearance**;
   - **Sign out** and **Delete my account**.
2. Turn **School messages** off. **App**, **Account > Notifications**. Expected: **School messages** is off there too. Turn it back on in the app, refresh the website: on.
3. Choose **Dark** under Appearance. Expected: the page turns dark. Choose **Auto** again.

### Test 7: parents and staff stay in their own areas

1. **Website**, as the parent: go to `https://rollcol.vercel.app/dashboard`. Expected: you land back on **Your children**.
2. Click **Account > Sign out**. Sign in with **Email** as **basic.admin@rollcol.test**, then go to `https://rollcol.vercel.app/parent`. Expected: you land on the school dashboard.

### Test 8: on a phone's browser

1. **Phone browser**: sign in as the parent on the website.
2. Expected: the menu fits under the RollCol logo (swipe it sideways if it does not all fit), and the children's cards are one per row. Messages and the week view are easy to read.
