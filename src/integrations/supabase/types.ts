export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      assessment_subjects: {
        Row: {
          assessment_id: number
          subject_id: number
        }
        Insert: {
          assessment_id: number
          subject_id: number
        }
        Update: {
          assessment_id?: number
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_subjects_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          academic_year_id: number | null
          author_name: string | null
          author_user_id: string | null
          class_id: number
          created_at: string
          due_date: string | null
          id: number
          is_class_wide: boolean
          is_published: boolean
          is_school_wide: boolean
          is_verified: boolean
          marks_entered_percent: number
          name: string
          promotion_role: number
          stream_id: number | null
          stream_ids: number[]
          subject_id: number | null
          term_id: number | null
          weight_percent: number
        }
        Insert: {
          academic_year_id?: number | null
          author_name?: string | null
          author_user_id?: string | null
          class_id: number
          created_at?: string
          due_date?: string | null
          id?: number
          is_class_wide?: boolean
          is_published?: boolean
          is_school_wide?: boolean
          is_verified?: boolean
          marks_entered_percent?: number
          name: string
          promotion_role?: number
          stream_id?: number | null
          stream_ids?: number[]
          subject_id?: number | null
          term_id?: number | null
          weight_percent?: number
        }
        Update: {
          academic_year_id?: number | null
          author_name?: string | null
          author_user_id?: string | null
          class_id?: number
          created_at?: string
          due_date?: string | null
          id?: number
          is_class_wide?: boolean
          is_published?: boolean
          is_school_wide?: boolean
          is_verified?: boolean
          marks_entered_percent?: number
          name?: string
          promotion_role?: number
          stream_id?: number | null
          stream_ids?: number[]
          subject_id?: number | null
          term_id?: number | null
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          budgeted: number
          category: string
          created_at: string
          financial_year: string
          id: number
          spent: number
        }
        Insert: {
          budgeted?: number
          category: string
          created_at?: string
          financial_year?: string
          id?: number
          spent?: number
        }
        Update: {
          budgeted?: number
          category?: string
          created_at?: string
          financial_year?: string
          id?: number
          spent?: number
        }
        Relationships: []
      }
      class_streams: {
        Row: {
          class_id: number
          stream_id: number
          stream_teacher_id: number | null
        }
        Insert: {
          class_id: number
          stream_id: number
          stream_teacher_id?: number | null
        }
        Update: {
          class_id?: number
          stream_id?: number
          stream_teacher_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_streams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_streams_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_streams_stream_teacher_id_fkey"
            columns: ["stream_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: number
          subject_id: number
        }
        Insert: {
          class_id: number
          subject_id: number
        }
        Update: {
          class_id?: number
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher_id: number | null
          created_at: string
          grading_system_id: number | null
          id: number
          name: string
        }
        Insert: {
          class_teacher_id?: number | null
          created_at?: string
          grading_system_id?: number | null
          id?: number
          name: string
        }
        Update: {
          class_teacher_id?: number | null
          created_at?: string
          grading_system_id?: number | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_grading_system_id_fkey"
            columns: ["grading_system_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          admission_number: string
          allergies_or_conditions: string
          authorized_pickup_person: string
          date_of_birth: string | null
          emergency_name: string
          emergency_phone: string
          emergency_relationship: string
          full_name: string
          gender: string
          guardian_address: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          has_custody_documents: boolean
          has_immunization_card: boolean
          has_medical_exam_report: boolean
          health_insurance: string
          id: number
          lin: string
          nationality: string
          previous_school: string
          religion: string
          residence_district: string
          residence_proof_type: string
          residence_zone: string
          status: string
          submitted_at: string
        }
        Insert: {
          admission_number?: string
          allergies_or_conditions?: string
          authorized_pickup_person?: string
          date_of_birth?: string | null
          emergency_name?: string
          emergency_phone?: string
          emergency_relationship?: string
          full_name: string
          gender?: string
          guardian_address?: string
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          guardian_relationship?: string
          has_custody_documents?: boolean
          has_immunization_card?: boolean
          has_medical_exam_report?: boolean
          health_insurance?: string
          id?: number
          lin?: string
          nationality?: string
          previous_school?: string
          religion?: string
          residence_district?: string
          residence_proof_type?: string
          residence_zone?: string
          status?: string
          submitted_at?: string
        }
        Update: {
          admission_number?: string
          allergies_or_conditions?: string
          authorized_pickup_person?: string
          date_of_birth?: string | null
          emergency_name?: string
          emergency_phone?: string
          emergency_relationship?: string
          full_name?: string
          gender?: string
          guardian_address?: string
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          guardian_relationship?: string
          has_custody_documents?: boolean
          has_immunization_card?: boolean
          has_medical_exam_report?: boolean
          health_insurance?: string
          id?: number
          lin?: string
          nationality?: string
          previous_school?: string
          religion?: string
          residence_district?: string
          residence_proof_type?: string
          residence_zone?: string
          status?: string
          submitted_at?: string
        }
        Relationships: []
      }
      fee_payments: {
        Row: {
          amount: number
          description: string | null
          id: number
          payment_date: string
          recorded_by: string | null
          student_id: number
          term_id: number | null
        }
        Insert: {
          amount: number
          description?: string | null
          id?: number
          payment_date?: string
          recorded_by?: string | null
          student_id: number
          term_id?: number | null
        }
        Update: {
          amount?: number
          description?: string | null
          id?: number
          payment_date?: string
          recorded_by?: string | null
          student_id?: number
          term_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_bands: {
        Row: {
          grading_system_id: number
          id: number
          is_promotional_fail: boolean
          is_promotional_pass: boolean
          is_repeater: boolean
          label: string
          max_score: number
          min_score: number
        }
        Insert: {
          grading_system_id: number
          id?: number
          is_promotional_fail?: boolean
          is_promotional_pass?: boolean
          is_repeater?: boolean
          label: string
          max_score: number
          min_score: number
        }
        Update: {
          grading_system_id?: number
          id?: number
          is_promotional_fail?: boolean
          is_promotional_pass?: boolean
          is_repeater?: boolean
          label?: string
          max_score?: number
          min_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_bands_grading_system_id_fkey"
            columns: ["grading_system_id"]
            isOneToOne: false
            referencedRelation: "grading_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_systems: {
        Row: {
          created_at: string
          id: number
          is_default: boolean
          name: string
          pass_mark: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_default?: boolean
          name: string
          pass_mark?: number
        }
        Update: {
          created_at?: string
          id?: number
          is_default?: boolean
          name?: string
          pass_mark?: number
        }
        Relationships: []
      }
      head_teacher_comments: {
        Row: {
          comment: string
          created_at: string
          head_teacher_name: string
          id: number
          student_id: number
          term_id: number | null
        }
        Insert: {
          comment?: string
          created_at?: string
          head_teacher_name?: string
          id?: number
          student_id: number
          term_id?: number | null
        }
        Update: {
          comment?: string
          created_at?: string
          head_teacher_name?: string
          id?: number
          student_id?: number
          term_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "head_teacher_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "head_teacher_comments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          allowed_pages: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: number
          is_used: boolean
          label: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_by: string | null
        }
        Insert: {
          allowed_pages?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: number
          is_used?: boolean
          label?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_by?: string | null
        }
        Update: {
          allowed_pages?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: number
          is_used?: boolean
          label?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_by?: string | null
        }
        Relationships: []
      }
      legacy_users: {
        Row: {
          allowed_pages: string | null
          claimed_at: string | null
          claimed_by: string | null
          email: string
          full_name: string
          legacy_id: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          allowed_pages?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          email: string
          full_name?: string
          legacy_id: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          allowed_pages?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          email?: string
          full_name?: string
          legacy_id?: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      marks: {
        Row: {
          assessment_id: number
          entered_at: string | null
          entered_by: string | null
          grade: string | null
          id: number
          mark: number | null
          remarks: string | null
          student_id: number
          subject_id: number | null
        }
        Insert: {
          assessment_id: number
          entered_at?: string | null
          entered_by?: string | null
          grade?: string | null
          id?: number
          mark?: number | null
          remarks?: string | null
          student_id: number
          subject_id?: number | null
        }
        Update: {
          assessment_id?: number
          entered_at?: string | null
          entered_by?: string | null
          grade?: string | null
          id?: number
          mark?: number | null
          remarks?: string | null
          student_id?: number
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowed_pages: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          legacy_user_id: number | null
        }
        Insert: {
          allowed_pages?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          legacy_user_id?: number | null
        }
        Update: {
          allowed_pages?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          legacy_user_id?: number | null
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          head_teacher_name: string
          id: number
          logo_path: string | null
          motto: string
          school_address: string
          school_name: string
          school_phone: string
          updated_at: string
        }
        Insert: {
          head_teacher_name?: string
          id?: number
          logo_path?: string | null
          motto?: string
          school_address?: string
          school_name?: string
          school_phone?: string
          updated_at?: string
        }
        Update: {
          head_teacher_name?: string
          id?: number
          logo_path?: string | null
          motto?: string
          school_address?: string
          school_name?: string
          school_phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      student_credits: {
        Row: {
          amount: number
          applied_at: string | null
          applied_to_term_id: number | null
          created_at: string
          description: string | null
          from_term_id: number
          id: number
          student_id: number
        }
        Insert: {
          amount: number
          applied_at?: string | null
          applied_to_term_id?: number | null
          created_at?: string
          description?: string | null
          from_term_id: number
          id?: number
          student_id: number
        }
        Update: {
          amount?: number
          applied_at?: string | null
          applied_to_term_id?: number | null
          created_at?: string
          description?: string | null
          from_term_id?: number
          id?: number
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_credits_applied_to_term_id_fkey"
            columns: ["applied_to_term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_credits_from_term_id_fkey"
            columns: ["from_term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_number: string | null
          allergies_or_conditions: string | null
          authorized_pickup_person: string | null
          class_id: number | null
          created_at: string
          date_of_birth: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          full_name: string
          gender: string | null
          guardian_address: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          has_custody_documents: boolean
          has_immunization_card: boolean
          has_medical_exam_report: boolean
          health_insurance: string | null
          id: number
          is_active: boolean
          lin: string
          photo_path: string | null
          promoted_to_class_id: number | null
          promotion_processed_at: string | null
          promotion_status: number
          residence_district: string | null
          residence_proof_type: string | null
          residence_zone: string | null
          stream_id: number | null
          termination_date: string | null
          termination_reason: number
        }
        Insert: {
          admission_number?: string | null
          allergies_or_conditions?: string | null
          authorized_pickup_person?: string | null
          class_id?: number | null
          created_at?: string
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          full_name: string
          gender?: string | null
          guardian_address?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          has_custody_documents?: boolean
          has_immunization_card?: boolean
          has_medical_exam_report?: boolean
          health_insurance?: string | null
          id?: number
          is_active?: boolean
          lin: string
          photo_path?: string | null
          promoted_to_class_id?: number | null
          promotion_processed_at?: string | null
          promotion_status?: number
          residence_district?: string | null
          residence_proof_type?: string | null
          residence_zone?: string | null
          stream_id?: number | null
          termination_date?: string | null
          termination_reason?: number
        }
        Update: {
          admission_number?: string | null
          allergies_or_conditions?: string | null
          authorized_pickup_person?: string | null
          class_id?: number | null
          created_at?: string
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          full_name?: string
          gender?: string | null
          guardian_address?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          has_custody_documents?: boolean
          has_immunization_card?: boolean
          has_medical_exam_report?: boolean
          health_insurance?: string | null
          id?: number
          is_active?: boolean
          lin?: string
          photo_path?: string | null
          promoted_to_class_id?: number | null
          promotion_processed_at?: string | null
          promotion_status?: number
          residence_district?: string | null
          residence_proof_type?: string | null
          residence_zone?: string | null
          stream_id?: number | null
          termination_date?: string | null
          termination_reason?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_promoted_to_class_id_fkey"
            columns: ["promoted_to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          classes_taught: string | null
          created_at: string
          email: string | null
          full_name: string
          id: number
          is_registered_teacher: boolean
          is_student_teacher: boolean
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          phone: string | null
          previous_schools: string | null
          subjects_taught: string | null
        }
        Insert: {
          classes_taught?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: number
          is_registered_teacher?: boolean
          is_student_teacher?: boolean
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          previous_schools?: string | null
          subjects_taught?: string | null
        }
        Update: {
          classes_taught?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: number
          is_registered_teacher?: boolean
          is_student_teacher?: boolean
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          phone?: string | null
          previous_schools?: string | null
          subjects_taught?: string | null
        }
        Relationships: []
      }
      term_fees: {
        Row: {
          amount: number
          class_id: number
          id: number
          term_id: number
        }
        Insert: {
          amount?: number
          class_id: number
          id?: number
          term_id: number
        }
        Update: {
          amount?: number
          class_id?: number
          id?: number
          term_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_fees_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_fees_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      termination_logs: {
        Row: {
          anonymized: boolean
          id: number
          logged_at: string
          student_id: number | null
          student_name_at_termination: string
          termination_date: string
          termination_reason: number
        }
        Insert: {
          anonymized?: boolean
          id?: number
          logged_at?: string
          student_id?: number | null
          student_name_at_termination?: string
          termination_date: string
          termination_reason: number
        }
        Update: {
          anonymized?: boolean
          id?: number
          logged_at?: string
          student_id?: number | null
          student_name_at_termination?: string
          termination_date?: string
          termination_reason?: number
        }
        Relationships: [
          {
            foreignKeyName: "termination_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          end_date: string | null
          id: number
          is_active: boolean
          name: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: number
          is_active?: boolean
          name: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: number
          is_active?: boolean
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_invite: { Args: { _code: string }; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      claim_legacy_account: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      redeem_invite: { Args: { _code: string }; Returns: boolean }
      school_has_admin: { Args: never; Returns: boolean }
      set_active_term: { Args: { _term_id: number }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "data_entrant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "data_entrant"],
    },
  },
} as const
