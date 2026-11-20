# RollCol

Attendance app for schools, by Teqxa. Owner: Junior Roberts Annan.

- **Tertiary schools:** students check themselves in on their phones during sessions a lecturer opens.
- **Non-tertiary schools (basic and SHS, Senior High School):** teachers mark class registers. Students have no accounts. Parents never use the app; they only receive SMS (Short Message Service) alerts.

Read `apps/web/AGENTS.md` before touching Next.js code and `apps/mobile/AGENTS.md` before touching Expo code. Both frameworks have breaking changes newer than most training data.

## Repository

pnpm workspaces + Turborepo. `node-linker=hoisted` is required for Expo.

| Path | What |
|---|---|
| `apps/web` | Next.js (App Router) on Vercel: admins and teachers, billing, public pages |
| `apps/mobile` | Expo (React Native) with Expo Router: students, teachers, lecturers. Built with EAS (Expo Application Services) cloud builds, because development happens on Windows |
| `packages/shared` | Zod schemas, constants, phone and SMS helpers, Supabase types. Consumed as TypeScript source (no build step) |
| `supabase/migrations` | SQL migrations. Supabase project is separate from Stediis and Nkaebo |

Commands: `pnpm dev:web`, `pnpm dev:mobile`, `pnpm typecheck`, `pnpm test`, `pnpm db:types` (after `supabase link`).
Add mobile packages with `npx expo install <pkg>` from `apps/mobile`, never `pnpm add`, so versions match the SDK.

## Code rules

- TypeScript strict everywhere. **Never use `any`**, not even in tests or casts. Use `unknown` plus Zod parsing for untrusted input, and generated Supabase types for rows.
- Validation lives in `packages/shared` and is shared by web and mobile.
- Security rules are enforced in the database (RLS, Row Level Security; constraints; `security definer` functions), never only in the app.
- Use the database clock (`now()`) for anything time sensitive. Never trust the device clock.
- App text: hyphenate compound words correctly ("built-in", "check-in" as a noun, "per-period"), and do not use em dashes. In Ghana an academic block is a **term** (non-tertiary) or **semester** (tertiary). "Period" means one class slot in a school day.
- Styling must look professional and calm: it is a school product.
- Every permission the mobile app requests needs a specific, honest permission string (Apple is strict).
- The mobile app sells nothing: no prices, plans, upgrade prompts or payment hints, ever. Payments are web only (Paystack).
- iOS: use Apple's standard EULA (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) as Terms of Use; offer in-app account deletion and a privacy policy link on sign-in and sign-up.

## Product decisions

### Schools and onboarding
- A school picks its type at sign-up: `tertiary` or `non_tertiary`. Non-tertiary schools pick a register mode: `daily` (basic schools) or `per_period` (SHS, every subject period).
- Same onboarding as Stediis: public self sign-up, schools start **unverified** with limits until the platform owner approves them. Admin chooses whether new students need approval. Sign-in with school ID covers staff and students (use a generic term, not "Student ID"). School ID formats vary (numeric or letters then numbers, varying length).
- Tertiary course joining works as in Stediis (students join courses they are registered for, no roster upload).
- Schema mirrors Stediis concepts (school, programme, batch, course, run, enrolment). Every such record has `source` (`rollcol` or `stediis`) and `external_id`.

### Stediis link (later part)
- A tertiary admin can "Connect Stediis". Stediis is the source of truth; synced records are read-only in RollCol ("Managed in Stediis"). Sync by webhook plus a nightly job, through a secured server-to-server API on Stediis with a per-school key.
- Users of linked schools sign in with "Continue with Stediis" (Stediis signs them in and returns a short-lived signed token that RollCol verifies; RollCol never sees Stediis passwords). Deleting a RollCol account deletes only RollCol data. Identity and billing are independent.
- Later: send attendance marks back to Stediis.

### Tertiary sessions
- Lecturer sets: course, duration, optional radius (metres, minimum 50), optional reward marks, optional rotating QR (Quick Response) code, start now or scheduled.
- Location centre: lecturer's live location when started from the mobile app; a **saved venue** when started on the web (laptop location is unreliable).
- Check-in is **mobile only** and goes through one Postgres function that checks: session open (database clock), student registered for the course, bound device, device not already used for this session, distance with PostGIS `ST_DWithin` allowing for reported accuracy, QR token if required. Unique constraint on (session, student). Mocked locations (Android reports them) are rejected or flagged.
- Biometric confirmation at check-in (`expo-local-authentication`).
- Rotating QR token: HMAC (Hash-based Message Authentication Code) of the session secret and the current 15 second window; server accepts current and previous window.
- Notifications (Expo push): session opened, 5 minutes left (server scheduled), closed with present or missed, lecturer adjustments.
- Reward marks accumulate per course per semester. Lecturer can void a session or manually add a student, always with a logged reason.
- Live check-in count for the lecturer via Supabase Realtime.

