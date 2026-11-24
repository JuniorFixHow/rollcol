# Testing Part 9a: parents in the app

What this part adds:

- **Parent sign-in in the app:** a **Parent** tab on the sign-in screen. A parent types the phone number the school has, gets a six-digit code by SMS (sent through Sailup with the RollCol sender name), and signs in. No password, no email.
- **Codes only go to guardians:** RollCol sends a code only to a number that a school added as a guardian, at a verified basic or senior high school (or a classes workspace on Alerts).
- **Linking by a child's name:** the parent types one of their child's names, so someone with a recycled number cannot see another family. All the children on that guardian record appear. If another school also has the number, the parent adds a child there with another name.
- **What parents see:** each child's mark today, and this term's attendance ("Attendance X out of Y"). They also get a week view with arrows, the SMS the schools sent to their number (in a Messages tab), and Notifications.
- **For the school:** a **Parent app** page (People > Parent app) listing every parent who uses the app, with **Remove**, and an optional **Confirm new links** setting. A link ends by itself when the school changes the guardian's number.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol development build on your iPhone
- **Supabase**: your RollCol project in the Supabase dashboard (SQL Editor, Authentication, Edge Functions), and the command line in the project folder

**Accounts**
- **Parent**: your own phone number (the one in the test data as `my_phone`). It is the guardian **Test Parent** of three Basic 4 children at Test: Adenta Basic School.
- **basic.admin@rollcol.test** (password `RollCol-Test-2026`): Grace Adjei, admin of Test: Adenta Basic School.
- **shs.admin@rollcol.test** (same password): Richard Asamoah, admin of Test: Labone SHS.

---

## Part A: Installation

1. **Extract** `rollcol-part9a.zip` into the project folder, replacing files when asked. No new package, and no new app build.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261202000000_parents.sql`.
3. **Make your number a guardian at a second school too.** In **Supabase > SQL Editor > New query**, paste this, replace `+233XXXXXXXXX` with your number in the same +233 format as the test data, and click **Run**:
   ```sql
   with g as (
     insert into public.guardians (school_id, full_name, phone)
     select id, 'Test Parent', '+233XXXXXXXXX' from public.schools where name = 'Test: Labone SHS'
     returning id, school_id
   )
   insert into public.guardian_links (school_id, guardian_id, student_id, relationship)
   select g.school_id, g.id, st.id, 'Parent'
   from g join public.students st on st.school_id = g.school_id and st.full_name = 'Kwame Owusu';
   set constraints all immediate;
   update public.guardian_events set processed_at = now() where processed_at is null and guardian_name = 'Test Parent';
   ```
   Expected: **Success**. (The last line stops the "you have been added" SMS. Reloading the test data later does the same, but it would also delete the workspace you paid for.)
4. **Deploy the sign-in code sender:**
   ```
   pnpm exec supabase functions deploy send-auth-sms --no-verify-jwt
   ```
5. **Turn on phone sign-in:** **Supabase > Authentication > Sign In / Providers > Phone**:
   1. Turn on **Enable phone provider**.
   2. Keep **Phone confirmation** on, set **SMS OTP expiry** to `600` and **SMS OTP length** to `6`.
   3. Click **Save**. If it insists on an SMS provider's details, tell me what it asks for (the hook in the next step replaces the provider).
6. **Connect the hook:** **Authentication > Auth Hooks > Add a new hook > Send SMS hook**:
   1. Turn on **Enable Send SMS hook**, choose **HTTPS**.
   2. URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-auth-sms` (your project ref is in the dashboard address).
   3. Click **Generate secret**, copy it (it starts with `v1,whsec_`), then click **Create**.
7. **Give the function the secret** (keep the quotes):
   ```
   pnpm exec supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..."
   ```
8. **Check the SMS provider** is real, since codes are not sent in test mode:
   ```
   pnpm exec supabase secrets list
   ```
   `SMS_PROVIDER` must be `sailup`, with `SAILUP_API_KEY` and `SMS_SENDER_ID` set (as in Part 4). If you would rather not spend SMS, use a fixed test code instead: under **Phone > Test Phone Numbers and OTPs**, add `233XXXXXXXXX=123456` (your number without the plus) and save.
9. **Deploy the website:** commit and push, then wait for Vercel to finish.
10. **App:** from `apps/mobile`, run `pnpm exec expo start --dev-client --clear` and open the app on your iPhone.

---

## Part B: Tests

### Test 1: a number that is not a guardian cannot get a code

1. **App**: if you are signed in, go to **Account > Sign out**.
2. On the sign-in screen, tap **Parent**. Expected: a **Phone number** field and **Send code**. The "Create your account" line is not shown.
3. Type a number that is not a guardian anywhere, for example `020 000 0001`, and tap **Send code**.
4. Expected: a red message: "This number is not on your child's school records in RollCol..." No SMS is sent.

### Test 2: sign in with your number

1. **App**, **Parent** tab: type your number (for example `024 111 2222`) and tap **Send code**.
2. Expected: the screen asks for the code sent to your number, and **Send a new code in 60 s** counts down. Within a minute you get an SMS from RollCol: "123456 is your RollCol sign-in code. Do not share it with anyone, including school staff." (With a test number, no SMS comes; use your fixed code.)
3. Type a wrong code, such as `000000`, and tap **Sign in**. Expected: "That code is not right, or it has expired..."
4. Type the right code and tap **Sign in**.
5. Expected: the parent screens, with the tabs **Children**, **Messages**, **Notifications** and **Account**. The Children tab shows **Welcome to RollCol** with **Add your child**.
6. If iOS asks to allow notifications, tap **Allow**.

### Test 3: link your children by name

