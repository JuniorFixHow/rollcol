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
          archived_at: string | null
          class_teacher_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
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
      school_settings: {
        Row: {
          school_id: string
          student_approval_required: boolean
          student_self_signup: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          school_id: string
          student_approval_required?: boolean
          student_self_signup?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          school_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_deletion_effect: {
        Args: never
        Returns: string
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
      current_member: {
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
          is_platform_admin: boolean
        }[]
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
      school_status:
        | "unverified"
        | "verified"
        | "suspended"
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
      enrolment_status: ["active", "removed"],
      guardian_event_kind: ["guardian_added", "guardian_removed", "phone_changed", "alerts_on", "alerts_off"],
      member_status: ["pending", "active", "disabled"],
      record_source: ["rollcol", "stediis"],
      register_mode: ["daily", "per_period"],
      school_status: ["unverified", "verified", "suspended"],
      school_type: ["tertiary", "non_tertiary"],
      staff_role: ["admin", "teacher"],
    },
  },
} as const
