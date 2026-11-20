# Testing Part 4: SMS to guardians

Start in **test mode**: messages are recorded on the Messages page marked "Test only", and nothing reaches a phone. At the end, switch on Sailup and receive real SMS. The test guardians all use your own number, so real test SMS can only reach you.

## Setup

1. Extract the Part 4 files over the project.
2. `pnpm exec supabase db push --remote` (four migrations: `…000000_sms`, `…010000_sms_delivery`, `…020000_sms_quiet_hours` and `…030000_sms_sender_log`).
3. Follow the README, **SMS (Part 4) > Set up (test mode)**: deploy `send-sms` and `sms-delivery`, add the `CRON_SECRET` secret, and insert the two rows into `private.config`. Leave `SMS_PROVIDER` unset for now.
4. Reload the test data: run `supabase/test-data/remove.sql`, then `load.sql` (with your email and phone at the top). It now gives each test school 50 SMS credits. Loading it sends no SMS.
5. Web: `pnpm dev:web`, or push to deploy on Vercel. Nothing changes on mobile in this part except the marks fix below.

Alerts only go out 15 minutes after a register is submitted, and are held during the school's quiet hours (9pm to 7am unless changed in Settings). Test during the day, or see "Without waiting" below.

## The SMS sender is working

1. Open `/platform`. The **SMS sender** card at the top should say **OK**. A message that is due should not stay on "Waiting" for more than a minute or two.
2. If it says **Needs attention**, it tells you why: setup missing in `private.config`, the secret does not match, `send-sms` was deployed without `--no-verify-jwt`, or a Sailup secret is missing. Fix that, and waiting messages go out within a minute.

## The marks field (fix from Part 3)

1. As **basic.teacher1@rollcol.test**, on **Registers**, type `-2` in Marks. The field does not go below 0 (the arrows stop at 0, and a negative number is refused when you take the register).
2. In the mobile app, the Marks field accepts only digits and one decimal point.

## Attendance alerts (basic school)

Your phone number is the guardian of the first three children in Basic 4 (Abena Mensah, Adwoa Amoah and one more).

1. Sign in as **basic.teacher1@rollcol.test**, open today's Basic 4 register, mark Abena **Absent**, Adwoa **Late**, everyone else Present, and **Submit**.
2. Sign in as **basic.admin@rollcol.test** and open **Messages** (new, in the sidebar). Nothing yet: alerts wait 15 minutes so teachers can fix mistakes.
3. After 15 to 16 minutes, reload. There is **one** message to Test Parent, not two, because both children have the same guardian:
   "Test: Adenta Basic School, 20 Nov: Abena Mensah was absent from school; Adwoa Amoah was late to school."
   It shows 1 SMS, 1 credit, **Sent** and **Test only**. The credits card shows 49.
4. As the teacher, change Abena from Absent to **Present**. About a minute later, Messages shows a second SMS: "Abena Mensah has now arrived at school (time)."

## Guardian notices (free)

1. As the admin, open a Basic 5 student and add a guardian with your phone number.
2. After a minute or two, Messages shows "You have been added as a guardian of ...", marked **free**. Credits do not change.
3. Turn that guardian's alerts off, then on again: each change sends a free notice. Changing the number sends one to the new number and one to the old.

## Present alerts

1. **Settings > SMS to guardians**: tick "Tell one guardian each day that their child is in school" and save.
2. The test guardian is already the chosen present-alert guardian for its three children. Present alerts go only for daily registers that are submitted after this, so this is easiest to check tomorrow, or with "Without waiting" below.

## Quiet hours

1. **Settings > SMS to guardians**: quiet hours are on, 21:00 to 07:00.
2. Change them so the current time falls inside (for example, if it is 18:40, set 18:00 to 19:00) and save. Send a message: the confirm dialog says when it will go out, and Messages shows **Waiting** with "From" and the end time.
3. Untick **Hold SMS during quiet hours** and save. Within a minute the waiting message goes out.
4. Set the hours back (or leave them off for a school with evening classes).

## School name in SMS