1. **App**, Children tab: tap **Add your child**.
2. Type `Kofi` and tap **Link**. Expected: "That name does not match a child on the school's records with your number..."
3. Type `abena` (lower case on purpose) and tap **Link**. Expected: a blue notice: "Linked. Another school also has your number: type the name of your child there."
4. Type `Owusu` and tap **Link**. Expected: the screen closes.
5. Expected on **Children**, under **Your children**, four cards:
   - **Abena Mensah**, **Adwoa Amoah** and **Akosua Appiah**: Basic 4 · Test: Adenta Basic School
   - **Kwame Owusu**: Form 2 Science · Test: Labone SHS
6. Each card shows **Today** with **No register** (or the mark, if a register was taken today), and a line like **Attendance 8 out of 10 (80%)**, the term name, and the absences and lates.
7. **Website**, as **basic.admin@rollcol.test**: open **Reports**, then Basic 4 for the term. Expected: Abena's, Adwoa's and Akosua's days present and days held match the app's numbers. (Present and late both count as attending.)

### Test 4: a child's week

1. **App**, Children: tap **Abena Mensah**. Expected: her name, this week (for example **24 to 28 November 2026**), and Monday to Friday, each with **Present**, **Late**, **Absent**, **Not marked**, **No register** or **Coming up**.
2. Tap the **left arrow**. Expected: last week, with a mark on each school day that had a register. **Back to this week** appears.
3. Expected: the **right arrow** is dimmed on this week, and the card under the days says **Attendance X out of Y** for the week shown.
4. Tap **Back to this week**, then go back to Children.

### Test 5: the school's messages

1. **Website**, as **basic.admin@rollcol.test**: open **Messages**, send a short message to the guardians of **Basic 4** (for example "Test: PTA meeting on Friday at 3pm.").
2. Wait about a minute for it to send.
3. **App**: open **Messages** and pull down. Expected: the message, with **Test: Adenta Basic School**, an **Announcement** or **Message** label, and the time. Older SMS that reached your number from the test schools are listed too.

### Test 6: the Parent app page

1. **Website**, as **basic.admin@rollcol.test**: open **People > Parent app**.
2. Expected: one row: **Test Parent**, your number, **Abena Mensah, Adwoa Amoah, Akosua Appiah**, and the date and time you linked.
3. Expected: **Confirm new links** says **Off**, with **Turn on**.
4. **Website**, as **shs.admin@rollcol.test**: **People > Parent app**. Expected: Test Parent with **Kwame Owusu**.

### Test 7: links the school confirms

1. **Website**, as **basic.admin@rollcol.test**, Parent app page: click **Turn on**. Expected: "On: a parent who types a correct name waits until an admin confirms the link here."
2. **App**, **Account**: under **Schools**, tap **Remove** next to **Test: Adenta Basic School**. Expected: RollCol's dialog asks "Remove Test: Adenta Basic School?". Tap **Remove**.
3. **App**, Children. Expected: only **Kwame Owusu**. Tap **Add a child**, type `Adwoa`, tap **Link**.
4. Expected on Children: a card **Test: Adenta Basic School**: "Waiting for the school to confirm your link." No child details.
5. **Website**, Parent app page, refresh. Expected: "1 link waits for you", and the row shows **Waiting** with **Confirm**. Click **Confirm**, then **Confirm** in the dialog.
6. **App**: expected a notification **"Your child is linked"**. On Children (pull down), the three Basic 4 children are back.
7. **Website**: click **Turn off** to go back to the default.

### Test 8: the school removes a link

1. **Website**, as **basic.admin@rollcol.test**, Parent app page: click **Remove** on Test Parent, then **Remove** in the dialog.
2. **App**: expected a notification **"Link removed"**, and on Children (pull down) only Kwame Owusu, with the card "Another school also has your number..."
3. Tap **Add a child**, type `Akosua`, tap **Link**. Expected: the three Basic 4 children are back.

### Test 9: a new number ends the link

This changes the number in SQL, so no SMS goes to a made-up number.

1. **Supabase > SQL Editor**, run:
   ```sql
   update public.guardians set phone = '+233200000099'
   where full_name = 'Test Parent' and school_id = (select id from public.schools where name = 'Test: Labone SHS');
   ```
2. **App**: expected a notification **"Link ended"**: "Test: Labone SHS changed the phone number on your guardian record...". On Children (pull down), Kwame Owusu is gone.
3. **App**, Account. Expected: only **Test: Adenta Basic School** under Schools.
4. Put the number back (replace `+233XXXXXXXXX` with yours), then clear the SMS it would cause:
   ```sql
   update public.guardians set phone = '+233XXXXXXXXX'
   where full_name = 'Test Parent' and school_id = (select id from public.schools where name = 'Test: Labone SHS');
   set constraints all immediate;
   update public.guardian_events set processed_at = now() where processed_at is null and guardian_name = 'Test Parent';
   ```
5. **App**, Children: the card says another school has your number. Tap **Add a child**, type `Kwame`. Expected: Kwame Owusu is back.

### Test 10: staying signed in, and staff still sign in as before

1. **App**: close the app completely and open it again. Expected: still signed in, on Children.
2. **App**, Account. Expected: your number, "Parent account...", the two schools with their children, **Add a child**, Appearance, Privacy policy, Terms of Use, **Sign out** and **Delete account**.
3. Tap **Sign out**. Expected: the sign-in screen.
4. Sign in with **School ID**, as basic.teacher1 (school code of Test: Adenta Basic School, School ID `BT001`, password `RollCol-Test-2026`). Expected: the usual teacher screens, with nothing about parents.
5. Sign out, and sign in again as a parent with your number for Part 9b.

### Test 11: the privacy policy

1. **Website**: open **Privacy policy** from the footer. Expected: "Last updated 24 November 2026", and under the information collected, **Parent app accounts**.
