# Testing Part 3: registers, icons and themes

## Setup

1. Extract the Part 3 files and delete `apps/mobile/assets/expo.icon`.
2. `pnpm install` (adds `expo-crypto`).
3. `pnpm exec supabase db push --remote` (two migrations: registers, and the school deletion fix).
4. Load the test data: set your email and phone at the top of `supabase/test-data/load.sql`, then run it in the Supabase SQL Editor. Keep the result table open; it lists every sign-in.
5. Web: `pnpm dev:web`, or push to deploy on Vercel.
6. Mobile: build a new development build (`npx eas-cli build --profile development --platform ios` from `apps/mobile`), because the app has a new native package, icons and splash screens. Then `pnpm dev:mobile`.

Test accounts all use the password `RollCol-Test-2026`. Sign in with the email, or with the school code and school ID from the result table.

## Web

### Daily registers (basic school)

Sign in as **basic.teacher1@rollcol.test** (class teacher of Basic 4).

1. Open **Registers**. Basic 4 shows "Today's register" with 12 students and a Take register button. Basic 5 is not there (it is not your class).
2. Enter 1 in Marks and click **Take register**. The register opens.
3. Mark a few children Present, Late and Absent. The counts at the top change, and "All marks saved" appears after a moment.
4. Click a selected mark again: it clears (back to not marked).
5. Click **Mark the rest present**. Everyone unmarked becomes present.
6. Reload the page: every mark is still there.
7. Click **Submit register**. The badge changes to Submitted. Change one child from Absent to Late: allowed, because it is still the same day.
8. Go back to Registers: Basic 4 now shows Submitted and "12 of 12 marked".
9. Open **Classes > Basic 4**. The table shows Present, Late, Absent and Marks for the term per child (two weeks of history are loaded), and Recent registers lists the past days. Open one: as a teacher you can view it but not change it (earlier day).

Sign in as **basic.admin@rollcol.test**:

10. Registers shows both classes. The admin can open and correct any register, including earlier days.
11. **Settings > Registers**: change "Daily registers close at" and save. Start the Basic 5 register: the notice shows the new closing time.

### Per-period registers (SHS)

Sign in as **shs.teacher1@rollcol.test** (teaches Core Mathematics to both classes, and class teacher of Form 2 Science).

1. Registers lists Core Mathematics for both classes, plus the other Form 2 Science subjects (class teachers can cover them).
2. Start Form 2 Science, Core Mathematics, **Period 1**. Mark it.
3. Go back and try to start another subject for Form 2 Science in Period 1: refused ("Period 1 already has a register").
4. Start Core Mathematics again in **Period 2**: allowed (double periods).

### Periods in a day

1. As **shs.admin@rollcol.test**, open **Settings > Registers** and set "Periods in a school day" to 8. Start a register: the Period list goes up to 8.
2. Open **Classes > Form 2 Science** and set "Periods a day" to 14 (leave blank to follow the school). Its Period list now goes up to 14, while Form 2 Arts still stops at 8.
3. On the phone, the period buttons match the same numbers.

### Closing on its own

As **shs.admin@rollcol.test**, set "Period registers stay open for" to **10** minutes in Settings. Start a period register, wait 10 to 11 minutes and refresh: it shows Closed. You can still correct marks today.

### Two schools, one account

Sign in as **basic.teacher1@rollcol.test** again. The sidebar has a school picker (Adenta Basic School and Labone SHS). Switch to Labone SHS: Registers now shows that school, and Basic 4 is not there. Your own account is an admin of all three test schools.

### Fixes

- Hover any button: the pointer cursor shows.
- Staff (Allow a teacher), Courses (Add course), a class page (Subject teachers) and a student page (guardian): inputs and buttons in each row line up, and hints sit under the inputs.
- Sign up for a new school and choose basic or SHS: under "How are registers taken?" a note says it can be changed later in Settings.
- `/privacy` shows the full privacy policy with its contents list.
- The favicon is the new logo. Switch your computer to dark mode: the favicon and the whole site change. On the sidebar, choose Light, Dark or Auto: it applies straight away and is remembered after a reload.

## Mobile

1. The app icon is the new logo. On iPhone, long-press the home screen > Edit > Customize > Dark: the dark icon appears.
2. The splash screen is teal in light mode and dark in dark mode. On Android in dark mode, there is no white flash after the splash.
3. Sign in with school code + school ID as **basic.teacher1** (BT001). Home shows "Today's registers".
4. Tap Basic 4 (or Continue if you started it on the web). Marks taken on the web show here, and the reverse.
5. **Offline:** turn on airplane mode. Mark several children, then go back. Home says changes are saved on this phone. Turn airplane mode off and pull down: the message goes, and the marks appear on the web.
6. **Offline start:** sign in as **shs.teacher2** (LT002) while online and let Home load once (this saves today's list and the class lists on the phone). Turn on airplane mode, then start Form 2 Science, Physics, Period 3. Mark everyone and submit. Turn airplane mode off and pull down on Home: the register appears on the web as Submitted with every mark.
7. **Your account > Appearance:** Automatic, Light and Dark change the app straight away and stay after closing it.

## Later additions

- **Show password:** every password field (sign in, sign up, new password; web and phone) has an eye button that shows or hides the password.
- **Logo:** the tick mark appears on the website (header, favicon), in the app (sign-in, sign-up, join, the Home header) and in the sign-in emails, in light and dark.
- **Phone theme:** Home > Your account > Appearance. Automatic, Light and Dark switch the whole app straight away, and the choice stays after closing the app.
- **Dialogs explain what happens:** as **basic.admin**, on Staff try Turn off, Turn on, Make admin and Make teacher; on a student, Turn off; on Terms, Remove; on a class, Remove a subject and Delete class. Each opens RollCol's dialog, left-aligned, saying what will happen.
- **Removing a term:** remove Term 1 at the Adenta school, open Classes > Basic 4 (it says no term covers today), then add a term covering the same dates again: the totals come back unchanged. A tertiary semester with courses cannot be removed until its courses are.
- **Guardian managers:** on Staff, "Until" has a date and a time, starts a week ahead at 17:00, and does not let you pick a time in the past.

## Clean up

Run `supabase/test-data/remove.sql` in the SQL Editor to remove all test schools and accounts. Running `load.sql` again also starts fresh.
