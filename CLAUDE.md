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

- Implementation (migration `20261122000000_sessions.sql`): `venues` (PostGIS point and radius), `attendance_sessions` (one at a time per course run, exclusion constraint; `qr_secret` is never granted to apps), `session_checkins` (primary key session and student; unique session and device), `session_adjustments` (every manual change with a reason). Functions: `start_session`, `end_session` (removes a session that has not started), `void_session`, `check_in`, `add_checkin_manually`, `remove_checkin`, `session_roster`, `session_qr`, `my_open_sessions`, `school_venues`.
- Distance: within the radius after allowing up to 50 metres of the phone's stated accuracy; accuracy worse than 100 metres is refused. Corrections allowed for 14 days after a session ends.
- QR payload: a web link `{SITE_URL}/checkin/{session id}?t={12 hex token}` (`sessionQrPayload`, `parseSessionQr`; `SITE_URL` in shared constants, change at launch). Any camera or QR app opens it; the public web page `/checkin/[id]` hands over to the app (`rollcol://checkin/...`, or a Chrome intent link on Android). The app calls `claim_qr` at once (accepts the current code and the two before it) and gets a two-minute, one-use pass for that student and session, then does Face ID and location and sends the pass as `p_qr_token`. At launch, with a domain, add iOS associated domains and Android App Links so the link opens the app without the web page (needs that build). Token: first 12 hex characters of HMAC-SHA256(window number, session secret), window = 15 seconds.
- Push: `push_outbox` and the `send-push` Edge Function (Expo push service), woken every minute by `private.run_push_pipeline` (config key `push_sender_url`). Session opened, 5 minutes left (sessions over 10 minutes), present or missed at close, cancelled, manual add or removal, new phone warnings.

- The rotating code is off by default on web and mobile; turning it on shows an explanation (an extra layer against cheating; the lecturer must show the code on a projector or screen for the whole session). Without a location check it is required. Lecturers can schedule sessions in the app too (day and time chips, no native date picker).
- Rules (migration `20261122010000_session_rules.sql`): the rotating code changes every `qr_seconds` (10 to 60, default 15), chosen per session. A student's own check-in (method `self`) can only be removed by an admin unless the school turns on `lecturers_remove_self_checkins` (default off). After a session ends, only admins change attendance unless `lecturers_add_after_end` is on (default off); manual additions while open are always allowed with a reason. Admins can correct up to 14 days after a session.
- Venues: lecturers add venues when `lecturers_add_venues` is on (default on) through `add_venue`; theirs are unverified until an admin calls `verify_venue`, but usable at once. Names are unique per school ignoring case and extra spaces. `remove_venue`: admins any, lecturers only their own unverified ones. The web session form also offers "My current location" (browser location, must be within 100 metres accuracy) and "No location check" (requires the rotating code).

### Device binding
- Each student account is bound to one device (secret in `expo-secure-store`, registered server side).
- New device: active automatically after a **48 hour cooldown**, or immediately if an **admin** approves. Lecturers cannot approve. Maximum **2 changes per semester**, after that admin only.
- The old device gets a push warning when the account signs in on a new phone.
- During a cooldown, a lecturer can manually add the student to a session (logged reason).
- Implementation: `devices` keyed by account (`user_id`), `secret_hash` is SHA-256 of a random secret in `expo-secure-store`. `register_device` at sign-in; `activate_due_devices` runs every minute and at check-in; admins use `pending_device_changes` and `approve_device` (web Phones page). Changes counted from the start of the current semester (cancelled requests excluded).
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
- Teacher and lecturer workspaces are Part 7 (Google Classroom style; free limit counts all workspaces an account owns; free workspaces send no attendance SMS; priced slightly above school rates; can move into a school account) and a Stediis bundle discount.

## Build plan

