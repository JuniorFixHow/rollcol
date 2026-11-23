# Testing Part 8b: billing with Paystack, and the Pricing page

What this part adds:

- **A public Pricing page** at `/pricing`, linked from the home page, both sign-up pages and the footer. Prices come from the database, so changing a price changes the page (within an hour).
- **A Billing page** for admins (and workspace owners): the current plan, students used of the limit, the trial, SMS credits, choosing a plan, paying for more students, upgrading to Complete, SMS packs, and every payment with a printable receipt.
- **Paystack payments** with Mobile Money or card. A payment counts only when Paystack confirms it, for the exact amount. The secret key lives only in the `paystack` Edge Function.
- **Plans decide the SMS:** Alerts sends absence and late alerts; Complete and the trial add present alerts; the free plan sends system messages only. A classes workspace on Alerts can send SMS (and gets Messages in its menu).
- **Limits follow the plan:** a paid plan covers the students paid for; more students need more places.
- **The app never shows payments.** A student joining a full school in the app is told to ask the school, nothing about plans.

**Prices** (all are settings, see the README):

| Who | Plan | Price |
|---|---|---|
| Basic and SHS | Free (up to 100), 4-week trial of Complete after verification | GHS 0 |
| | Alerts | GHS 3 per student per term |
| | Complete (+ 2 SMS credits per student) | GHS 6 per student per term |
| Tertiary | Free (up to 200) / Standard | GHS 0 / GHS 3 per student per semester |
| Classes workspace | Free (50 across workspaces) / Alerts | GHS 0 / GHS 4 per student per term |
| Courses workspace | Free (50) / Standard | GHS 0 / GHS 3 per student per semester |
| SMS packs | 100 / 500 / 1,000 credits | GHS 20 / GHS 90 / GHS 150 |

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer
- **Paystack**: the Paystack payment page the website opens, and your Paystack dashboard (https://dashboard.paystack.com) in **Test mode**
- **Supabase**: your RollCol project, **SQL Editor > New query**, and the command line in the project folder
- **App**: the RollCol app on your iPhone

**Paystack test details** (test mode only; no real money moves):
- **Mobile Money:** choose MTN, number `0551234987`. No PIN or OTP.
- **Card that works:** `4084 0840 8408 4081`, CVV `408`, any future expiry date.
- **Card that fails:** `4084 0800 0067 1803`, CVV `180`, any future expiry date.

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who |
|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin of Test: Adenta Basic School (24 students, verified, in its trial) |
| basic.teacher1@rollcol.test | Samuel Ankrah, teacher there; owner of a classes workspace |
| shs.admin@rollcol.test | Richard Asamoah, admin of Test: Labone SHS |
| uni.admin@rollcol.test | Dr. Felicia Mensah, admin of Test: Accra Nursing College (18 students) |
| Your own account | Platform admin |

---

## Part A: Installation

1. **Extract** `rollcol-part8b.zip` into the project folder, replacing files when asked.
2. **Update the database:**
   ```
   pnpm exec supabase db push --remote
   ```
   It should list one migration: `20261201000000_billing.sql`.
3. **Reload the test data** (so every test school's trial starts today): run `supabase/test-data/remove.sql`, then `supabase/test-data/load.sql`, in Supabase SQL Editor.
4. **Paystack, in Test mode** (full steps in the README, "Payments with Paystack"):
   1. In the Paystack dashboard, **Settings > API Keys & Webhooks**, copy the **Test Secret Key** (`sk_test_...`).
   2. In the project folder:
      ```
      pnpm exec supabase secrets set PAYSTACK_SECRET_KEY=sk_test_... SITE_URL=https://rollcol.vercel.app
      pnpm exec supabase functions deploy paystack --no-verify-jwt
      ```
   3. Back in Paystack, **Settings > API Keys & Webhooks**: **Test Webhook URL** `https://<your-project-ref>.supabase.co/functions/v1/paystack`, and **Test Callback URL** `https://rollcol.vercel.app/dashboard/billing/return`. Click **Save changes**.
5. **Publish the website:** commit and push to GitHub, and wait for Vercel to finish.

No new app build is needed.

---

## Part B: The Pricing page

### Test 1: Pricing for visitors
**Account:** none (signed out). **Where:** Website, then Phone browser.

1. Open the home page. The header has **Pricing** next to Sign in; the buttons read **Register your school** and **See prices**; the footer has **Pricing**, **Privacy policy** and "RollCol by Teqxa". Click **See prices**.
2. The page **Free to start. Then a little per student.** has four sections: **Basic and senior high schools** (Free, Alerts GHS 3, Complete GHS 6), **Universities, colleges and nursing schools** (Free, Standard GHS 3 per student per semester), **Teachers and lecturers on their own** (Free workspace, Classes: Alerts GHS 4, Courses: Standard GHS 3), and **SMS credits** (100 for GHS 20, 500 for GHS 90, 1,000 for GHS 150).
3. The chips under the heading jump to each section. **Questions** answers who counts as a student, when and how to pay, what happens when a term ends, the trial, and that the apps are free.
4. **Register your school** and **Start a workspace** at the bottom open the sign-up pages. Both sign-up pages have a **See prices** link at the bottom.
5. On your iPhone, the page fits the screen and the plans stack one under another.

---

## Part C: A school pays

### Test 2: The Billing page during the trial
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. The menu has a new **Billing** link, under Settings. Open it.
2. The first card is **Free trial**: Students **24 of 100**, **Trial ends** (four weeks from today), SMS **Absence, late and present alerts**, and a line explaining the trial gives everything in Complete.
3. **Choose a plan** shows **Alerts** (GHS 3 per student per term) and **Complete** (GHS 6), a **Term** box with Term 1, and **Students** set to **24**.
4. Choose **Complete**: the total reads **GHS 144** (24 x GHS 6), with "Includes 48 SMS credits". Choose **Alerts**: **GHS 72**.
5. Type `10` in Students: "Enter at least 24 students to see the total." Click **Pay with Paystack**: "Pay for at least your 24 active students."

### Test 3: Pay for Alerts with Mobile Money
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. Choose **Alerts**, set Students to `25`. The button reads **Pay GHS 75 with Paystack**. Click it.
2. Paystack's payment page opens (with "Test mode" on it) for **GHS 75.00**. Choose **Mobile Money**, MTN, number `0551234987`, and pay.
3. Paystack sends you back to RollCol: **Payment received**.
4. The first card is now **Alerts plan**: Students **24 of 25**, Paid for **Term 1** with its dates, SMS **Absence and late alerts**.
5. Under **Payments**: today, "Alerts plan for Term 1: 25 students", GHS 75, **Paid**, and a **Receipt** link. Click it: a receipt with RollCol, a receipt number (RCR-2026-...), Test: Adenta Basic School, Grace Adjei and her email, **Mobile Money through Paystack**, the reference and **GHS 75**. Click **Print or save as PDF**: only the receipt prints.
6. In the Paystack dashboard, **Transactions** shows the same payment.

### Test 4: The plan's limit
**Account:** basic.admin@rollcol.test. **Where:** Website.

1. **Students > Add a student:** add one (any name). It works: 25 of 25.
2. Add another: "You paid for 25 students this term. Add more students on the Billing page first." Nothing is added.

### Test 5: More students, by card
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. **Billing:** a card **Change this term's plan** says you paid for 25 students. In **More students** type `5` and click **Pay for more students**.
2. On Paystack (GHS 15.00), choose **Card**: `4084 0840 8408 4081`, CVV `408`, any future expiry. Pay.
3. Back on Billing: **Payment received**, Students **25 of 30**. Add the student from Test 4 again: it works now.

### Test 6: Upgrade to Complete
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. **Billing > Upgrade to Complete** says it adds the daily present SMS and **60 SMS credits**, for **GHS 90** (30 students). Click it and pay with Mobile Money.
2. Back on Billing: **Complete plan**, SMS **Absence, late and present alerts**, and the SMS credits went up by 60.
3. **Payments** lists the upgrade; its receipt shows "60 SMS credits".

### Test 7: An SMS pack
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. **Billing > SMS credits:** three packs. Click **Buy** under **100 credits** (GHS 20) and pay by card.
2. The credits go up by 100. **Messages** shows the same balance.

### Test 8: A failed and an unfinished payment
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. Buy the **100 credits** pack again, and pay with the failing card `4084 0800 0067 1803`, CVV `180`.
2. Back on Billing: **The payment did not go through. Nothing was charged.** The payment is listed as **Failed**, with Paystack's reason. The credits did not change.
3. Buy the pack once more, but on the Paystack page click the back button (or close the tab) without paying. Open **Billing** again: that payment is listed as **Not completed**, and nothing changed.

### Test 9: The webhook confirms a payment
**Account:** basic.admin@rollcol.test. **Where:** Website and Paystack.

1. Buy the 100 credits pack and pay with Mobile Money, but as soon as Paystack says it succeeded, **close the tab** before it sends you back.
2. Wait about a minute, then open **Billing** in a new tab. The payment is **Paid** and the credits went up: Paystack's webhook told RollCol directly.

### Test 10: Only admins
**Account:** basic.teacher1@rollcol.test, in Test: Adenta Basic School. **Where:** Website.

1. The menu has no **Billing**.
2. Go to `/dashboard/billing` directly: you are taken back to the overview.

---

## Part D: Other schools and workspaces

### Test 11: A college
**Account:** uni.admin@rollcol.test. **Where:** Website.

1. **Billing:** **Free plan**, Students **18 of 200**, SMS "System messages only" or "After verification".
2. **Choose a plan** shows only **Standard**, GHS 3 per student per **semester**, with the semester box. Do not pay.

### Test 12: The trial ends
**Account:** shs.admin@rollcol.test, and Supabase. **Where:** Supabase SQL Editor, then Website.

1. Make Labone's trial end:
   ```sql
   update public.schools set verified_at = now() - interval '40 days' where name = 'Test: Labone SHS';
   ```
2. As shs.admin, **Billing**: **Free plan**, "Free, up to 100 students", SMS **System messages only**. From now on registers send no absence alerts until a plan is paid.
3. Put it back:
   ```sql
   update public.schools set verified_at = now() where name = 'Test: Labone SHS';
   ```

### Test 13: A classes workspace pays and gets SMS
**Account:** basic.teacher1@rollcol.test. **Where:** Website and Paystack.

1. Open Samuel's classes workspace (start one from **Your account** if he has none, and add a term under **Academics > Terms** and two pupils).
2. The menu has **Billing** and no **Messages**. Open **Billing**: **Free workspace**, Students "X of 50, across all your free workspaces", SMS **Not on free workspaces**.
3. **Choose a plan:** **Alerts**, GHS 4 per student per term. Keep the number of students and pay with Mobile Money.
4. Back on Billing: **Alerts plan**, SMS **Absence and late alerts**, and an **SMS credits** card. The menu now has **Messages** under Attendance.

### Test 14: The platform page
**Account:** your own account. **Where:** Website.

1. Open the **RollCol platform** page. Test: Adenta Basic School shows "Complete until (the end of Term 1)"; Samuel's workspace shows "Alerts until ..."; Labone and the college show "Trial until ..." or nothing.

### Test 15: The app shows no payments
**Account:** any staff and student1@rollcol.test. **Where:** App.

1. Look through the app as staff and as a student: there is no price, plan or payment anywhere.

---

## What to send back

For any test that does not behave as described, tell me the test number, the account, where it happened, and what you saw (a screenshot helps).
