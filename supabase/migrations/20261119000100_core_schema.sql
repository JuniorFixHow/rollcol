-- Part 2: core schema.
-- Schools, staff, students, the tertiary structure mirrored from Stediis
-- (programme, batch, course, run, enrolment), non-tertiary classes and subjects,
-- guardians and their links to students, and school settings.
--
-- Access rules (RLS, triggers) are in the next migration; RPC functions after that.

create extension if not exists pgcrypto with schema extensions;
-- btree_gist lets an exclusion constraint combine uuid equality with date range overlap.
create extension if not exists btree_gist with schema extensions;

-- Functions used by RLS policies live here. This schema is not exposed through the API.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.school_type as enum ('tertiary', 'non_tertiary');
create type public.register_mode as enum ('daily', 'per_period');
create type public.record_source as enum ('rollcol', 'stediis');
create type public.school_status as enum ('unverified', 'verified', 'suspended');
create type public.staff_role as enum ('admin', 'teacher');
create type public.member_status as enum ('pending', 'active', 'disabled');
create type public.academic_period_kind as enum ('term', 'semester');
create type public.enrolment_status as enum ('active', 'removed');
create type public.guardian_event_kind as enum (
  'guardian_added',
  'guardian_removed',
  'phone_changed',
  'alerts_on',
  'alerts_off'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------

-- The platform owner (Teqxa). Rows are added by hand in the SQL editor.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  -- Short code people type to find their school when signing in or joining.
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  type public.school_type not null,
  register_mode public.register_mode,
  status public.school_status not null default 'unverified',
  contact_phone text not null check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  source public.record_source not null default 'rollcol',
  external_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_register_mode_matches_type check (
    (type = 'tertiary' and register_mode is null)
    or (type = 'non_tertiary' and register_mode is not null)
  ),
  constraint schools_external_id_unique unique (source, external_id)
);

create trigger schools_touch before update on public.schools
  for each row execute function private.touch_updated_at();

create table public.school_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  -- New students wait for an admin before they become active.
  student_approval_required boolean not null default true,
  -- Tertiary only: students may create their own accounts with the school code.
  student_self_signup boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger school_settings_touch before update on public.school_settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- School numbers ("School ID" in the app) vary by school: numeric, or letters
-- then numbers. Stored upper case.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  school_number text not null check (school_number ~ '^[A-Z0-9]{3,32}$'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text check (email is null or char_length(email) <= 254),
  role public.staff_role not null default 'teacher',
  status public.member_status not null default 'active' check (status <> 'pending'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_school_number_unique unique (school_id, school_number),
  constraint staff_id_school unique (id, school_id)
);

create index staff_school_idx on public.staff (school_id);
create trigger staff_touch before update on public.staff
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Academic calendar: terms (non-tertiary) or semesters (tertiary)
-- ---------------------------------------------------------------------------

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind public.academic_period_kind not null,
  name text not null check (char_length(name) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_periods_dates check (ends_on > starts_on),
  constraint academic_periods_no_overlap exclude using gist (
    school_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ),
  constraint academic_periods_external_id_unique unique (school_id, source, external_id),
  constraint academic_periods_id_school unique (id, school_id)
);

create trigger academic_periods_touch before update on public.academic_periods
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Tertiary structure (mirrors Stediis)
-- ---------------------------------------------------------------------------

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  code text check (code is null or code ~ '^[A-Z0-9-]{1,20}$'),
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programmes_name_unique unique (school_id, name),
  constraint programmes_external_id_unique unique (school_id, source, external_id),
  constraint programmes_id_school unique (id, school_id)
);

create trigger programmes_touch before update on public.programmes
  for each row execute function private.touch_updated_at();

-- A cohort within a programme, for example "2025 intake".
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  programme_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  entry_year integer check (entry_year is null or entry_year between 1990 and 2200),
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_name_unique unique (programme_id, name),
  foreign key (programme_id, school_id) references public.programmes (id, school_id) on delete cascade,
  constraint batches_external_id_unique unique (school_id, source, external_id),
  constraint batches_id_school unique (id, school_id)
);

create index batches_programme_idx on public.batches (programme_id);
create trigger batches_touch before update on public.batches
  for each row execute function private.touch_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9 -]{2,20}$'),
  title text not null check (char_length(title) between 2 and 160),
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_code_unique unique (school_id, code),
  constraint courses_external_id_unique unique (school_id, source, external_id),
  constraint courses_id_school unique (id, school_id)
);

create trigger courses_touch before update on public.courses
  for each row execute function private.touch_updated_at();

-- A course taught in a particular semester.
create table public.course_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_id uuid not null,
  academic_period_id uuid not null,
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_runs_unique unique (course_id, academic_period_id),
  foreign key (course_id, school_id) references public.courses (id, school_id) on delete cascade,
  foreign key (academic_period_id, school_id)
    references public.academic_periods (id, school_id) on delete restrict,
  constraint course_runs_external_id_unique unique (school_id, source, external_id),
  constraint course_runs_id_school unique (id, school_id)
);

create index course_runs_period_idx on public.course_runs (academic_period_id);
create trigger course_runs_touch before update on public.course_runs
  for each row execute function private.touch_updated_at();

-- Lecturers assigned to a run.
create table public.course_run_staff (
  course_run_id uuid not null,
  staff_id uuid not null,
  school_id uuid not null references public.schools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_run_id, staff_id),
  foreign key (course_run_id, school_id) references public.course_runs (id, school_id) on delete cascade,
  foreign key (staff_id, school_id) references public.staff (id, school_id) on delete cascade
);

