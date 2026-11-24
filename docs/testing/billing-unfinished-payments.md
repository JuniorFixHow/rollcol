# Testing unfinished payments and the new payment wording

What this changes:

- **Wording:** the buttons no longer say "with Paystack". They now say **Pay GHS 900** (or **Continue to payment**) and **Opening the payment page...**. The notices say "Confirming your payment" instead of "Waiting for Paystack". Receipts still name Paystack as the processor, as receipts normally do.
- **Payments list:** each payment shows **Paid**, **Waiting**, **Cancelled**, **Not completed** or **Failed**.
- **Cancel:** a payment that is still **Waiting** has a **Cancel** button.
- **Unfinished payments close by themselves:** a payment left unfinished on the payment page closes as **Not completed** after 30 minutes, the next time Billing checks it, and the notice goes away.
- **Nothing paid is lost:** if Paystack confirms a payment after it was cancelled or closed, it is still added, with a receipt.
- **Nothing blocks a new purchase:** a waiting, cancelled or unfinished payment never stops the admin from paying again. Only a term that is already paid blocks buying a plan for that same term again.

**Where:** Website, https://rollcol.vercel.app (do every payment test on the live site, since Paystack always returns to the live site). **Paystack**: the payment page.

**Account:** **basic.admin@rollcol.test** (password `RollCol-Test-2026`).

## Installation

1. Extract `rollcol-billing-unfinished.zip` into the project folder, replacing files when asked.
2. Update the database. It should list `20261203000000_billing_cancel.sql`:
   ```
   pnpm exec supabase db push --remote
   ```
3. Redeploy the payment function:
   ```
   pnpm exec supabase functions deploy paystack --no-verify-jwt
   ```
4. Commit and push, then wait for Vercel to finish.

## Tests

### Test 1: the new wording

1. **Website**, as **basic.admin@rollcol.test**: open **Billing**.
2. Expected: the payment buttons say **Pay GHS ...** or **Continue to payment**, and the plan section says "Paid once for the whole term, by Mobile Money or card." Nothing on the buttons says Paystack.

### Test 2: your earlier unfinished payment

1. **Website**, Billing: look at **Payments**.
2. Expected: the payment you started on the local server shows **Paid** if it went through, with a **Receipt**.
3. Any payment you started but never finished shows **Waiting**, with **Cancel**. If it was started more than 30 minutes ago, the notice at the top checks it within a few seconds. The page then reloads and the payment shows **Not completed** ("Not finished on the payment page"), and the notice is gone.

### Test 3: cancel a payment you did not finish

1. **Website**, Billing: under **SMS credits**, click the **100 credits** pack.
2. **Paystack** page: do not pay. Close the tab, or use your browser's back button to return to Billing.
3. **Website**, Billing, refresh. Expected: a notice "A payment is not completed", and in **Payments** the new payment shows **Waiting**, with **Cancel**.
4. Click **Cancel**, then **Cancel** in RollCol's dialog.
5. Expected: the payment shows **Cancelled**, and the notice is gone.
6. Buy the **100 credits** pack again and pay with the test card `4084 0840 8408 4081`, CVV `408`. Expected: **Payment received**, a **Paid** row with a **Receipt**, and 100 more SMS credits. The cancelled payment did not get in the way.

### Test 4: changing the plan

1. **Website**, Billing, if this term is paid on **Alerts**: the card **Change this term's plan** offers **Upgrade to Complete** (you pay the difference for the students already paid for) and **Pay for more students**.
2. If this term is on **Complete**: only **Pay for more students** is offered, because Complete is the top plan for basic schools.
3. To choose a different plan for next term: the card **Pay for another term** lists, in its term box, every term in **Academics** that is not paid yet. Choose next term, pick **Alerts** or **Complete**, and pay. If next term is not listed, add it under **Academics** first.
