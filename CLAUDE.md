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

Commands: `pnpm dev:web`, `pnpm dev:mobile`, `pnpm typecheck`, `pnpm test`, `pnpm exec supabase db push --remote` (this CLI version needs `--remote` for the hosted project), `pnpm db:types` (after `supabase link`).

Test data: `supabase/test-data/load.sql` (run in the Supabase SQL Editor after setting your email and phone at the top) creates three verified "Test:" schools with accounts ending in @rollcol.test; `remove.sql` deletes them. Keep `load.sql` up to date when a part adds tables that need sample rows.

Every part ends with a test guide in `docs/testing/part-N.md`: setup steps, then what to try on web and mobile, and what should happen.
Add mobile packages with `npx expo install <pkg>` from `apps/mobile`, never `pnpm add`, so versions match the SDK.

## Code rules

- TypeScript strict everywhere. **Never use `any`**, not even in tests or casts. Use `unknown` plus Zod parsing for untrusted input, and generated Supabase types for rows.
- Validation lives in `packages/shared` and is shared by web and mobile.
- Security rules are enforced in the database (RLS, Row Level Security; constraints; `security definer` functions), never only in the app.
- Every new table must enable RLS and have explicit `grant` statements; Supabase does not grant API access to new tables automatically.
- Applied migrations are never edited. Changes go in a new migration file.
- Supabase blocks DELETE and UPDATE without a WHERE clause in API requests (safeupdate), including inside functions they call. Every DELETE and UPDATE needs a WHERE; avoid scratch tables that need emptying.
- One account can belong to several schools. Never assume a single school per user: access rules check `school_id in (select private.my_school_ids())` (or the staff, admin and student variants), and app code uses the school on screen (`member.school.id`), always filtering queries by it.
- Use the database clock (`now()`) for anything time sensitive. Never trust the device clock.
- App text: hyphenate compound words correctly ("built-in", "check-in" as a noun, "per-period"), and do not use em dashes. In Ghana an academic block is a **term** (non-tertiary) or **semester** (tertiary). "Period" means one class slot in a school day.
- Styling must look professional and calm: it is a school product. Support light and dark themes everywhere: web colours come from CSS variables in `globals.css` (people can also choose Light or Dark, stored in localStorage as `rollcol-theme`); mobile colours come from `usePalette()` (the choice is applied with `Appearance.setColorScheme`). Never hard-code colours that only work in one theme.
- Never use the browser's own dialogs (`window.confirm`, `alert`, `prompt`): use `useConfirm()` from `components/confirm-dialog.tsx` (and `InlineAction`'s `confirm` prop, which uses it). Scrollbars are slim and themed in `globals.css`; do not reintroduce default ones.
- Pages that read the session get it through `getSession()`, which calls `connection()` first so Next.js does not prerender signed-in pages.
- Password fields always have a show or hide (eye) button: `TextField type="password"` on the web and `Field secureTextEntry` on mobile do this automatically.
- Every action with lasting effects (turning people off, removing, deleting, changing roles) asks first with a dialog that says plainly what will happen and what will not.
- Term and semester totals are worked out from the term's dates (`class_attendance_summary`), never from a stored link, so editing or removing a term loses nothing.
- Mobile theme: `lib/appearance.ts` holds the person's choice; `usePalette()` reads it (and the system scheme for Automatic).
- Labels sit on one line above inputs and hints go below them, so fields in a row line up. A submit button in a row of fields goes in `FieldButton`, in a grid with `items-start`.
- Brand: the mark is a tick that doubles as a raised arm answering the roll call. The vector source is `apps/web/src/app/icon.svg`; icons live in `apps/mobile/assets/images` and `apps/web/src/app` (favicon.ico, icon.svg that follows the browser theme, apple-icon.png) and `apps/web/public/icons`.
- Android: splash images keep the logo inside the centre circle (Android 12+ crops to it), with separate light and dark splash colours. `plugins/with-dark-window-background.js` sets the dark window colour so dark-mode phones do not flash white after the splash.
- Every permission the mobile app requests needs a specific, honest permission string (Apple is strict).
- The mobile app sells nothing: no prices, plans, upgrade prompts or payment hints, ever. Payments are web only (Paystack).
- iOS: use Apple's standard EULA (https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) as Terms of Use; offer in-app account deletion and a privacy policy link on sign-in and sign-up.

