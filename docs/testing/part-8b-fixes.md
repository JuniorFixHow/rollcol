# Testing the Part 8b fixes

What this adds or fixes:

- **Payments that stayed "Not completed":** the Billing page now asks Paystack itself about any payment still waiting from the last two days (straight away, then every 15 seconds for two minutes, and with a **Check again** button). A paid purchase is applied even if Paystack's webhook was late or never arrived.
- **Real error messages:** when the payment service fails, the website now says why (for example a missing secret, a refused key, or a function that is not deployed) instead of "Paystack could not be reached". The `paystack` Edge Function also writes every failure to its logs.
- **The app now keeps you signed in** between launches. Signing out on the website no longer signs your phone out, and the other way round.
- **Notifications on the website:** a Notifications page in the dashboard menu, with an unread count, the same list as the app, and notification settings.
- **Terms of use** at `/terms`, linked in the site footer, under the sign-in and sign-up forms, and in the sign-up agreement line.
- **A price calculator** on the Pricing page.
- **Pickup codes** are added to the Part 9 plan (parents in the app). Nothing to test yet.

**Where things happen**
- **Website**: https://rollcol.vercel.app on your computer (and http://localhost:3000 where a step says so)
- **Paystack**: the Paystack payment page the website opens, and your Paystack dashboard in **Test mode**
- **Supabase**: your RollCol project in the Supabase dashboard, and the command line in the project folder
- **App**: the RollCol development build on your iPhone

**Paystack test card that works:** `4084 0840 8408 4081`, CVV `408`, any future expiry date.

**Test accounts** (password `RollCol-Test-2026`)

| Account | Who |
|---|---|
| basic.admin@rollcol.test | Grace Adjei, admin of Test: Adenta Basic School |
| basic.teacher1@rollcol.test | Samuel Ankrah, teacher there; owner of a classes workspace |

---

## Part A: Installation

1. **Extract** `rollcol-part8b-fixes.zip` into the project folder, replacing files when asked. There is no new migration and no new package.
2. **Redeploy the payment function** (it now reports and logs its errors):
   ```
   pnpm exec supabase functions deploy paystack --no-verify-jwt
   ```
