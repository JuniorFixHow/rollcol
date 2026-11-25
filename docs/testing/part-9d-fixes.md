# Testing Part 9d fixes: quiet hours, the parent header, and "A different day"

What these fixes change:

- **Why Adwoa's alert did not come:** it was made at 05:29, but the school's quiet hours (9:00pm to 7:00am) held it, in the app too, until 7:00am. The same happened to the school day notice. Quiet hours now hold **SMS only**. Parents who use the app get messages and alerts at once. An SMS, including the SMS sent when a notification cannot reach the phone, still waits until the quiet hours end.
- **The send dialog** on the website Messages page now appears only when credits are used (it says when the SMS will go if it is quiet hours).
- **The parent header:** Messages, Notifications and Account are now icons at the top right, with unread counts. The tabs (app) and links (website) are **Children**, **Pickups** and **Absences**.
- **A different day:** the class tick boxes appear only when **For** is **Some classes**, and the arrival and closing times only when **What changes** is **Different times**.

**Where:** Website, https://rollcol.vercel.app on your computer. App, the development build on your iPhone. Supabase, the SQL Editor.

**Accounts** (password `RollCol-Test-2026`): the parent (your number), **basic.admin@rollcol.test** (admin), **basic.teacher1@rollcol.test** (Basic 4's class teacher, School ID `BT001`).

## Installation

1. Delete these five files. They have moved, and the app shows an error while the old copies remain:
   - `apps/mobile/src/app/parent/(tabs)/messages.tsx`
   - `apps/mobile/src/app/parent/(tabs)/notifications.tsx`
   - `apps/mobile/src/app/parent/(tabs)/account.tsx`
   - `apps/mobile/src/app/parent/pickups.tsx`
   - `apps/mobile/src/app/parent/absences.tsx`
2. Extract `rollcol-part9d-fixes.zip` into the project folder, replacing files when asked.
3. Update the database. It should list `20261209000000_app_messages_now.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
   This also releases anything the quiet hours are holding for the app right now.
4. Commit and push, then wait for Vercel to finish.
5. App: from `apps/mobile`, run `pnpm exec expo start --dev-client --clear`. No new build.

## Test 1: the parent header in the app

1. **App**, signed in as the **parent**: the tabs at the bottom are **Children**, **Pickups** and **Absences**.
2. At the top right of each tab are three icons: messages, the bell, and the person. Unread messages and unread notifications show a red count on their icons.
3. Tap the **messages** icon: Messages opens with a back arrow. Open a message, go back twice: you are on the tab you came from.
4. Tap the **bell**: Notifications opens. Tap the **person**: Account opens, with Add a child, Change my number and the rest as before.
5. On **Children**, the "For the school" rows for Pickup codes and Absences are gone (they are tabs now). **Pickups** shows "Make a pickup code"; **Absences** shows "Report an absence".

## Test 2: the parent header on the website

1. **Website**, sign in as the **parent** (Sign in > Parent).
2. The header shows **Children**, **Pickups** and **Absences** as links, and three icons at the top right: messages, the bell, and the person. Unread counts show on the first two.
3. Click each icon: Messages, Notifications and Account open, and the icon you are on is highlighted.
4. Make the window narrow (phone width): the logo and the icons stay on the first line, the links move to a second line.

## Test 3: "A different day" form

1. **Website**, as **basic.admin@rollcol.test**: **Attendance > School day**, the **A different day** card.
2. **For** is **The whole school**: no class tick boxes show. Choose **Some classes**: the classes appear. Choose **The whole school** again: they hide.
3. **What changes** is **Different times**: Arrival and Closing show. Choose **School is closed**: they hide.

## Test 4: a message during quiet hours reaches the app at once

1. **Website**, as **basic.admin@rollcol.test**: **Settings**, the SMS section. Note your current quiet hours so you can put them back. Set **Quiet hours start** to an hour before now and **Quiet hours end** to an hour after now (Ghana time). Save.
2. **Attendance > School day > A different day**: Day tomorrow, **School is closed**, For **The whole school**, Note `Quiet hours test`, **Tell the parents** ticked. Save.
3. **App**, as the **parent**, within about a minute: a notification arrives from the school, and the messages icon shows a count. Open it: it says the school is closed tomorrow.
4. **Website**, as the admin: the change has a **Cancel** button; cancel it so tomorrow is a normal day again.
5. **Settings:** put your quiet hours back and save.

## Test 5: Adwoa's absence alert during quiet hours

1. Repeat step 1 of Test 4 (quiet hours around now).
2. **App**, as **basic.teacher1@rollcol.test**: open today's **Basic 4** register. Change **Adwoa Amoah** to **Present** and save, then to **Absent** and save.
3. **App**, as the **parent**, within about a minute: a notification that Adwoa is absent, and it is in **Messages**. (If the school sends arrival alerts you may also get one for the Present mark.)
4. **Settings:** put your quiet hours back and save.

## Test 6: the send dialog

1. **Website**, as the admin, during quiet hours (as in Test 4 step 1): **Messages**, write a message to a class and click Send.
2. If it uses credits, the dialog shows how many, says the SMS waits until the quiet hours end, and that parents who use the app get it at once. Click **Cancel** so no credits are used. If it uses no credits, it sends without a dialog.
3. **Settings:** put your quiet hours back and save.