## Product decisions

### Schools and onboarding
- A school picks its type at sign-up: `tertiary` or `non_tertiary`. Non-tertiary schools pick a register mode: `daily` (basic schools) or `per_period` (SHS, every subject period).
- Same onboarding as Stediis: public self sign-up, schools start **unverified** with limits (10 students, 10 staff; at most 3 unverified schools per person) until the platform owner approves them. Admin chooses whether new students need approval. Sign-in with school ID covers staff and students (use a generic term, not "Student ID"). School ID formats vary (numeric or letters then numbers, varying length).
- People can belong to several schools (staff at one and a student at another, and so on), with one role per school. The web and the app show one school at a time with a school switcher; the web remembers the choice in the `rollcol_school` cookie, the app in device storage.
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
- Teachers can mark offline and sync later. The mobile app keeps an outbox in AsyncStorage (`apps/mobile/src/lib/registers.ts`): start, marks, submit, sent in order. Registers get their id on the phone (`expo-crypto`), and `open_register` returns the existing register if another device started it first.
- Reward marks per register are optional and set by the teacher when starting it (0 to 100, quarters allowed). Present and late both earn them. Totals per term come from `class_attendance_summary`.
- Teachers can change marks on the register's own day (also after it closes); admins at any time. Writes go only through `open_register`, `save_register_marks` and `submit_register`.
- Periods: `school_settings.periods_per_day` (1 to 20, default 10) with an optional per-class override `classes.periods_per_day`; `private.class_periods()` gives the effective number, and a trigger rejects periods beyond it.
- Next.js instant-navigation checks run only on segments that set `instant` (`experimental.instantInsights.validationLevel = "manual-warning"`), because every page depends on the signed-in user.
- Closing: daily registers at the school's `daily_register_closes_at` (default 10:00, or 30 minutes after starting if later); period registers `period_register_minutes` after starting (default 60). A pg_cron job closes them every minute.
- Teachers see each student's record and the class with accumulated marks. Students cannot see anything.