1. In **Settings > SMS to guardians**, set "School name in SMS" to `Adenta Basic` and save.
2. New messages start with "Adenta Basic:" instead of the full name (shorter, so more fits in one SMS).

## Broadcasts

1. As the admin, on **Messages**, the "Send a broadcast" card shows **All guardians**, Basic 4 and Basic 5 (only classes where someone gets broadcasts).
2. Type a message. Below it you see the characters, how many SMS each guardian gets, and the total credits. Paste a long text: past 3 SMS the button is disabled.
3. Click **Send broadcast**. RollCol's own dialog asks "Send this to N guardians?" with the credits it uses. Confirm.
4. The message appears in the list (filter **Broadcast**) and the credits go down.
5. On a student's page, turn "Stop school broadcasts" on for a guardian: the next broadcast leaves them out.

## Messages from teachers

1. As **basic.teacher1@rollcol.test**, open Abena Mensah (Basic 4). A new **Message guardians** card is at the bottom. Send a short message.
2. Open **Messages**: a teacher sees only what they sent. The admin sees everything.
3. A teacher opening a student who is not in their class sees nothing new (they cannot open that student at all).

## Credits (platform owner)

1. Open `/platform`. Basic and senior high schools have an **SMS** column with credits and SMS sent in 30 days. Tertiary shows "Not used".
2. Click **Add credits**, enter 20 and a note, save. The number goes up.
3. Enter `-1000` to take credits back below what is needed, then send a broadcast as the admin: it is refused with "This message needs N SMS credits, but the school has M."
4. Attendance alerts that cannot be paid for are kept as **No credits** and never sent. Add credits back afterwards.

## Senior high school (per period)

1. As **shs.admin@rollcol.test**, add a guardian with your number to one Form 2 Science student.
2. As two subject teachers, mark that student **Absent** in two different periods today and submit both.
3. After 15 minutes, Messages shows **one** SMS, for the first period missed: "... was absent from Core Mathematics (period 1)." Later periods that day do not send more, so a guardian is never sent ten messages a day.

## Unverified schools send nothing

1. On `/platform`, set Adenta Basic to unverified (Suspend, then Restore).
2. Add a guardian or submit a register: nothing appears on Messages, and the page explains that SMS starts after verification. Verify the school again afterwards.

## Real SMS with Sailup

Do this last, once the test mode steps above work.

1. Follow the README, **SMS (Part 4) > Send real SMS with Sailup**: API key, webhook, and the four secrets.
2. As **basic.admin@rollcol.test**, open Abena Mensah and send a short message from **Message guardians**.
3. Within about a minute your phone gets an SMS from **RollCol** starting "Adenta Basic:" (or the full test school name). On Messages it shows **Sent, not yet confirmed**, without "Test only".
4. A few seconds to minutes later, reload: it changes to **Delivered** (Sailup's report reached RollCol). In the Sailup dashboard, the webhook delivery log shows a 200 response.
5. If it stays at "Sent, not yet confirmed", check the webhook address and that `SAILUP_WEBHOOK_SECRET` matches; the Sailup log shows 401 when the secret is wrong.
6. Not delivered: add a guardian with a number that does not exist (for example `020 000 0001`) to a Basic 5 child. The free "you have been added" notice is sent, the network reports it as **Not delivered**, and the child's page shows **Last SMS not delivered** beside that guardian. Remove that guardian afterwards.
7. If the Sailup account has no balance, messages show **Failed** with "Sailup account has no credit." after three tries, and the school's credits are returned.

Switch back to test mode any time by setting `SMS_PROVIDER` to `test`.

## Without waiting (optional, SQL Editor)

To skip the 15 minutes, run this after submitting a register, then wait for the next minute:

```sql
update public.registers set submitted_at = now() - interval '20 minutes'
where register_date = (now() at time zone 'Africa/Accra')::date and alerts_queued_at is null and status = 'submitted';
```

To see what the job does: `select * from cron.job_run_details order by start_time desc limit 5;`
To see whether the sender ran: Supabase dashboard > Edge Functions > send-sms > Logs.

## What is not in this part

- The admin's daily summary of changes made by teachers with guardian permission.
- Messaging from the mobile app.
