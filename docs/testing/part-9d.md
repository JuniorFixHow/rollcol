# Testing Part 9d: the school day, number changes, and absences for several children

What this part adds:

- **The school day:** a new **School day** page for admins (under Attendance) with:
  - arrival and closing times and up to 4 breaks for each weekday, for the whole school;
  - different times for a class where needed;
  - one-off changes for a day (school closed, or different times), for the whole school or the classes you tick, with an option to tell the parents. Telling them uses the app first, and SMS (with credits) for the others.
  - Parents who use the app are told when the usual times change.
- **Parents see the times:** each child's card shows today's times, and the week view shows each day's times, with changes in amber.
- **One absence report for several children:** on the parent's **Absences** page and screen, tick every child who will be absent (for example when travelling).
- **Number changes:** a parent with a new number asks the school from **Account**. An admin approves or declines it on **People > Parent app**. Approving changes the guardian's number: both numbers get the usual SMS, and the parent signs in with the new number.
- **Fix:** if a parent reports an absence after the register's alerts went out, the child is now pre-marked Absent without sending an absence alert.

**Where:** Website, https://rollcol.vercel.app on your computer. App, the development build on your iPhone. Supabase, the SQL Editor.

**Accounts** (password `RollCol-Test-2026`): the parent (your number), **basic.admin@rollcol.test** (admin), **basic.teacher1@rollcol.test** (Basic 4's class teacher, School ID `BT001`).

## Installation

1. Extract `rollcol-part9d.zip` into the project folder, replacing files when asked.
2. Update the database. It should list `20261208000000_school_day.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
3. Commit and push, then wait for Vercel to finish.
4. App: from `apps/mobile`, run `pnpm exec expo start --dev-client --clear`. No new build.

## Test 1: why Adwoa's alert did not come

In my tests the alert is made in every case, also when a mark changes after a register's alerts went out. So something in your data stopped it. This check shows where.

1. **Supabase > SQL Editor**, run:
   ```sql
   select
     (select private.plan_allows(s.id, 'absence_alerts') from public.schools s where s.name = 'Test: Adenta Basic School') as plan_allows_alerts,
     (select ss.sms_absence_alerts from public.school_settings ss join public.schools s on s.id = ss.school_id where s.name = 'Test: Adenta Basic School') as absence_alerts_on,
     (select string_agg(r.status || ' ' || e.mark || ' queued:' || coalesce(to_char(r.alerts_queued_at, 'HH24:MI'), 'no'), '; ')
        from public.registers r join public.register_entries e on e.register_id = r.id join public.students st on st.id = e.student_id
        where st.full_name = 'Adwoa Amoah' and r.register_date = current_date) as adwoa_today,
     (select string_agg(a.kind || ' ' || to_char(a.created_at, 'HH24:MI') || ' done:' || coalesce(to_char(a.done_at, 'HH24:MI'), 'no'), '; ')
        from private.attendance_alerts a join public.students st on st.id = a.student_id
        where st.full_name = 'Adwoa Amoah' and a.created_at::date = current_date) as adwoa_alerts,
     (select string_agg(o.status::text, ', ') from public.sms_outbox o
        where o.kind = 'attendance' and o.body like '%Adwoa%' and o.created_at::date = current_date) as adwoa_message,
     (select string_agg(p.status || coalesce(' ' || p.error, ''), ', ') from public.push_outbox p
        where p.body like '%Adwoa%' and p.created_at::date = current_date) as adwoa_push,
     (select string_agg(n.kind || ':' || n.enabled, ', ') from public.notification_settings n
        join public.parent_links pl on pl.user_id = n.user_id) as parent_settings;
   ```
2. Send me the one row of results. The columns show where it stopped:
   - **plan_allows_alerts** false: the school's plan does not include alerts.
   - **adwoa_today** missing or not "absent": the mark never reached the server.
   - **adwoa_alerts** empty: no alert was made.
   - **adwoa_message** or **adwoa_push** empty or "muted": it was not sent, or the parent turned it off.

## Test 2: the usual school day

1. **Website**, as **basic.admin@rollcol.test**: open **School day**. Expected: **The whole school**, Monday to Friday ticked from 7:30am to 3:00pm, Saturday and Sunday "No school".
2. On **Monday**, click **Add a break**, name it **Snack**, 10:00 to 10:30. Add **Lunch**, 12:30 to 1:00pm. Set **Friday** to close at 2:00pm. Click **Save times**. Expected: "Saved. Parents who use the app have been told."
3. **App**, as the parent: expected a notification "The school day times have changed...". On **Children**, each Basic 4 child shows **Today:** with the times.
4. **App**: open **Abena Mensah**. Expected: each weekday shows its times, for example "7:30am to 3:00pm · Snack 10:00am to 10:30am · Lunch 12:30pm to 1:00pm" on Monday, and "7:30am to 2:00pm" on Friday.
5. **Website**, as **basic.admin**: try a break from 4:00pm to 4:30pm on Monday and save. Expected: "Each break must end after it starts, within the school day." Remove it.

## Test 3: different times for one class

1. **Website**, as **basic.admin**, **School day**: click **Basic 4** in the "Times for" row. Expected: "This class follows the school's times..."
2. Set **Wednesday** from 8:00am to 2:30pm and click **Save times**. Expected: Basic 4 is shown with **\*** (has its own times).
3. **App**, as the parent: Abena's week shows Wednesday 8:00am to 2:30pm. Thursday keeps the school's times.
4. **Website**: on Basic 4, click **Use the school's times**. Expected: "This class now follows the school's times." and the **\*** is gone.

## Test 4: a one-off change, told to parents

1. **Website**, as **basic.admin**, **School day**, under **A different day**:
   - **Day:** tomorrow
   - **What changes:** Different times
   - **Closing:** 1:00pm
   - **For:** The classes ticked below, with **Basic 4** ticked
   - **Note:** "Staff meeting"
   - **Tell the parents:** ticked
2. Click **Save the change**. Expected: "Saved, and the parents have been told." and under **Coming changes**: tomorrow · Basic 4 · "Closing 1:00pm · Staff meeting".
3. **App**, as the parent: expected a notification and a message in **Messages**: "Thursday 26 Nov: school closes at 1:00pm. Staff meeting." Abena's week shows tomorrow in amber: "Changed: 7:30am to 1:00pm · Staff meeting" (with the breaks).
4. **Website**: add another change for a day next week, **School is closed**, whole school, **Tell the parents** unticked. Expected: saved, no message to parents, and the parent's week view for that day says "School closed".
5. Click **Cancel** on it, and confirm. Expected: it leaves **Coming changes**, and the parent's week shows the usual times again.

## Test 5: one absence report for several children

1. **App**, as the parent: **Children > Absences > Report an absence**. Expected: **Children (tick all who will be absent)** with your three children as choices.
2. Tick **Abena Mensah** and **Adwoa Amoah**, choose **Tomorrow** to the day after, reason **Travelling**, note "Funeral in Kumasi". Tap **Report absence**.
3. Expected on **Absences**: two reports, one for each child, with the same days and note.
4. **Website**, as the parent: **Absences**. Expected: tick boxes for the children. Tick **Akosua Appiah** only, choose a reason, and report. Expected: "Reported. The class teacher has been told."
5. **App**, as **basic.teacher1**: expected three "Absence reported" notifications in all (two from step 2, one from step 4).

## Test 6: a parent asks for a new number

1. **App**, as the parent: **Account > Change my number**. If you have two schools, choose **Test: Labone SHS**. Type `020 000 0099` and tap **Ask the school**. Expected: "Sent. The school will check it..." and a "Waiting" card with **Cancel**.
2. **Website**, as **shs.admin@rollcol.test**: expected a notification (in the app, if signed in there). On **People > Parent app**: **New numbers parents asked for**, with Test Parent, your number "to 020 000 0099", and Kwame Owusu. Click **Decline**.
3. **App**, as the parent: expected a notification "The school did not change your number..." The waiting card is gone.
4. **Website**, as the parent: **Account > Your phone number**. Expected: each school with a **New number** box and **Ask the school**. Ask Test: Labone SHS for `020 000 0099` again. Expected: **Waiting**, then click **Cancel**. (Do not approve one: approving changes the number in earnest, and your number would need putting back in the SQL Editor.)

## Test 7: a report after the register's alerts went out

1. **App**, as **basic.teacher1**: open today's **Basic 4** register, mark **Akosua Appiah** **Present**, submit, and wait 15 minutes.
2. **Website**, as the parent: **Absences**, report **Akosua Appiah** for today, Sick.
3. Expected: on the register (app or website), Akosua stays **Present** (your mark is kept), with "Parent reported absent: Sick" under her name. No absence alert reaches the parent.
4. If you change Akosua to **Absent** now, still no absence alert is sent, because the parent reported it.