### Guardians and SMS
- Guardians are contacts on a child's record (name, phone, relationship), identified by normalised phone number within a school. No email channel.
- Settings: **attendance alerts** switch per guardian on each student; **broadcasts** switch per guardian for the whole school. Broadcasts go once per guardian, however many children they have.
- Messages to a guardian with several children are combined (maximum 3 names, then summarised). Guardians linked to more than 5 students are flagged to the admin.
- Guardian added, removed, number changed, alerts turned off, alerts turned on: the guardian always gets an SMS. These system messages are free to the school.
- Admin manages guardians and can delegate "Manage guardians" to teachers, limited to their own classes, with an expiry date. Changes record who made them; admin gets a daily summary of delegated changes; teacher is told a day before expiry; changes stay after expiry.
- Parents get present and absent alerts (plan dependent), custom messages from teachers, and broadcasts such as PTA (Parent-Teacher Association) meetings. Messaging features are non-tertiary only.
- Every SMS goes through one `sms_outbox` table (migration `20261121000000_sms.sql`) and the `send-sms` Edge Function. A pg_cron job every minute (`private.run_sms_pipeline`) turns register results and guardian events into messages and wakes the sender through pg_net with `x-cron-secret`. Settings for that call live in `private.config` (`sms_sender_url`, `cron_secret`); provider secrets live only in Edge Function secrets.
- Attendance alerts wait 15 minutes after a register is submitted or closes, only for today's registers, only for verified schools. Daily registers alert absent and late (and present to the one chosen guardian when the school turns present alerts on). Period registers alert only the first period a child misses each day. A child marked absent who is corrected to present or late sends an "arrived" update.
- All alerts for one guardian in one run are combined into one SMS; if that would take more than one SMS it is summarised instead. Quiet hours are a school setting (`sms_quiet_hours`, `sms_quiet_start`, `sms_quiet_end`; default on, 21:00 to 07:00 Ghana time) and can be turned off for schools with evening classes. `private.sms_send_time(school_id)` decides when a message may go; changing the setting reschedules waiting messages. `/platform` shows the sender's last replies (`platform_sms_sender_log`, from pg_net) to diagnose messages stuck on Waiting.
- Credits: one credit per SMS segment, ledger in `sms_credit_entries` (positive adds, negative uses). Charged messages without enough credits are stored as `no_credit` and never sent. Failures retry twice, five minutes apart, then refund. System messages are free. Broadcasts and custom messages: at most 3 SMS each.
- The SQL `private.sms_clean` and `private.sms_segments` are authoritative; the shared `sanitiseForSms` and `messageCost` only preview costs in the composer.
- The SMS provider is **Sailup** (sender ID "RollCol"; API `POST https://api.sailup.io/v1/sms/`, Bearer key). `SMS_PROVIDER` is `test` by default (records messages as sent with provider id "test", nothing leaves RollCol); `sailup` is the live setting; `arkesel` remains as a spare adapter. One request per message so each has its own Sailup id in `provider_id`.
- Delivery reports: the `sms-delivery` Edge Function verifies `X-Sailup-Signature` (HMAC-SHA256 of "{X-Sailup-Timestamp}.{raw body}" with `SAILUP_WEBHOOK_SECRET`), refuses reports older than 15 minutes, and calls `record_sms_delivery`. `sms_outbox.delivery` is pending, delivered, failed, expired or rejected; "delivered" is final. No refund for network delivery failures (the provider still charges). `guardians_not_reached` shows a "Last SMS not delivered" badge on the student page for admins and the student's teachers.
- First bulk guardian import counts against SMS credits, one combined message per guardian, held until a reasonable hour.

### Pricing (per student; per term for non-tertiary, per semester for tertiary)
- Non-tertiary: **Free** (registers, records, marks; no SMS except system messages), **trial** of full alerts for 2 to 4 weeks after verification, **Alerts GHS 3** (absence and late alerts), **Complete GHS 6** (adds daily present alerts to one chosen guardian per student, SHS as a daily digest, term reports, included broadcast credits). SMS top-ups for broadcasts and custom messages.
- Tertiary: free up to 200 students with every anti-cheat feature; Standard GHS 2 to 3 (saved venues, exports, analytics, admin oversight). Anti-cheat is never a paid feature.
- Later: teacher and lecturer workspaces (Google Classroom style; free limit counts all workspaces an account owns; free workspaces send no attendance SMS; priced slightly above school rates; can move into a school account) and a Stediis bundle discount.

## Build plan

1. **Monorepo setup** (done): pnpm + Turborepo, Next.js, Expo, shared package, Supabase extensions migration.
2. **Schema, RLS and auth** (done): schools, staff and roles, programmes, batches, courses, runs, enrolments, classes, students, guardians and links, settings. School sign-up and verification. School ID sign-in.
3. **Non-tertiary registers** (done): daily and per-period marking on web and mobile, offline sync, auto close, term totals on the class page. Also: logo and icons, light and dark themes with a manual choice, privacy policy, aligned form fields.
4. **SMS outbox** (done, except the admin's daily summary of delegated changes): alerts, grace period, combining, quiet hours, opt-outs, guardian system messages, broadcasts and custom messages, credits, Messages page.
5. **Tertiary sessions:** check-in function, location and venues, device binding and changes, biometrics, rotating QR, push notifications, live count.
6. **Records, marks and reports** on web and mobile; exports; GES (Ghana Education Service) register export.
7. **Billing:** Paystack plans, trials, SMS credits and top-ups (web only).
8. **Stediis link:** sync API, webhooks, "Continue with Stediis".
9. **Launch preparation:** public pages, in-app help, onboarding screens, permission strings, store listings, replace all test settings and secrets.