3. **Check the function's secrets:**
   ```
   pnpm exec supabase secrets list
   ```
   The list must include `PAYSTACK_SECRET_KEY` and `SITE_URL`. (`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase itself and may also be listed.)
4. **Check the Paystack webhook** (Paystack dashboard, Test mode, **Settings > API Keys & Webhooks**): **Test Webhook URL** must be `https://YOUR-PROJECT-REF.supabase.co/functions/v1/paystack` and **Test Callback URL** `https://rollcol.vercel.app/dashboard/billing/return`. Save if you changed anything.
5. **Deploy the website:** commit and push, then wait for Vercel to finish the deployment.
6. **App:** no new build is needed. Restart the development server from `apps/mobile`:
   ```
   pnpm exec expo start --dev-client --clear
   ```
   then open the RollCol app on your iPhone and let it load the new code.

---

## Part B: Tests

### Test 1: the payment you already made is applied

1. **Website**, signed in as **basic.admin@rollcol.test**: open **Billing**.
2. Expected, if your earlier payment was less than two days ago: a notice **"A payment is not completed"** shows **Checking...** for a moment. Then either:
   - the page changes to **"Payment received"**, the plan card shows your plan, and the payment shows **Paid** with a **Receipt** link. The problem is fixed; go to Test 2.
   - or a yellow notice **"We could not confirm the payment"** gives the real reason. Send me that sentence, and also do step 3.
3. Only if you got the yellow notice: **Supabase** dashboard, **Edge Functions > paystack > Logs**. Find the lines that start with `paystack:` and send me them (they never contain the secret key).

If the earlier payment is more than two days old, it is not checked; go straight to Test 2.

### Test 2: a new payment completes

1. **Website**, as **basic.admin@rollcol.test**: on **Billing**, pay for SMS credits: under **SMS credits**, choose the **100 credits** pack (the cheapest test).
2. **Paystack** page: pay with the test card above.
3. Expected: Paystack returns you to **Billing** with **"Payment received"**, the payment listed as **Paid**, a **Receipt**, and the SMS credits higher by 100.
4. If instead you see **"Waiting for Paystack"**: wait. Within two minutes it should change to **"Payment received"** by itself. If a yellow notice appears, send me its sentence.

### Test 3: real errors when a payment cannot start

1. **Website on localhost** (http://localhost:3000, after `pnpm dev` in `apps/web`), as **basic.admin@rollcol.test**: on **Billing**, start any payment.
2. Expected: either Paystack's page opens, or a red message starting **"Paystack could not start the payment:"** followed by the real reason. Send me that message if you get one.
3. Note: after paying from localhost, Paystack returns you to the live site (the function's `SITE_URL`), which is expected. The payment is still applied there.

### Test 4: the app keeps you signed in

1. **App**, on your iPhone: sign in as **basic.teacher1@rollcol.test**.
2. Close the app completely (swipe it away in the app switcher). Wait one minute, then open it again.
3. Expected: you are still signed in, on the first tab, without the sign-in screen.
4. Leave the app in the background for at least an hour (or overnight), then open it.
5. Expected: still signed in.
6. **Website**: sign in as **basic.teacher1@rollcol.test**, then click **Sign out** in the menu.
7. **App**: close and reopen the app. Expected: still signed in (signing out on the website signs out only the website).

### Test 5: notifications on the website

1. **Website**, signed in as **basic.teacher1@rollcol.test**: look at the menu. Expected: **Notifications** above **Your account**. If there are unread notifications, a number shows beside it.
2. Click **Notifications**. Expected: the same notifications the app shows (for example the workspace move notices from Part 7b), newest first, each with its date and time. Move notices have an **Open** link that goes to the move.
3. Expected: the number beside **Notifications** in the menu disappears after the page opens.
4. Click **Remove** on one notification. Expected: it disappears. **App**, as the same account: open the **Notifications** tab. Expected: it is gone there too.
5. **Website**: click **Clear all**. Expected: RollCol's own dialog (not the browser's) asks **"Clear all notifications?"**. Click **Clear all**. Expected: **"No notifications."**

### Test 6: notification settings on the website

1. **Website**, as **basic.teacher1@rollcol.test**: on **Notifications**, under **Notification settings**, turn **Workspace moves** off.
2. **App**, as the same account: **Account > Notifications**. Expected: **Workspace moves** is off.
3. **App**: turn it back on. **Website**: refresh the page. Expected: it is on.

### Test 7: terms of use

1. **Website**, signed out: on the home page, scroll to the footer. Expected: **Pricing**, **Privacy policy**, **Terms of use**.
2. Click **Terms of use**. Expected: the terms page with the site header and footer, a contents box, and 15 sections; the links in the contents box jump to each section.
3. Open **Sign in**. Expected: **Privacy policy** and **Terms of use** under the form.
4. Open **Register your school**. Expected: the line under the button says **"By registering, you agree to our terms of use and to handle student and guardian details as described in our privacy policy."** with both links working. Same on **Start a workspace**.

### Test 8: the price calculator

1. **Website**, signed out: open **Pricing** and click **Price calculator** in the row of links at the top.
2. With **Basic or SHS**, **Alerts** and **300** students. Expected: **GHS 900** each term, **GHS 2,700** for a school year (3 terms), and the trial note.
3. Click **Complete**. Expected: **GHS 1,800** each term, and **"Includes 600 SMS credits each term."**
4. Choose **500 credits (GHS 90)** under extra SMS credits. Expected: **GHS 1,890** each term and **GHS 5,670** a year.
5. Click **University or college** and type **150**. Expected: **GHS 450** each semester, **GHS 900** a year (2 semesters), the note that 150 students fit in the free plan (up to 200), and no SMS credits choice.
6. Click **My own classes** and type **40**. Expected: **GHS 160** each term and the note that 40 students fit in the free plan (up to 50 across your workspaces), without attendance SMS.
7. Type **0**, then clear the box. Expected: a red hint asking for a whole number from 1 to 100,000, and no total.
