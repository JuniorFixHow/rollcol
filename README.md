# RollCol

School attendance by Teqxa. See `CLAUDE.md` for the product decisions and build plan.

## First-time setup (Windows)

1. Install Node.js 22 or newer, then enable pnpm:
   ```
   corepack enable
   ```
2. Install dependencies from the repository root:
   ```
   pnpm install
   ```
3. Create the Supabase project (on your new Supabase account), then link it:
   ```
   pnpm exec supabase login
   pnpm exec supabase init
   pnpm exec supabase link --project-ref YOUR-PROJECT-REF
   pnpm exec supabase db push --remote
   ```
   `supabase init` only adds `supabase/config.toml`; the existing `migrations` folder is kept.
4. Copy the env examples and fill in your project URL and keys:
   - `apps/web/.env.example` to `apps/web/.env.local`
   - `apps/mobile/.env.example` to `apps/mobile/.env`
5. Run:
   ```
   pnpm dev:web
   pnpm dev:mobile
   ```
   Run Expo from PowerShell or a terminal that shows the drive as `D:\`. In Git Bash the drive is `d:`, and Metro then cannot find `@rollcol/shared` (the pnpm link points at `D:\`).

## Supabase settings (Part 2)

In the Supabase dashboard:

1. **Authentication > URL Configuration:** set Site URL to the web address (`http://localhost:3000` locally, your real domain later) and add `<site>/auth/confirm` to the redirect URLs.
2. **Authentication > Emails > SMTP Settings:** turn on custom SMTP (for example Resend, Brevo or Zoho Mail with a domain you own). Supabase's built-in email is for trying things out only: it sends very few emails an hour and only to your own team's addresses, so invites to other people will not arrive without this.
3. **Authentication > Emails > Templates:** paste each file from `supabase/templates/` into its template (switch the editor to source/HTML) and set the subject:

   | Template | File | Subject |
   |---|---|---|
   | Confirm signup | `confirm-signup.html` | Confirm your email for RollCol |
   | Invite user | `invite.html` | You have been invited to RollCol |
   | Reset password | `reset-password.html` | Reset your RollCol password |
   | Change email address | `change-email.html` | Confirm your new email for RollCol |

   The links in these templates go through the web app's `/auth/confirm`, so they work when opened on a phone too.
4. **Edge Function for in-app account deletion:**
   ```
   pnpm exec supabase functions deploy delete-account
   ```
5. **Platform owner:** after signing up once with your own email, run in the SQL editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'YOUR-EMAIL';
   ```
   Then `/platform` lists schools to verify or suspend.
6. After linking, regenerate types with `pnpm db:types`. Until then `packages/shared/src/database.types.ts` was written from the migrations in the same format.

### How sign-in works

- One account (one email and password) can belong to **several schools**: staff at one and a student at another, staff at two schools, or a student at two schools. Within a school a person has one role.
- Each school has a six-character **school code**. Sign-in uses either email and password, or school code, school ID and password. Signing in with a school code opens that school first.
- The web dashboard and the mobile app show one school at a time. People in more than one school switch with the school picker (web sidebar, or "Your schools" in the app). Access rules in the database allow every school a person belongs to, with their role in each.
- For the school ID route, `sign_in_email()` returns the account's email only when the password is right, and the app then signs in with Supabase Auth as usual. Ten failures in 15 minutes lock that school ID for 15 minutes.
- Admins register schools on the web; people already on RollCol choose **Register another school** under Your account. Staff are added from Staff: someone new gets an invite email, and someone who already has a RollCol account is added straight away. Tertiary students create their accounts in the mobile app with the school code, and can join another school later from "Your schools"; admins approve them if the school requires it.
- Removing a staff member deletes their account only if it no longer belongs to any school.

## SMS (Part 4)

RollCol sends SMS through **Sailup** with the sender ID **RollCol**, using two Edge Functions: `send-sms` sends what is due, and `sms-delivery` receives Sailup's delivery reports. Until you switch it on, sending runs in **test mode**: every message is recorded on the Messages page as "Test only" and nothing reaches a phone.

### Set up (test mode)

1. Pick a long random secret (for example from a password manager). It lets the database wake the sender.
2. Deploy both functions from the repository root:
   ```
   pnpm exec supabase functions deploy send-sms --no-verify-jwt
   pnpm exec supabase functions deploy sms-delivery --no-verify-jwt
   ```
3. In the Supabase dashboard, open Edge Functions > Secrets and add `CRON_SECRET` with your secret.
4. In SQL Editor, run (with your project reference and the same secret):
   ```sql
   insert into private.config (key, value) values
     ('sms_sender_url', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-sms'),
     ('cron_secret', 'YOUR-SECRET')
   on conflict (key) do update set value = excluded.value;
   ```

### Send real SMS with Sailup

1. In the Sailup dashboard, open the RollCol project and create an API key (it starts with `sailup_`).
2. Under **Webhooks**, add `https://YOUR-PROJECT-REF.supabase.co/functions/v1/sms-delivery` with the events `message.delivered`, `message.failed`, `message.expired` and `message.rejected`. Copy the secret it shows (it is shown only once).
3. In Supabase Edge Functions > Secrets add:
   - `SMS_PROVIDER` = `sailup`
   - `SMS_SENDER_ID` = `RollCol`
   - `SAILUP_API_KEY` = the API key
   - `SAILUP_WEBHOOK_SECRET` = the webhook secret
4. To go back to test mode, set `SMS_PROVIDER` to `test`.

If messages stay on "Waiting", open `/platform`: the **SMS sender** card says what is wrong (setup missing, secret mismatch, function deployed without `--no-verify-jwt`, or a missing Sailup secret).

Keep the Sailup account topped up: if it runs out, messages fail and schools get their credits back. Only verified schools send SMS. Add SMS credits to a school from the platform page (`/platform`, SMS column).

## Test data

1. Open `supabase/test-data/load.sql` and set your own email (so you become admin of every test school) and your phone number (the only number test guardians use) at the top.
2. In the Supabase dashboard, open SQL Editor > New query, paste the file and run it. The result lists every test sign-in (school code, school ID, email and password).
3. To remove it, run `supabase/test-data/remove.sql` the same way.

How to test each part is in `docs/testing/`.

## Mobile builds

From `apps/mobile`:
```
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile development --platform ios
```
`eas init` links the app to your Expo account and writes the project ID into `app.json`.
Bundle identifier and Android package are `com.teqxa.rollcol`; change them in `app.json` before the first build if you prefer another.

## Checks

```
pnpm typecheck
pnpm test
```
