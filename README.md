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
   pnpm exec supabase db push
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

1. **Authentication > URL Configuration:** set Site URL to the web address (`http://localhost:3000` locally) and add `<site>/auth/confirm` to the redirect URLs.
2. **Authentication > Email Templates:** point each link at the web app so it works from phones too:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
     (admins then finish setting up their school; students are told to sign in on the app)
   - Invite user: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/password`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/password`
   The confirm route also accepts the default `?code=` links, so this step only makes links more reliable across devices.
3. **Edge Function for in-app account deletion:**
   ```
   pnpm exec supabase functions deploy delete-account
   ```
4. **Platform owner:** after signing up once with your own email, run in the SQL editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'YOUR-EMAIL';
   ```
   Then `/platform` lists schools to verify or suspend.
5. After linking, regenerate types with `pnpm db:types`. Until then `packages/shared/src/database.types.ts` was generated from the migrations in the same format.

### How sign-in works

- Everyone belongs to one school, as staff or as a student. Each school has a six-character **school code**.
- Sign-in uses either email and password, or school code, school ID and password. For the school ID route, `sign_in_email()` returns the account's email only when the password is right, and the app then signs in with Supabase Auth as usual. Ten failures in 15 minutes lock that school ID for 15 minutes.
- Admins register schools on the web. Staff are invited by email from Staff. Tertiary students create their accounts in the mobile app with the school code; admins approve them if the school requires it.

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