create index course_run_staff_staff_idx on public.course_run_staff (staff_id);

-- ---------------------------------------------------------------------------
-- Non-tertiary structure
-- ---------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  class_teacher_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_name_unique unique (school_id, name),
  foreign key (class_teacher_id, school_id)
    references public.staff (id, school_id) on delete set null (class_teacher_id),
  constraint classes_id_school unique (id, school_id)
);

create index classes_teacher_idx on public.classes (class_teacher_id);
create trigger classes_touch before update on public.classes
  for each row execute function private.touch_updated_at();

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  constraint subjects_name_unique unique (school_id, name),
  constraint subjects_id_school unique (id, school_id)
);

-- Who teaches a subject to a class (used by per-period registers).
create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid,
  created_at timestamptz not null default now(),
  constraint class_subjects_unique unique (class_id, subject_id),
  foreign key (class_id, school_id) references public.classes (id, school_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects (id, school_id) on delete cascade,
  foreign key (teacher_id, school_id)
    references public.staff (id, school_id) on delete set null (teacher_id)
);

create index class_subjects_teacher_idx on public.class_subjects (teacher_id);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------

-- Non-tertiary students are records only (user_id is null).
-- Tertiary students have accounts; Stediis-synced students may exist before
-- they first sign in.
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete cascade,
  school_number text check (school_number is null or school_number ~ '^[A-Z0-9]{3,32}$'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  status public.member_status not null default 'active',
  class_id uuid,
  programme_id uuid,
  batch_id uuid,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  source public.record_source not null default 'rollcol',
  external_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_school_number_unique unique (school_id, school_number),
  foreign key (class_id, school_id)
    references public.classes (id, school_id) on delete set null (class_id),
  foreign key (programme_id, school_id)
    references public.programmes (id, school_id) on delete set null (programme_id),
  foreign key (batch_id, school_id)
    references public.batches (id, school_id) on delete set null (batch_id),
  constraint students_external_id_unique unique (school_id, source, external_id),
  constraint students_id_school unique (id, school_id)
);

create index students_class_idx on public.students (class_id);
create index students_school_status_idx on public.students (school_id, status);
create trigger students_touch before update on public.students
  for each row execute function private.touch_updated_at();

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_run_id uuid not null,
  student_id uuid not null,
  status public.enrolment_status not null default 'active',
  source public.record_source not null default 'rollcol',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrolments_unique unique (course_run_id, student_id),
  foreign key (course_run_id, school_id) references public.course_runs (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade,
  constraint enrolments_external_id_unique unique (school_id, source, external_id)
);

create index enrolments_student_idx on public.enrolments (student_id);
create trigger enrolments_touch before update on public.enrolments
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Guardians (non-tertiary)
-- ---------------------------------------------------------------------------

-- A guardian is identified by phone number within a school.
create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- School-wide broadcasts (PTA meetings and so on), one message per guardian.
  broadcasts_enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_phone_unique unique (school_id, phone),
  constraint guardians_id_school unique (id, school_id)
);

create trigger guardians_touch before update on public.guardians
  for each row execute function private.touch_updated_at();

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  guardian_id uuid not null,
  student_id uuid not null,
  relationship text check (relationship is null or char_length(relationship) <= 40),
  -- Absence and late alerts for this child.
  alerts_enabled boolean not null default true,
  -- Complete plan: the one guardian per student who gets daily present alerts.
  receives_present_alerts boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_links_unique unique (guardian_id, student_id),
  foreign key (guardian_id, school_id) references public.guardians (id, school_id) on delete cascade,
  foreign key (student_id, school_id) references public.students (id, school_id) on delete cascade
);

create index guardian_links_student_idx on public.guardian_links (student_id);
create unique index guardian_links_one_present_recipient
  on public.guardian_links (student_id) where receives_present_alerts;
create trigger guardian_links_touch before update on public.guardian_links
  for each row execute function private.touch_updated_at();

-- An admin lets a teacher manage guardians for their own classes until a date.
create table public.guardian_delegations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null,
  expires_at timestamptz not null,
  granted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (staff_id, school_id) references public.staff (id, school_id) on delete cascade
);

create index guardian_delegations_staff_idx on public.guardian_delegations (staff_id);

-- Audit trail of guardian changes. Part 4 turns these into the free system SMS
-- messages and the admin's daily summary of delegated changes.
create table public.guardian_events (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  guardian_id uuid references public.guardians (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  kind public.guardian_event_kind not null,
  -- Phone numbers are kept so a removed guardian can still be told.
  phone text not null,
  previous_phone text,
  guardian_name text not null,
  student_name text,
  actor_user_id uuid references auth.users (id) on delete set null,
  via_delegation boolean not null default false,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index guardian_events_unprocessed_idx on public.guardian_events (created_at)
  where processed_at is null;
create index guardian_events_school_idx on public.guardian_events (school_id, created_at);

-- ---------------------------------------------------------------------------
-- Sign-in throttling (school ID sign-in)
-- ---------------------------------------------------------------------------

create table private.sign_in_failures (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  school_number text not null,
  failed_at timestamptz not null default now()
);

create index sign_in_failures_lookup_idx
  on private.sign_in_failures (school_id, school_number, failed_at);
