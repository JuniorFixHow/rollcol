# Testing Part 9b: alerts in the parent app

What this part adds:

- **App first, SMS if needed:** attendance alerts and school messages go to the parent's RollCol app as a notification when they use the app on a phone. They go by SMS when the parent does not use the app, or when the notification cannot be delivered. A message delivered in the app uses **no SMS credits**.
- **The school chooses per guardian:** **App first, SMS if needed** (the default), **SMS only** (for example a parent whose phone is lost or broken), or **App only**. The guardian is told on both ways whenever it changes.
- **Parent notification settings:** in the app, parents choose **Absent and late**, **In school** and **School messages**. Turned-off ones still appear in the Messages tab and are not sent by SMS instead.
- **Faster notifications:** notifications and SMS are now sent the moment they are queued, instead of on the next minute's run.
- **Fair name check:** only a real wrong name counts towards the five tries. A correct name clears the earlier mistakes, and trying when everything is already linked no longer counts.
- **Fewer credits:** the message composer shows how many guardians get the message in the app, and counts credits only for those who get an SMS.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **App**: the RollCol development build on your iPhone, signed in as the parent (your number)
- **Supabase**: SQL Editor, and the command line in the project folder

**Accounts** (password `RollCol-Test-2026`)
- **Parent**: your phone number, guardian **Test Parent** of Abena Mensah, Adwoa Amoah and Akosua Appiah (Basic 4, Test: Adenta Basic School) and Kwame Owusu (Test: Labone SHS)
- **basic.admin@rollcol.test**: Grace Adjei, admin of Test: Adenta Basic School
- **basic.teacher1@rollcol.test**: Samuel Ankrah, Basic 4's class teacher

---

## Part A: Installation

1. **Extract** `rollcol-part9b.zip` into the project folder, replacing files when asked. No new package, and no new app build.
2. **Update the database.** It should list `20261204000000_sms_in_app_status.sql` and `20261204000100_parent_alerts.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
3. **Clear the name tries from before the fix.** **Supabase > SQL Editor**, run:
   ```sql
   delete from private.parent_link_attempts;
   ```
4. **Deploy the website:** commit and push, then wait for Vercel to finish.
5. **App:** from `apps/mobile`, run `pnpm exec expo start --dev-client --clear`, open the app and sign in as the parent if needed. If iOS asks about notifications, tap **Allow**.

---

## Part B: Tests

### Test 1: the name check

1. **App**, as the parent: **Account**, tap **Remove** next to **Test: Adenta Basic School**, then **Remove**.
2. Tap **Add a child**, type `Akos`, tap **Link**. Expected: "That name does not match..."
3. Type `Akosua`, tap **Link**. Expected: the screen closes, and the three Basic 4 children are back on Children.
4. Tap **Add a child** again and type `Abena`. Expected: "Your children are already linked at every school that has your number." This does not count as a try.

### Test 2: notifications arrive quickly

1. **Website**, as **basic.admin@rollcol.test**: **People > Parent app**, click **Remove** on Test Parent, then **Remove**.
2. **App**: expected the notification **"Link removed"** within about 10 seconds, instead of up to a minute or more.
3. **App**: **Add a child**, type `Adwoa`. Expected: the Basic 4 children are back.

### Test 3: a school message in the app, without credits

1. **Website**, as **basic.admin@rollcol.test**: open **Messages**. Note the credits left.
2. Write "Test: PTA meeting on Friday at 3pm." and choose **Basic 4**.
3. Expected under the box: the number of guardians, **(1 in the app)**, and credits for the others only. (If Test Parent is the only Basic 4 guardian with a number, it says **0 credits**.)
4. Click **Send** and confirm.
5. **App**: expected a notification within seconds, titled with the school's SMS name, saying "Test: PTA meeting on Friday at 3pm." No SMS arrives on your phone.
6. Tap the notification. Expected: the **Messages** tab opens with the message at the top.
7. **Website**, Messages, refresh. Expected: the message to your number shows **In the app**, and the credits left went down only for guardians who got an SMS.

### Test 4: an attendance alert in the app

1. **Website**, as **basic.teacher1@rollcol.test**: **Registers**, open **Basic 4** for today. Mark **Abena Mensah** **Absent**, everyone else **Present**, and submit.
2. Wait 15 minutes. Alerts wait that long on purpose, so a teacher can fix a wrong mark before any parent is told.
3. **App**: expected a notification from the school: "Abena Mensah was absent from school." No SMS arrives.
4. **App**, Children: Abena shows **Today: Absent**. **Messages** lists the alert with an **Attendance** label.

### Test 5: the parent turns a notification off

1. **App**: **Account > Notifications**. Expected: **Absent and late**, **In school** and **School messages**, all on.
2. Turn **School messages** off.
3. **Website**, as **basic.admin@rollcol.test**: send another message to **Basic 4**, for example "Test: Closing at 1pm tomorrow."
4. **App**: expected no notification, and no SMS. Open **Messages** and pull down: the message is there.
5. **App**: turn **School messages** back on.

### Test 6: SMS when the app cannot be reached

1. **App**: **Account > Sign out** (this removes the phone's notification address from RollCol).
2. **Website**, as **basic.admin@rollcol.test**: send a message to **Basic 4**, for example "Test: Sports day is on Saturday."
3. Expected: an **SMS** arrives on your phone within a minute (no app notification). On the website, Messages shows it as **Sent**, and one credit was used for your number.
4. **App**: sign in again as the parent (Parent tab, your number, the code).

### Test 7: the school chooses SMS only, then app first again

1. **Website**, as **basic.admin@rollcol.test**: **Students > Abena Mensah**. Under **Guardians**, Test Parent shows **Uses the app**.
2. Click **How alerts reach them: App first, SMS if needed**, choose **SMS only**, and click **Save**. Expected: "Saved. The guardian has been told." and a **SMS only** badge.
3. Expected on your phone: an SMS and an app notification, both saying "From now on we send attendance alerts and messages by SMS only."
4. **Website**, under Message guardians on the same page, send "Test: Please see the class teacher." Expected: it arrives by **SMS** (and the composer counts a credit for it).
5. Change it back to **App first, SMS if needed** and save. Expected: an SMS and a notification saying alerts now go to the app first. The **SMS only** badge is gone.