### Device binding
- Each student account is bound to one device (secret in `expo-secure-store`, registered server side).
- New device: active automatically after a **48 hour cooldown**, or immediately if an **admin** approves. Lecturers cannot approve. Maximum **2 changes per semester**, after that admin only.
- The old device gets a push warning when the account signs in on a new phone.
- During a cooldown, a lecturer can manually add the student to a session (logged reason).
- Later: Apple App Attest and Google Play Integrity.

### Non-tertiary registers
- Basic schools: class teacher marks once a day. SHS: subject teacher per period (or daily if the school chooses).
- Statuses: present, late, absent, not marked. Unmarked children are never treated as absent.
- A register ends when the teacher submits it, or closes automatically at a set time.
- SMS alerts wait a **15 minute grace period** after closing so mistakes can be fixed. Changing absent to late sends a follow-up ("arrived at 8:40am").
- Teachers can mark offline (`expo-sqlite`) and sync later.
- Teachers see each student's record and the class with accumulated marks. Students cannot see anything.

### Guardians and SMS
- Guardians are contacts on a child's record (name, phone, relationship), identified by normalised phone number within a school. No email channel.
- Settings: **attendance alerts** switch per guardian on each student; **broadcasts** switch per guardian for the whole school. Broadcasts go once per guardian, however many children they have.
- Messages to a guardian with several children are combined (maximum 3 names, then summarised). Guardians linked to more than 5 students are flagged to the admin.
- Guardian added, removed, number changed, alerts turned off, alerts turned on: the guardian always gets an SMS. These system messages are free to the school.
- Admin manages guardians and can delegate "Manage guardians" to teachers, limited to their own classes, with an expiry date. Changes record who made them; admin gets a daily summary of delegated changes; teacher is told a day before expiry; changes stay after expiry.
- Parents get present and absent alerts (plan dependent), custom messages from teachers, and broadcasts such as PTA (Parent-Teacher Association) meetings. Messaging features are non-tertiary only.
- Every SMS goes through one `sms_outbox` table and one sender Edge Function: combining per guardian, quiet hours (held until morning), credit deduction, delivery reports via webhook (teachers see failed numbers). Every message passes `sanitiseForSms` and stays within one 160 character GSM-7 segment where possible.
- First bulk guardian import counts against SMS credits, one combined message per guardian, held until a reasonable hour.

### Pricing (per student; per term for non-tertiary, per semester for tertiary)
- Non-tertiary: **Free** (registers, records, marks; no SMS except system messages), **trial** of full alerts for 2 to 4 weeks after verification, **Alerts GHS 3** (absence and late alerts), **Complete GHS 6** (adds daily present alerts to one chosen guardian per student, SHS as a daily digest, term reports, included broadcast credits). SMS top-ups for broadcasts and custom messages.
- Tertiary: free up to 200 students with every anti-cheat feature; Standard GHS 2 to 3 (saved venues, exports, analytics, admin oversight). Anti-cheat is never a paid feature.
- Later: teacher and lecturer workspaces (Google Classroom style; free limit counts all workspaces an account owns; free workspaces send no attendance SMS; priced slightly above school rates; can move into a school account) and a Stediis bundle discount.

## Build plan

1. **Monorepo setup** (done): pnpm + Turborepo, Next.js, Expo, shared package, Supabase extensions migration.
2. **Schema, RLS and auth** (done): schools, staff and roles, programmes, batches, courses, runs, enrolments, classes, students, guardians and links, settings. School sign-up and verification. School ID sign-in.
3. **Non-tertiary registers:** daily and per-period marking on web and mobile, offline sync, auto close.
4. **SMS outbox:** alerts, grace period, combining, quiet hours, opt-outs, guardian system messages, delegation, broadcasts and custom messages, delivery reports.
5. **Tertiary sessions:** check-in function, location and venues, device binding and changes, biometrics, rotating QR, push notifications, live count.
6. **Records, marks and reports** on web and mobile; exports; GES (Ghana Education Service) register export.
7. **Billing:** Paystack plans, trials, SMS credits and top-ups (web only).
8. **Stediis link:** sync API, webhooks, "Continue with Stediis".
9. **Launch preparation:** public pages, in-app help, onboarding screens, permission strings, store listings, replace all test settings and secrets.