1. **Monorepo setup** (done): pnpm + Turborepo, Next.js, Expo, shared package, Supabase extensions migration.
2. **Schema, RLS and auth** (done): schools, staff and roles, programmes, batches, courses, runs, enrolments, classes, students, guardians and links, settings. School sign-up and verification. School ID sign-in.
3. **Non-tertiary registers** (done): daily and per-period marking on web and mobile, offline sync, auto close, term totals on the class page. Also: logo and icons, light and dark themes with a manual choice, privacy policy, aligned form fields.
4. **SMS outbox** (done, except the admin's daily summary of delegated changes): alerts, grace period, combining, quiet hours, opt-outs, guardian system messages, broadcasts and custom messages, credits, Messages page.
5. **Tertiary sessions:** 5a (done): database, check-in function, venues, device binding and approvals, rotating QR, push queue and sender, web sessions with live count. 5b (done): mobile tabs, check-in (Face ID or fingerprint, location, QR scan), phone binding, push and the notification list, lecturer sessions and courses in the app; web menu groups, search on lists, phone-width fixes, lecturer-created courses.
6. **Records, marks and reports** (done): Reports page, class term registers and course semester sheets, Excel, CSV and print exports, session downloads, the GES (Ghana Education Service) "Attendance X out of Y" line, low attendance threshold, student records, app Reports tab with sharing, past times hidden when scheduling.
7. **Teacher and lecturer workspaces:** a teacher or lecturer uses RollCol alone, without a school (Google Classroom style): their own classes or courses, students and guardians, registers and sessions; can later move into a school.
8. **Billing:** Paystack plans (schools and workspaces), trials, SMS credits and top-ups (web only).
9. **Stediis link:** sync API, webhooks, "Continue with Stediis".
10. **Launch preparation:** own domain (update `SITE_URL`, universal links and App Links for check-in codes), public pages with a site footer, contact page, help centre and guides (as in Stediis), in-app help, onboarding screens, permission strings, store listings, a native date and time picker for scheduling (only future times on Today), replace all test settings and secrets (Sailup key, CRON_SECRET; support email support@rollcol.app).


## Web form conventions

- `DependsOn` (components/form.tsx) shows or enables fields only while another field has a value (start time only for "Later", quiet hours times only when quiet hours are on). Hidden or disabled fields are not submitted, so actions treat them as optional.
- `CheckboxField` keeps the submitted value and shows its error after a failed save.
- `useFreshState` clears a form's message when its page is left (Next.js keeps left pages alive), so old messages never greet you on return.


## Part 5b decisions

- Mobile navigation: `(app)/(tabs)` with Today, Courses (students), Sessions (tertiary staff), Notifications (students) and Account; other screens are stack screens in `(app)/_layout.tsx` (check-in is a full-screen modal). Tabs are hidden per role with `href: null`.
- Pull to refresh everywhere, with a "Pull down to refresh" hint until the person has pulled once (`usePullHint`). Live updates through Supabase Realtime on `attendance_sessions` and `session_checkins`.
- Mobile dialogs: `ConfirmDialog` and `ReasonDialog` in `components/dialog.tsx` (no native Alert).
- Check-in order: confirm it is the student (`expo-local-authentication`; a phone with no screen lock cannot check in), then location (one high-accuracy reading, 20 second limit, `mocked` flag sent), then the QR scan last so the token is fresh, then `check_in`.
- Phone recognition: secret in `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, plus the phone's own app ID (`expo-application`: Android ID, iOS vendor ID) hashed into `devices.hardware_hash`. A new secret with the same hardware ID re-keys the active phone instead of starting a 48 hour wait (a reinstall). `@expo/app-integrity` is in the build for a later real-phone check.
- Notifications list: the student's own `push_outbox` rows; `mark_notifications_read` when the tab opens, `dismiss_notifications` on swipe or Clear all.
- Lecturer courses: `lecturer_add_course` (new course, or a new semester of an existing code); `course_runs.approved_at` is null while waiting when `school_settings.course_approval_required` (default on). Students cannot join and sessions cannot start until `approve_course_run`.
- Native config lives in `apps/mobile/app.config.ts`, which extends app.json (app.json keeps the EAS project ID). Every permission string explains its use; background location and microphone are blocked. Android push needs Firebase's google-services.json as the EAS file environment variable `GOOGLE_SERVICES_JSON`.
- One development build covers Parts 5 to 8: location, camera, local authentication, notifications, application, app integrity, haptics, network, file system, sharing, auth session, SVG, keep awake, dev client.
- Web: the dashboard menu is grouped (Attendance, People, Courses or Classes) and becomes a Menu panel on phones. `Table` takes `search` to filter its rows as you type. Global CSS keeps phone pages within the screen width (grid children may shrink, date inputs, long monospace text breaks).


## Part 6 decisions

- Migration `20261125000000_reports.sql`. Report functions (all security definer, checked inside): `class_register_days` (one row per child per school day), `class_subject_summary` (per-period schools), `course_run_report` (enrolled students by started, non-cancelled sessions), `student_course_attendance` (admins), `attendance_overview` (per class or course: students, held, rate, below threshold; admins see all, teachers their classes, lecturers their courses).
- A term or semester is always its dates (`private.period_range`), never a stored link. The page shows the period containing today unless another is chosen.
- GES counting: one "meeting" per school day that had a register. For per-period schools a day counts as present if the child was present or late in any period that day, late if only late, absent if absent in every period. Present and late both count as attended everywhere.
- `school_settings.low_attendance_percent` (1 to 100, default 75), on the Settings page's Reports card for every school type.
- Building the report from rows is shared (`packages/shared/src/reports.ts`: `buildClassReport`, `buildCourseReport`, `toCsv` which makes formula-like values plain text, `fileSlug`), so the website, downloads and app always agree.
- Web: `/dashboard/reports`, `/dashboard/reports/class/[id]?period=`, `/dashboard/reports/course/[id]`, and route handlers `.../export?format=xlsx|csv` plus `/dashboard/sessions/[id]/export`. Excel is written with `exceljs` (`apps/web/src/lib/report-files.ts`, server only): Register sheet in colour with frozen names and landscape fit-to-width printing, "Report card line" sheet, Subjects sheet. CSV starts with a byte order mark for Excel. Printing uses `print:` variants, `PrintLandscape`, and global print CSS that hides the menu.
- App: Reports tab for staff (`(tabs)/reports.tsx`) and `report/[kind]/[id]`; sharing writes a CSV to the cache with `expo-file-system` (`File`, `Paths.cache`) and opens `expo-sharing`. Session scheduling chips on Today offer only future slots and drop the chosen time if it passes.

### Part 6 fixes
- Report views (`apps/web/src/lib/report-view.ts`): `?week=YYYY-MM-DD` (default, this week; arrows move a week, Monday to Sunday, the grid shows Monday to Friday with faded days that had no register), `?view=all` (whole term with `period`, or whole semester), `?view=range&from=&to=` (swapped if reversed). Week and range read every date and filter, so they can cross terms. Exports and printing use the same view. `class_subject_summary` takes `p_from` and `p_to`.
- Printing: report pages render a separate `PrintReport` (hidden on screen) and hide the screen version; `@page { margin: 0 }` so browsers drop their header and footer, with the margin on `.print-report` (`box-decoration-break: clone`).
- Test data marks are deterministic (school ID plus school day number), so guides can quote numbers. Ekow Mensah (ADB5023) is forced below 75%. Test accounts carry `raw_app_meta_data.rollcol_test` so remove.sql finds them after an email change.
- Not found pages: `app/not-found.tsx` and `app/dashboard/not-found.tsx` using `NotFoundView` ("This page is absent").
- Menu group "Academics" (Classes or Courses, Terms or Semesters, Programmes, Batches); no group shares a name with its link.
- Your account: `update_my_name` (all the person's staff rows) plus auth metadata; email change through `auth.updateUser` with a confirmation link, then `sync_my_email` (on /auth/confirm and on the account page) copies the confirmed address to staff rows. No writes or triggers on the auth schema.
