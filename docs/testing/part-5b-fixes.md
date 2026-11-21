# Testing the Part 5b fixes

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol development build on your iPhone (no new build is needed for these fixes)
- **iPhone Camera**: the iPhone's own Camera app, outside RollCol

**Test accounts** (password `RollCol-Test-2026`): uni.lecturer1@rollcol.test (Mr. Daniel Ocran), student1@rollcol.test (Abena Mensah).

---

## Part A: Installation

1. Extract `rollcol-part5b-fixes.zip` into the project folder, replacing files when asked.
2. Update the database:
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261124000000_qr_links.sql`.
3. Publish the website: commit and push, and wait for Vercel to finish deploying. The new check-in page must be live for Test 5.
4. Restart the app's code: stop `pnpm dev:mobile` (Ctrl+C) and run it again. In the app, shake the phone and tap **Reload** (or close and reopen the app).

---

## Part B: Test procedure

### Test 1: No join screen flash at sign-in

- **Where:** App.
1. Account tab > **Sign out**.
2. Sign in as **student1@rollcol.test**.
3. **Expected:** you go straight to **Today**. The "join a school" screen never appears, not even for a moment.

### Test 2: The badge clears when you open Notifications

- **Where:** App. **Account:** student1@rollcol.test
1. Make sure there are unread notifications (the **Notifications** tab shows a red number). If there are none, run a short session as in Test 5 and let it end.
2. Tap the **Notifications** tab once.
3. **Expected:** the red number disappears straight away, without leaving and coming back.

### Test 3: The lecturer's greeting

- **Where:** App. Sign out, then **Account:** uni.lecturer1@rollcol.test
1. **Expected:** Today says **Hello, Mr. Ocran**.
2. (A student still sees their first name: student1 sees **Hello, Abena**.)

### Test 4: The Sessions tab has no error

- **Where:** App. **Account:** uni.lecturer1@rollcol.test
1. Tap **Today**, then **Sessions**, then **Today**, then **Sessions** again.
2. **Expected:** no red error screen, and nothing about "postgres_changes" in the terminal running `pnpm dev:mobile`.

### Test 5: Scanning the code with the iPhone Camera (outside RollCol)

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. Open **Sessions** and start a session: NUR 101, Where **My Room** (or **No location check**), Rotating code ticked, every **15** seconds, Start **Now**. Keep the QR code on the computer screen.
- **Where:** App. **Account:** student1@rollcol.test (signed in; then close the app or switch away from it).
2. Open the iPhone's **Camera** app (not RollCol) and point it at the QR code.
3. **Expected:** a yellow link appears: **rollcol.vercel.app**. Tap it.
4. **Expected:** Safari opens a page **Check in with RollCol**, then asks **Open in "RollCol"?** Tap **Open**. (If it does not ask, tap **Open RollCol to check in**.)
5. **Expected:** RollCol opens on the check-in screen for NUR 101, briefly "Checking you in...", then Face ID, then "Finding your location..." (if the session has a location), then **You're checked in**. There is no camera step, because the code came with the link.
6. **Where:** Website, the session page. **Expected:** Abena Mensah shows **Checked in**.

### Test 6: An old code from outside the app

- **Where:** Website. **Account:** uni.lecturer1@rollcol.test
1. End the session from Test 5 and start a new one the same way.
2. Take a screenshot of the QR code on another phone (or a photo), and wait at least one minute.
- **Where:** iPhone Camera, then the app (student1).
3. Scan the photo with the Camera app and open it in RollCol as in Test 5.
4. **Expected:** "That code has changed. Scan the code on your lecturer's screen again." Tap **Try again**: the app's own scanner opens. Scan the live code on the computer. **Expected:** checked in.

### Test 7: Search in the lecturer's student list

- **Where:** App. **Account:** uni.lecturer1@rollcol.test
1. Sessions tab > **Start a session** (GSC 103, Here, rotating code), so the session screen opens.
2. Below the code and buttons there is a search box **Search by name or school ID**. Type `kwame`.
3. **Expected:** only Kwame Owusu, and "Showing 1 of 18."
4. Type `25004`. **Expected:** Kofi Boateng. Type `zzz`. **Expected:** "Nothing matches "zzz"."
5. Tap **End now** and confirm.

### Test 8 (if you have an Android phone): Scanning with another app

- **Where:** Android phone with the RollCol development build installed and signed in as a student (a student other than one bound to another phone).
1. Scan the lecturer's code with Google Lens or any QR app, and open the link.
2. **Expected:** Chrome opens RollCol directly on the check-in screen (no extra question), and the check-in goes through as in Test 5.
