// Generated from supabase/migrations in the same shape as `supabase gen types`.
// After linking the Supabase project, regenerate with: pnpm db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_periods: {
        Row: {
          created_at: string
          ends_on: string
          external_id: string | null
          id: string
          kind: Database["public"]["Enums"]["academic_period_kind"]
          name: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          external_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["academic_period_kind"]
          name: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          external_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["academic_period_kind"]
          name?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          qr_seconds: number
          course_run_id: string
          created_at: string
          ends_at: string
          id: string
          location: unknown | null
          qr_required: boolean
          radius_m: number | null
          reward_marks: number
          school_id: string
          started_by: string | null
          starts_at: string
          venue_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          qr_seconds?: number
          course_run_id: string
          created_at?: string
          ends_at: string
          id?: string
          location?: unknown | null
          qr_required?: boolean
          radius_m?: number | null
          reward_marks?: number
          school_id: string
          started_by?: string | null
          starts_at: string
          venue_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          qr_seconds?: number
          course_run_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          location?: unknown | null
          qr_required?: boolean
          radius_m?: number | null
          reward_marks?: number
          school_id?: string
          started_by?: string | null
          starts_at?: string
          venue_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_course_run_id_school_id_fkey"
            columns: ["course_run_id"]
            isOneToOne: false
            referencedRelation: "course_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_venue_id_school_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          entry_year: number | null
          external_id: string | null
          id: string
          name: string
          programme_id: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_year?: number | null
          external_id?: string | null
          id?: string
          name: string
          programme_id: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_year?: number | null
          external_id?: string | null
          id?: string
          name?: string
          programme_id?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_programme_id_school_id_fkey"
            columns: ["programme_id", "school_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_school_id_fkey"
            columns: ["class_id", "school_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_school_id_fkey"
            columns: ["subject_id", "school_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_school_id_fkey"
            columns: ["teacher_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      classes: {
        Row: {
          periods_per_day: number | null
          archived_at: string | null
          class_teacher_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          periods_per_day?: number | null
          archived_at?: string | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          periods_per_day?: number | null
          archived_at?: string | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_school_id_fkey"
            columns: ["class_teacher_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      course_run_staff: {
        Row: {
          course_run_id: string
          created_at: string
          school_id: string
          staff_id: string
        }
        Insert: {
          course_run_id: string
          created_at?: string
          school_id: string
          staff_id: string
        }
        Update: {
          course_run_id?: string
          created_at?: string
          school_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_run_staff_course_run_id_school_id_fkey"
            columns: ["course_run_id", "school_id"]
            isOneToOne: false
            referencedRelation: "course_runs"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "course_run_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_run_staff_staff_id_school_id_fkey"
            columns: ["staff_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      course_runs: {
        Row: {
          approved_at: string | null
          created_by: string | null
          academic_period_id: string
          course_id: string
          created_at: string
          external_id: string | null
          id: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_by?: string | null
          academic_period_id: string
          course_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_by?: string | null
          academic_period_id?: string
          course_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_runs_academic_period_id_school_id_fkey"
            columns: ["academic_period_id", "school_id"]
            isOneToOne: false
            referencedRelation: "academic_periods"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "course_runs_course_id_school_id_fkey"
            columns: ["course_id", "school_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "course_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          external_id: string | null
          id: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          hardware_hash: string | null
          active_from: string | null
          approved_at: string | null
          id: string
          is_first: boolean
          label: string
          platform: string
          replaced_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Insert: {
          hardware_hash?: string | null
          active_from?: string | null
          approved_at?: string | null
          id?: string
          is_first?: boolean
          label?: string
          platform: string
          replaced_at?: string | null
          requested_at?: string
          status: Database["public"]["Enums"]["device_status"]
          user_id: string
        }
        Update: {
          hardware_hash?: string | null
          active_from?: string | null
          approved_at?: string | null
          id?: string
          is_first?: boolean
          label?: string
          platform?: string
          replaced_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["device_status"]
          user_id?: string
        }
        Relationships: [
        ]
      }
      enrolments: {
        Row: {
          course_run_id: string
          created_at: string
          external_id: string | null
          id: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          status: Database["public"]["Enums"]["enrolment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          course_run_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["enrolment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          course_run_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["enrolment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_course_run_id_school_id_fkey"
            columns: ["course_run_id", "school_id"]
            isOneToOne: false
            referencedRelation: "course_runs"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "enrolments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      guardian_delegations: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          school_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          school_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          school_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_delegations_staff_id_school_id_fkey"
            columns: ["staff_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      guardian_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          guardian_id: string | null
          guardian_name: string
          id: number
          kind: Database["public"]["Enums"]["guardian_event_kind"]
          phone: string
          previous_phone: string | null
          processed_at: string | null
          school_id: string
          student_id: string | null
          student_name: string | null
          via_delegation: boolean
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          guardian_id?: string | null
          guardian_name: string
          id?: never
          kind: Database["public"]["Enums"]["guardian_event_kind"]
          phone: string
          previous_phone?: string | null
          processed_at?: string | null
          school_id: string
          student_id?: string | null
          student_name?: string | null
          via_delegation?: boolean
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          guardian_id?: string | null
          guardian_name?: string
          id?: never
          kind?: Database["public"]["Enums"]["guardian_event_kind"]
          phone?: string
          previous_phone?: string | null
          processed_at?: string | null
          school_id?: string
          student_id?: string | null
          student_name?: string | null
          via_delegation?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "guardian_events_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          created_by: string | null
          guardian_id: string
          id: string
          receives_present_alerts: boolean
          relationship: string | null
          school_id: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          created_by?: string | null
          guardian_id: string
          id?: string
          receives_present_alerts?: boolean
          relationship?: string | null
          school_id: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          created_by?: string | null
          guardian_id?: string
          id?: string
          receives_present_alerts?: boolean
          relationship?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_guardian_id_school_id_fkey"
            columns: ["guardian_id", "school_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "guardian_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      guardians: {
        Row: {
          broadcasts_enabled: boolean
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          phone: string
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          broadcasts_enabled?: boolean
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          phone: string
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          broadcasts_enabled?: boolean
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          phone?: string
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          code: string | null
          created_at: string
          external_id: string | null
          id: string
          name: string
          school_id: string
          source: Database["public"]["Enums"]["record_source"]
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          school_id: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          school_id?: string
          source?: Database["public"]["Enums"]["record_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: number
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          title?: string
        }
        Relationships: []
      }
      register_entries: {
        Row: {
          mark: Database["public"]["Enums"]["attendance_mark"]
          marked_at: string
          marked_by: string | null
          register_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          mark: Database["public"]["Enums"]["attendance_mark"]
          marked_at?: string
          marked_by?: string | null
          register_id: string
          school_id: string
          student_id: string
        }
        Update: {
          mark?: Database["public"]["Enums"]["attendance_mark"]
          marked_at?: string
          marked_by?: string | null
          register_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_entries_register_id_school_id_fkey"
            columns: ["register_id", "school_id"]
            isOneToOne: false
            referencedRelation: "registers"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "register_entries_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      registers: {
        Row: {
          alerts_queued_at: string | null
          academic_period_id: string | null
          class_id: string
          class_subject_id: string | null
          closed_at: string | null
          closes_at: string
          id: string
          opened_at: string
          opened_by: string | null
          period_number: number | null
          register_date: string
          reward_marks: number
          school_id: string
          status: Database["public"]["Enums"]["register_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          alerts_queued_at?: string | null
          academic_period_id?: string | null
          class_id: string
          class_subject_id?: string | null
          closed_at?: string | null
          closes_at: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          period_number?: number | null
          register_date: string
          reward_marks?: number
          school_id: string
          status?: Database["public"]["Enums"]["register_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          alerts_queued_at?: string | null
          academic_period_id?: string | null
          class_id?: string
          class_subject_id?: string | null
          closed_at?: string | null
          closes_at?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          period_number?: number | null
          register_date?: string
          reward_marks?: number
          school_id?: string
          status?: Database["public"]["Enums"]["register_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registers_class_id_school_id_fkey"
            columns: ["class_id", "school_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "registers_class_subject_id_school_id_fkey"
            columns: ["class_subject_id", "school_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      school_settings: {
        Row: {
          course_approval_required: boolean
          lecturers_add_after_end: boolean
          lecturers_add_venues: boolean
          lecturers_remove_self_checkins: boolean
          sms_quiet_end: string
          sms_quiet_hours: boolean
          sms_quiet_start: string
          daily_register_closes_at: string
          period_register_minutes: number
          periods_per_day: number
          school_id: string
          sms_absence_alerts: boolean
          sms_name: string | null
          sms_present_alerts: boolean
          student_approval_required: boolean
          student_self_signup: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_approval_required?: boolean
          lecturers_add_after_end?: boolean
          lecturers_add_venues?: boolean
          lecturers_remove_self_checkins?: boolean
          sms_quiet_end?: string
          sms_quiet_hours?: boolean
          sms_quiet_start?: string
          daily_register_closes_at?: string
          period_register_minutes?: number
          periods_per_day?: number
          school_id: string
          sms_absence_alerts?: boolean
          sms_name?: string | null
          sms_present_alerts?: boolean
          student_approval_required?: boolean
          student_self_signup?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_approval_required?: boolean
          lecturers_add_after_end?: boolean
          lecturers_add_venues?: boolean
          lecturers_remove_self_checkins?: boolean
          sms_quiet_end?: string
          sms_quiet_hours?: boolean
          sms_quiet_start?: string
          daily_register_closes_at?: string
          period_register_minutes?: number
          periods_per_day?: number
          school_id?: string
          sms_absence_alerts?: boolean
          sms_name?: string | null
          sms_present_alerts?: boolean
          student_approval_required?: boolean
          student_self_signup?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          code: string
          contact_email: string | null
          contact_phone: string
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          name: string
          register_mode: Database["public"]["Enums"]["register_mode"] | null
          source: Database["public"]["Enums"]["record_source"]
          status: Database["public"]["Enums"]["school_status"]
          type: Database["public"]["Enums"]["school_type"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          code: string
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          name: string
          register_mode?: Database["public"]["Enums"]["register_mode"] | null
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["school_status"]
          type: Database["public"]["Enums"]["school_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          name?: string
          register_mode?: Database["public"]["Enums"]["register_mode"] | null
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["school_status"]
          type?: Database["public"]["Enums"]["school_type"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      session_adjustments: {
        Row: {
          action: string
          created_at: string
          id: number
          reason: string
          school_id: string
          session_id: string
          staff_id: string | null
          student_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          reason: string
          school_id: string
          session_id: string
          staff_id?: string | null
          student_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          reason?: string
          school_id?: string
          session_id?: string
          staff_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_adjustments_session_id_school_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_adjustments_student_id_school_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_adjustments_staff_id_school_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      session_checkins: {
        Row: {
          accuracy_m: number | null
          added_by: string | null
          checked_in_at: string
          device_id: string | null
          distance_m: number | null
          location: unknown | null
          method: string
          reason: string | null
          school_id: string
          session_id: string
          student_id: string
        }
        Insert: {
          accuracy_m?: number | null
          added_by?: string | null
          checked_in_at?: string
          device_id?: string | null
          distance_m?: number | null
          location?: unknown | null
          method: string
          reason?: string | null
          school_id: string
          session_id: string
          student_id: string
        }
        Update: {
          accuracy_m?: number | null
          added_by?: string | null
          checked_in_at?: string
          device_id?: string | null
          distance_m?: number | null
          location?: unknown | null
          method?: string
          reason?: string | null
          school_id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_checkins_session_id_school_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_checkins_student_id_school_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_credit_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: number
          reason: string
          school_id: string
          sms_id: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          reason: string
          school_id: string
          sms_id?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          reason?: string
          school_id?: string
          sms_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_credit_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_credit_entries_sms_id_fkey"
            columns: ["sms_id"]
            isOneToOne: false
            referencedRelation: "sms_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: number
          kind: Database["public"]["Enums"]["sms_kind"]
          recipients: number
          school_id: string
          student_id: string | null
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          created_by?: string | null
          kind: Database["public"]["Enums"]["sms_kind"]
          recipients?: number
          school_id: string
          student_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          kind?: Database["public"]["Enums"]["sms_kind"]
          recipients?: number
          school_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_outbox: {
        Row: {
          delivered_at: string | null
          delivery: Database["public"]["Enums"]["sms_delivery"] | null
          attempts: number
          body: string
          created_at: string
          created_by: string | null
          credits: number
          error: string | null
          guardian_id: string | null
          id: number
          kind: Database["public"]["Enums"]["sms_kind"]
          message_id: number | null
          provider_id: string | null
          school_id: string
          segments: number
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["sms_status"]
          to_phone: string
          updated_at: string
        }
        Insert: {
          delivered_at?: string | null
          delivery?: Database["public"]["Enums"]["sms_delivery"] | null
          attempts?: number
          body: string
          created_at?: string
          created_by?: string | null
          credits?: number
          error?: string | null
          guardian_id?: string | null
          kind: Database["public"]["Enums"]["sms_kind"]
          message_id?: number | null
          provider_id?: string | null
          school_id: string
          segments: number
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          to_phone: string
          updated_at?: string
        }
        Update: {
          delivered_at?: string | null
          delivery?: Database["public"]["Enums"]["sms_delivery"] | null
          attempts?: number
          body?: string
          created_at?: string
          created_by?: string | null
          credits?: number
          error?: string | null
          guardian_id?: string | null
          kind?: Database["public"]["Enums"]["sms_kind"]
          message_id?: number | null
          provider_id?: string | null
          school_id?: string
          segments?: number
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_outbox_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_outbox_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_outbox_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          school_id: string
          school_number: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          school_id: string
          school_number: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          school_id?: string
          school_number?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          class_id: string | null
          created_at: string
          created_by: string | null
          external_id: string | null
          full_name: string
          id: string
          programme_id: string | null
          school_id: string
          school_number: string | null
          source: Database["public"]["Enums"]["record_source"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          full_name: string
          id?: string
          programme_id?: string | null
          school_id: string
          school_number?: string | null
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          full_name?: string
          id?: string
          programme_id?: string | null
          school_id?: string
          school_number?: string | null
          source?: Database["public"]["Enums"]["record_source"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_school_id_fkey"
            columns: ["batch_id", "school_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "students_class_id_school_id_fkey"
            columns: ["class_id", "school_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "students_programme_id_school_id_fkey"
            columns: ["programme_id", "school_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          verified_at: string | null
          verified_by: string | null
          created_at: string
          created_by: string | null
          id: string
          location: unknown
          name: string
          radius_m: number
          school_id: string
          updated_at: string
        }
        Insert: {
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location: unknown
          name: string
          radius_m?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: unknown
          name?: string
          radius_m?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_course_run: {
        Args: { p_course_run_id: string }
        Returns: undefined
      }
      check_in: {
        Args: {
          p_session_id: string
          p_device_secret: string
          p_lat?: number | null
          p_lng?: number | null
          p_accuracy?: number | null
          p_mocked?: boolean
          p_qr_token?: string | null
        }
        Returns: { checked_in_at: string; distance_m: number | null; course_code: string; reward_marks: number }[]
      }
      dismiss_notifications: {
        Args: { p_ids?: number[] | null }
        Returns: undefined
      }
      lecturer_add_course: {
        Args: { p_school_id: string; p_code: string; p_title: string; p_period_id: string }
        Returns: string
      }
      mark_notifications_read: {
        Args: { p_ids?: number[] | null }
        Returns: undefined
      }
      my_course_sessions: {
        Args: { p_course_run_id: string }
        Returns: {
          session_id: string
          starts_at: string
          ends_at: string
          voided: boolean
          checked_in_at: string | null
          method: string | null
          reward_marks: number
        }[]
      }
      my_courses: {
        Args: { p_school_id: string }
        Returns: {
          course_run_id: string
          code: string
          title: string
          semester: string
          enrolled: boolean
          sessions_held: number
          attended: number
          marks: number
          lecturers: string | null
        }[]
      }
      my_device: {
        Args: { p_secret: string }
        Returns: {
          status: Database["public"]["Enums"]["device_status"]
          label: string
          active_from: string | null
          needs_admin: boolean
          active_label: string | null
        }[]
      }
      register_device: {
        Args: { p_secret: string; p_label: string; p_platform: string; p_hardware_id?: string | null }
        Returns: { device_id: string; status: Database["public"]["Enums"]["device_status"]; active_from: string | null; needs_admin: boolean }[]
      }
      set_push_token: {
        Args: { p_secret: string; p_token: string | null }
        Returns: undefined
      }
      add_venue: {
        Args: { p_school_id: string; p_name: string; p_lat: number; p_lng: number; p_radius_m: number }
        Returns: string
      }
      add_checkin_manually: {
        Args: { p_session_id: string; p_student_id: string; p_reason: string }
        Returns: undefined
      }
      approve_device: {
        Args: { p_device_id: string }
        Returns: undefined
      }
      end_session: {
        Args: { p_session_id: string; p_reason?: string | null }
        Returns: undefined
      }
      my_open_sessions: {
        Args: never
        Returns: {
          session_id: string
          school_id: string
          course_code: string
          course_title: string
          starts_at: string
          ends_at: string
          needs_location: boolean
          qr_required: boolean
          reward_marks: number
          checked_in_at: string | null
        }[]
      }
      pending_device_changes: {
        Args: { p_school_id: string }
        Returns: {
          device_id: string
          student_id: string
          student_name: string
          school_number: string | null
          new_label: string
          old_label: string | null
          requested_at: string
          active_from: string | null
        }[]
      }
      remove_venue: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      remove_checkin: {
        Args: { p_session_id: string; p_student_id: string; p_reason: string }
        Returns: undefined
      }
      session_qr: {
        Args: { p_session_id: string }
        Returns: { token: string; expires_at: string }[]
      }
      session_roster: {
        Args: { p_session_id: string }
        Returns: {
          student_id: string
          full_name: string
          school_number: string | null
          has_app: boolean
          checked_in_at: string | null
          method: string | null
          distance_m: number | null
          reason: string | null
        }[]
      }
      start_session: {
        Args: {
          p_course_run_id: string
          p_minutes: number
          p_starts_at?: string | null
          p_venue_id?: string | null
          p_lat?: number | null
          p_lng?: number | null
          p_accuracy?: number | null
          p_radius_m?: number | null
          p_reward_marks?: number
          p_qr_required?: boolean
          p_qr_seconds?: number
        }
        Returns: Database["public"]["Tables"]["attendance_sessions"]["Row"]
      }
      verify_venue: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      void_session: {
        Args: { p_session_id: string; p_reason: string }
        Returns: undefined
      }
      account_deletion_effects: {
        Args: never
        Returns: {
          school_id: string
          school_name: string
          effect: string
        }[]
      }
      add_guardian_to_student: {
        Args: {
          p_student_id: string
          p_full_name: string
          p_phone: string
          p_relationship?: string
        }
        Returns: string
      }
      broadcast_preview: {
        Args: { p_school_id: string; p_body: string; p_class_ids?: string[] | null }
        Returns: { recipients: number; segments: number; credits: number; balance: number }[]
      }
      class_attendance_summary: {
        Args: {
          p_class_id: string
          p_academic_period_id?: string
        }
        Returns: {
          student_id: string
          full_name: string
          school_number: string | null
          present: number
          late: number
          absent: number
          registers: number
          marks: number
        }[]
      }
      create_school: {
        Args: {
          p_name: string
          p_type: Database["public"]["Enums"]["school_type"]
          p_contact_phone: string
          p_admin_full_name: string
          p_admin_school_number: string
          p_register_mode?: Database["public"]["Enums"]["register_mode"]
        }
        Returns: {
          school_id: string
          school_code: string
        }[]
      }
      find_user_id_by_email: {
        Args: {
          p_email: string
        }
        Returns: string
      }
      grant_sms_credits: {
        Args: { p_school_id: string; p_amount: number; p_reason: string }
        Returns: number
      }
      guardians_not_reached: {
        Args: { p_student_id: string }
        Returns: {
          guardian_id: string
          delivery: Database["public"]["Enums"]["sms_delivery"]
          reported_at: string
        }[]
      }
      is_platform_admin: {
        Args: never
        Returns: boolean
      }
      join_course_run: {
        Args: {
          p_course_run_id: string
        }
        Returns: string
      }
      join_school_as_student: {
        Args: {
          p_school_code: string
          p_school_number: string
          p_full_name: string
        }
        Returns: Database["public"]["Enums"]["member_status"]
      }
      membership_count: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      my_memberships: {
        Args: never
        Returns: {
          kind: string
          member_id: string
          status: Database["public"]["Enums"]["member_status"]
          role: Database["public"]["Enums"]["staff_role"]
          full_name: string
          school_number: string
          school_id: string
          school_name: string
          school_code: string
          school_type: Database["public"]["Enums"]["school_type"]
          register_mode: Database["public"]["Enums"]["register_mode"]
          school_status: Database["public"]["Enums"]["school_status"]
        }[]
      }
      open_register: {
        Args: {
          p_id: string
          p_class_id: string
          p_class_subject_id?: string
          p_period_number?: number
          p_reward_marks?: number
        }
        Returns: Database["public"]["Tables"]["registers"]["Row"]
      }
      platform_sms_sender_log: {
        Args: never
        Returns: {
          replied_at: string | null
          status_code: number | null
          reply: string | null
          error: string | null
          configured: boolean
          waiting: number
        }[]
      }
      platform_schools: {
        Args: never
        Returns: {
          id: string
          name: string
          code: string
          type: Database["public"]["Enums"]["school_type"]
          status: Database["public"]["Enums"]["school_status"]
          contact_phone: string
          contact_email: string
          created_at: string
          verified_at: string
          student_count: number
          staff_count: number
          sms_credits: number
          sms_sent_30_days: number
        }[]
      }
      registers_today: {
        Args: {
          p_school_id: string
        }
        Returns: {
          class_id: string
          class_name: string
          class_subject_id: string | null
          subject_name: string | null
          register_id: string | null
          period_number: number | null
          status: Database["public"]["Enums"]["register_status"] | null
          closes_at: string | null
          marked_count: number
          student_count: number
          periods_per_day: number
        }[]
      }
      record_sms_delivery: {
        Args: { p_provider_id: string; p_delivery: Database["public"]["Enums"]["sms_delivery"] }
        Returns: boolean
      }
      save_register_marks: {
        Args: {
          p_register_id: string
          p_marks: Json
        }
        Returns: number
      }
      school_venues: {
        Args: { p_school_id: string }
        Returns: {
          id: string
          name: string
          latitude: number
          longitude: number
          radius_m: number
          verified: boolean
          added_by: string | null
          mine: boolean
        }[]
      }
      school_by_code: {
        Args: {
          p_code: string
        }
        Returns: {
          name: string
          type: Database["public"]["Enums"]["school_type"]
          accepts_students: boolean
        }[]
      }
      send_broadcast: {
        Args: { p_school_id: string; p_body: string; p_class_ids?: string[] | null }
        Returns: number
      }
      send_student_message: {
        Args: { p_student_id: string; p_body: string }
        Returns: number
      }
      set_present_alert_guardian: {
        Args: {
          p_student_id: string
          p_link_id?: string
        }
        Returns: undefined
      }
      set_school_status: {
        Args: {
          p_school_id: string
          p_status: Database["public"]["Enums"]["school_status"]
        }
        Returns: undefined
      }
      sms_credit_balance: {
        Args: { p_school_id: string }
        Returns: number
      }
      submit_register: {
        Args: {
          p_register_id: string
        }
        Returns: Database["public"]["Tables"]["registers"]["Row"]
      }
      sign_in_email: {
        Args: {
          p_school_code: string
          p_school_number: string
          p_password: string
        }
        Returns: Json
      }
    }
    Enums: {
      academic_period_kind:
        | "term"
        | "semester"
      attendance_mark:
        | "present"
        | "late"
        | "absent"
      device_status:
        | "active"
        | "pending"
        | "replaced"
        | "cancelled"
      enrolment_status:
        | "active"
        | "removed"
      guardian_event_kind:
        | "guardian_added"
        | "guardian_removed"
        | "phone_changed"
        | "alerts_on"
        | "alerts_off"
      member_status:
        | "pending"
        | "active"
        | "disabled"
      record_source:
        | "rollcol"
        | "stediis"
      register_mode:
        | "daily"
        | "per_period"
      register_status:
        | "open"
        | "submitted"
        | "closed"
      school_status:
        | "unverified"
        | "verified"
        | "suspended"
      sms_delivery:
        | "pending"
        | "delivered"
        | "failed"
        | "expired"
        | "rejected"
      sms_kind:
        | "attendance"
        | "system"
        | "broadcast"
        | "custom"
      sms_status:
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "no_credit"
        | "cancelled"
      school_type:
        | "tertiary"
        | "non_tertiary"
      staff_role:
        | "admin"
        | "teacher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      academic_period_kind: ["term", "semester"],
      attendance_mark: ["present", "late", "absent"],
      device_status: ["active", "pending", "replaced", "cancelled"],
      enrolment_status: ["active", "removed"],
      guardian_event_kind: ["guardian_added", "guardian_removed", "phone_changed", "alerts_on", "alerts_off"],
      member_status: ["pending", "active", "disabled"],
      record_source: ["rollcol", "stediis"],
      register_mode: ["daily", "per_period"],
      register_status: ["open", "submitted", "closed"],
      school_status: ["unverified", "verified", "suspended"],
      school_type: ["tertiary", "non_tertiary"],
      sms_delivery: ["pending", "delivered", "failed", "expired", "rejected"],
      sms_kind: ["attendance", "system", "broadcast", "custom"],
      sms_status: ["queued", "sending", "sent", "failed", "no_credit", "cancelled"],
      staff_role: ["admin", "teacher"],
    },
  },
} as const
