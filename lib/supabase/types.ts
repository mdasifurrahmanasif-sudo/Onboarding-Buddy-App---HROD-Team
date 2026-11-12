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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_grants: {
        Row: {
          created_at: string
          enroll_number: string
          granted_by: string | null
          role: string
          sbus: string[]
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          enroll_number: string
          granted_by?: string | null
          role: string
          sbus?: string[]
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          enroll_number?: string
          granted_by?: string | null
          role?: string
          sbus?: string[]
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: []
      }
      assessment_templates: {
        Row: {
          assessment_key: string
          items: string[]
          status_options: string[]
          title: string
          variant_id: string
        }
        Insert: {
          assessment_key: string
          items: string[]
          status_options: string[]
          title: string
          variant_id: string
        }
        Update: {
          assessment_key?: string
          items?: string[]
          status_options?: string[]
          title?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_templates_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_events: {
        Row: {
          created_at: string
          detail: Json
          event_type: string
          id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_intents: {
        Row: {
          active: boolean
          confidence_threshold: number
          escalation_rule: string | null
          follow_up_questions: string[]
          intent_id: string
          intent_name: string
          keywords: string[]
          related_intents: string[]
          required_slots: Json
          response_templates: Json
          source: string
          source_ref: string | null
        }
        Insert: {
          active?: boolean
          confidence_threshold?: number
          escalation_rule?: string | null
          follow_up_questions?: string[]
          intent_id: string
          intent_name: string
          keywords?: string[]
          related_intents?: string[]
          required_slots?: Json
          response_templates?: Json
          source: string
          source_ref?: string | null
        }
        Update: {
          active?: boolean
          confidence_threshold?: number
          escalation_rule?: string | null
          follow_up_questions?: string[]
          intent_id?: string
          intent_name?: string
          keywords?: string[]
          related_intents?: string[]
          required_slots?: Json
          response_templates?: Json
          source?: string
          source_ref?: string | null
        }
        Relationships: []
      }
      assistant_kb: {
        Row: {
          active: boolean
          id: string
          keywords: string[]
          response_text: string
        }
        Insert: {
          active?: boolean
          id?: string
          keywords: string[]
          response_text: string
        }
        Update: {
          active?: boolean
          id?: string
          keywords?: string[]
          response_text?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          confidence_score: number | null
          created_at: string
          detected_intent: string | null
          detected_language: string | null
          entities: Json
          id: string
          message_text: string
          role: string
          session_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          detected_intent?: string | null
          detected_language?: string | null
          entities?: Json
          id?: string
          message_text: string
          role: string
          session_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          detected_intent?: string | null
          detected_language?: string | null
          entities?: Json
          id?: string
          message_text?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_sessions: {
        Row: {
          collected_slots: Json
          confidence_score: number | null
          conversation_state: string
          created_at: string
          current_intent: string | null
          current_topic: string | null
          ended_at: string | null
          id: string
          last_action: string | null
          previous_intent: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          collected_slots?: Json
          confidence_score?: number | null
          conversation_state?: string
          created_at?: string
          current_intent?: string | null
          current_topic?: string | null
          ended_at?: string | null
          id?: string
          last_action?: string | null
          previous_intent?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          collected_slots?: Json
          confidence_score?: number | null
          conversation_state?: string
          created_at?: string
          current_intent?: string | null
          current_topic?: string | null
          ended_at?: string | null
          id?: string
          last_action?: string | null
          previous_intent?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_synonyms: {
        Row: {
          canonical_term: string
          id: string
          variant: string
        }
        Insert: {
          canonical_term: string
          id?: string
          variant: string
        }
        Update: {
          canonical_term?: string
          id?: string
          variant?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action_type: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
          profile_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          icon: string
          key: string
          name: string
          variant_id: string
        }
        Insert: {
          icon: string
          key: string
          name: string
          variant_id: string
        }
        Update: {
          icon?: string
          key?: string
          name?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          active: boolean
          icon: string
          key: string
          name: string
          phone: string
          role: string
          variant_id: string
        }
        Insert: {
          active?: boolean
          icon: string
          key: string
          name: string
          phone: string
          role: string
          variant_id: string
        }
        Update: {
          active?: boolean
          icon?: string
          key?: string
          name?: string
          phone?: string
          role?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_assessments: {
        Row: {
          assessment_key: string
          employee_comment: string | null
          employee_enroll_number: string
          final_status: string | null
          hr_observation: string | null
          manager_feedback: string | null
          ratings: Json
          submitted_at: string | null
        }
        Insert: {
          assessment_key: string
          employee_comment?: string | null
          employee_enroll_number: string
          final_status?: string | null
          hr_observation?: string | null
          manager_feedback?: string | null
          ratings?: Json
          submitted_at?: string | null
        }
        Update: {
          assessment_key?: string
          employee_comment?: string | null
          employee_enroll_number?: string
          final_status?: string | null
          hr_observation?: string | null
          manager_feedback?: string | null
          ratings?: Json
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_assessments_assessment_key_fkey"
            columns: ["assessment_key"]
            isOneToOne: false
            referencedRelation: "assessment_templates"
            referencedColumns: ["assessment_key"]
          },
          {
            foreignKeyName: "employee_assessments_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
        ]
      }
      employee_badges: {
        Row: {
          badge_key: string
          earned_at: string
          employee_enroll_number: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          employee_enroll_number: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          employee_enroll_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "employee_badges_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
        ]
      }
      employee_task_status: {
        Row: {
          done: boolean
          done_date: string | null
          employee_enroll_number: string
          task_id: string
          updated_at: string
        }
        Insert: {
          done?: boolean
          done_date?: string | null
          employee_enroll_number: string
          task_id: string
          updated_at?: string
        }
        Update: {
          done?: boolean
          done_date?: string | null
          employee_enroll_number?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_task_status_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "employee_task_status_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          buddy: string | null
          buddy_email: string | null
          buddy_phone: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          enroll_number: string
          joining_date: string | null
          name: string
          profile_id: string | null
          reporting_manager: string | null
          reporting_manager_email: string | null
          reporting_manager_phone: string | null
          sbu: string | null
          section: string | null
          team: string | null
          updated_at: string
        }
        Insert: {
          buddy?: string | null
          buddy_email?: string | null
          buddy_phone?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          enroll_number: string
          joining_date?: string | null
          name: string
          profile_id?: string | null
          reporting_manager?: string | null
          reporting_manager_email?: string | null
          reporting_manager_phone?: string | null
          sbu?: string | null
          section?: string | null
          team?: string | null
          updated_at?: string
        }
        Update: {
          buddy?: string | null
          buddy_email?: string | null
          buddy_phone?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          enroll_number?: string
          joining_date?: string | null
          name?: string
          profile_id?: string | null
          reporting_manager?: string | null
          reporting_manager_email?: string | null
          reporting_manager_phone?: string | null
          sbu?: string | null
          section?: string | null
          team?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_issue_types: {
        Row: {
          active: boolean
          assigned_team: string
          created_at: string
          id: string
          label: string
          sequence: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          active?: boolean
          assigned_team: string
          created_at?: string
          id?: string
          label: string
          sequence?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          active?: boolean
          assigned_team?: string
          created_at?: string
          id?: string
          label?: string
          sequence?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_issue_types_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          assigned_team: string
          attachment_url: string | null
          created_at: string
          description: string
          employee_enroll_number: string
          id: string
          issue_type: string
          phone: string | null
          related_task_id: string | null
          status: string
          ticket_id: string
          variant_id: string
        }
        Insert: {
          assigned_team: string
          attachment_url?: string | null
          created_at?: string
          description: string
          employee_enroll_number: string
          id?: string
          issue_type: string
          phone?: string | null
          related_task_id?: string | null
          status?: string
          ticket_id: string
          variant_id: string
        }
        Update: {
          assigned_team?: string
          attachment_url?: string | null
          created_at?: string
          description?: string
          employee_enroll_number?: string
          id?: string
          issue_type?: string
          phone?: string | null
          related_task_id?: string | null
          status?: string
          ticket_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "help_requests_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_journey_completion_notifications: {
        Row: {
          created_at: string
          employee_enroll_number: string
          id: string
          is_read: boolean
          journey_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          employee_enroll_number: string
          id?: string
          is_read?: boolean
          journey_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          employee_enroll_number?: string
          id?: string
          is_read?: boolean
          journey_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_journey_completion_notifications_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "onboarding_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_journey_completion_notifications_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_assessment_answers: {
        Row: {
          answer_text: string | null
          id: string
          marks_awarded: number
          question_id: string
          selected_option_key: string | null
          submission_id: string
        }
        Insert: {
          answer_text?: string | null
          id?: string
          marks_awarded?: number
          question_id: string
          selected_option_key?: string | null
          submission_id: string
        }
        Update: {
          answer_text?: string | null
          id?: string
          marks_awarded?: number
          question_id?: string
          selected_option_key?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "journey_assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_assessment_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "journey_assessment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_assessment_questions: {
        Row: {
          assessment_id: string
          correct_option_key: string | null
          created_at: string
          id: string
          marks: number
          options: Json | null
          question_text: string
          sequence: number
          type: string
        }
        Insert: {
          assessment_id: string
          correct_option_key?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          question_text: string
          sequence?: number
          type: string
        }
        Update: {
          assessment_id?: string
          correct_option_key?: string | null
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          question_text?: string
          sequence?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "journey_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_assessment_submissions: {
        Row: {
          assessment_id: string
          employee_enroll_number: string
          id: string
          journey_id: string
          score: number
          submitted_at: string
          variant_id: string
        }
        Insert: {
          assessment_id: string
          employee_enroll_number: string
          id?: string
          journey_id: string
          score?: number
          submitted_at?: string
          variant_id: string
        }
        Update: {
          assessment_id?: string
          employee_enroll_number?: string
          id?: string
          journey_id?: string
          score?: number
          submitted_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_assessment_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "journey_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_assessment_submissions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "onboarding_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_assessment_submissions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_assessments: {
        Row: {
          created_at: string
          id: string
          journey_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journey_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journey_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_assessments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: true
            referencedRelation: "onboarding_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_assessments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_comments: {
        Row: {
          author_enroll_number: string
          author_role: string
          comment: string
          created_at: string
          employee_enroll_number: string
          id: string
          submission_id: string
        }
        Insert: {
          author_enroll_number: string
          author_role: string
          comment: string
          created_at?: string
          employee_enroll_number: string
          id?: string
          submission_id: string
        }
        Update: {
          author_enroll_number?: string
          author_role?: string
          comment?: string
          created_at?: string
          employee_enroll_number?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_comments_author_enroll_number_fkey"
            columns: ["author_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "kpi_comments_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "kpi_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "kpi_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_items: {
        Row: {
          achievement: number
          achievement_updated_at: string | null
          added_by_manager: boolean
          created_at: string
          employee_enroll_number: string
          frequency: string
          id: string
          name: string
          submission_id: string
          target: number
          unit: string | null
        }
        Insert: {
          achievement?: number
          achievement_updated_at?: string | null
          added_by_manager?: boolean
          created_at?: string
          employee_enroll_number: string
          frequency?: string
          id?: string
          name: string
          submission_id: string
          target: number
          unit?: string | null
        }
        Update: {
          achievement?: number
          achievement_updated_at?: string | null
          added_by_manager?: boolean
          created_at?: string
          employee_enroll_number?: string
          frequency?: string
          id?: string
          name?: string
          submission_id?: string
          target?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_items_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "kpi_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "kpi_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          recipient_enroll_number: string
          related_submission_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_enroll_number: string
          related_submission_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_enroll_number?: string
          related_submission_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_notifications_recipient_enroll_number_fkey"
            columns: ["recipient_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "kpi_notifications_related_submission_id_fkey"
            columns: ["related_submission_id"]
            isOneToOne: false
            referencedRelation: "kpi_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_submissions: {
        Row: {
          created_at: string
          employee_enroll_number: string
          employee_note: string | null
          id: string
          manager_comment: string | null
          period_month: string
          reviewed_at: string | null
          reviewed_by_enroll_number: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_enroll_number: string
          employee_note?: string | null
          id?: string
          manager_comment?: string | null
          period_month: string
          reviewed_at?: string | null
          reviewed_by_enroll_number?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_enroll_number?: string
          employee_note?: string | null
          id?: string
          manager_comment?: string | null
          period_month?: string
          reviewed_at?: string | null
          reviewed_by_enroll_number?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_submissions_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "kpi_submissions_reviewed_by_enroll_number_fkey"
            columns: ["reviewed_by_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
        ]
      }
      leaderboard_photos: {
        Row: {
          employee_enroll_number: string
          storage_path: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          employee_enroll_number: string
          storage_path: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          employee_enroll_number?: string
          storage_path?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_photos_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_assessment_templates: {
        Row: {
          milestone: string
          questions: string[]
          variant_id: string
        }
        Insert: {
          milestone: string
          questions: string[]
          variant_id: string
        }
        Update: {
          milestone?: string
          questions?: string[]
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_assessment_templates_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_assessments: {
        Row: {
          created_at: string
          employee_enroll_number: string
          id: string
          identity: Json
          milestone: string
          responses: Json
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          employee_enroll_number: string
          id?: string
          identity?: Json
          milestone: string
          responses?: Json
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          employee_enroll_number?: string
          id?: string
          identity?: Json
          milestone?: string
          responses?: Json
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestone_assessments_employee_enroll_number_fkey"
            columns: ["employee_enroll_number"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["enroll_number"]
          },
          {
            foreignKeyName: "milestone_assessments_milestone_fkey"
            columns: ["milestone"]
            isOneToOne: false
            referencedRelation: "milestone_assessment_templates"
            referencedColumns: ["milestone"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          recipient_enroll_number: string
          title: string
          variant_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_enroll_number: string
          title: string
          variant_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_enroll_number?: string
          title?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_phases: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sequence: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sequence?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sequence?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_phases_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          active: boolean
          confirm_question: string
          how_to_steps: string[]
          id: string
          phase: string
          responsible_key: string
          responsible_keys: string[]
          responsible_role: string
          timeline: string
          title: string
          variant_id: string
          why_text: string
          work_number: number
        }
        Insert: {
          active?: boolean
          confirm_question: string
          how_to_steps: string[]
          id?: string
          phase: string
          responsible_key: string
          responsible_keys?: string[]
          responsible_role: string
          timeline: string
          title: string
          variant_id: string
          why_text: string
          work_number: number
        }
        Update: {
          active?: boolean
          confirm_question?: string
          how_to_steps?: string[]
          id?: string
          phase?: string
          responsible_key?: string
          responsible_keys?: string[]
          responsible_role?: string
          timeline?: string
          title?: string
          variant_id?: string
          why_text?: string
          work_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_variants: {
        Row: {
          accent_color: string | null
          background_color: string | null
          created_at: string
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          nav_mode: string
          primary_color: string | null
          sbu_aliases: string[]
          secondary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name: string
          nav_mode?: string
          primary_color?: string | null
          sbu_aliases?: string[]
          secondary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          nav_mode?: string
          primary_color?: string | null
          sbu_aliases?: string[]
          secondary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      peopledesk_kb: {
        Row: {
          active: boolean
          answer: string
          created_at: string
          id: string
          module: string
          owner_escalation: string | null
          perspective: string | null
          priority: string | null
          question_banglish: string | null
          question_bn: string | null
          question_en: string
          source: string
        }
        Insert: {
          active?: boolean
          answer: string
          created_at?: string
          id?: string
          module: string
          owner_escalation?: string | null
          perspective?: string | null
          priority?: string | null
          question_banglish?: string | null
          question_bn?: string | null
          question_en: string
          source: string
        }
        Update: {
          active?: boolean
          answer?: string
          created_at?: string
          id?: string
          module?: string
          owner_escalation?: string | null
          perspective?: string | null
          priority?: string | null
          question_banglish?: string | null
          question_bn?: string | null
          question_en?: string
          source?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: { auth: string; created_at: string; endpoint: string; enroll_number: string; p256dh: string }
        Insert: { auth: string; created_at?: string; endpoint: string; enroll_number: string; p256dh: string }
        Update: { auth?: string; created_at?: string; endpoint?: string; enroll_number?: string; p256dh?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_variant_id: string | null
          created_at: string
          enroll_number: string
          full_name: string
          id: string
          is_hr_admin: boolean
          is_it_admin: boolean
          is_super_admin: boolean
        }
        Insert: {
          admin_variant_id?: string | null
          created_at?: string
          enroll_number: string
          full_name: string
          id: string
          is_hr_admin?: boolean
          is_it_admin?: boolean
          is_super_admin?: boolean
        }
        Update: {
          admin_variant_id?: string | null
          created_at?: string
          enroll_number?: string
          full_name?: string
          id?: string
          is_hr_admin?: boolean
          is_it_admin?: boolean
          is_super_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_variant_id_fkey"
            columns: ["admin_variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_links: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          sequence: number
          title: string
          updated_at: string
          url: string
          variant_id: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          sequence?: number
          title: string
          updated_at?: string
          url: string
          variant_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          sequence?: number
          title?: string
          updated_at?: string
          url?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_links_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sbu_hr_assignments: {
        Row: {
          cluster: string
          collision_group: string | null
          collision_label: string | null
          created_at: string
          hr_cluster_head_email: string | null
          hr_cluster_head_name: string | null
          hr_cluster_head_phone: string | null
          hr_ss_email: string | null
          hr_ss_name: string | null
          hr_ss_phone: string | null
          hrbp_email: string | null
          hrbp_name: string | null
          hrbp_phone: string | null
          id: string
          it_head_email: string | null
          it_head_name: string | null
          it_head_phone: string | null
          notes: string | null
          sbu_aliases: string[]
          sbu_display_name: string
        }
        Insert: {
          cluster: string
          collision_group?: string | null
          collision_label?: string | null
          created_at?: string
          hr_cluster_head_email?: string | null
          hr_cluster_head_name?: string | null
          hr_cluster_head_phone?: string | null
          hr_ss_email?: string | null
          hr_ss_name?: string | null
          hr_ss_phone?: string | null
          hrbp_email?: string | null
          hrbp_name?: string | null
          hrbp_phone?: string | null
          id?: string
          it_head_email?: string | null
          it_head_name?: string | null
          it_head_phone?: string | null
          notes?: string | null
          sbu_aliases?: string[]
          sbu_display_name: string
        }
        Update: {
          cluster?: string
          collision_group?: string | null
          collision_label?: string | null
          created_at?: string
          hr_cluster_head_email?: string | null
          hr_cluster_head_name?: string | null
          hr_cluster_head_phone?: string | null
          hr_ss_email?: string | null
          hr_ss_name?: string | null
          hr_ss_phone?: string | null
          hrbp_email?: string | null
          hrbp_name?: string | null
          hrbp_phone?: string | null
          id?: string
          it_head_email?: string | null
          it_head_name?: string | null
          it_head_phone?: string | null
          notes?: string | null
          sbu_aliases?: string[]
          sbu_display_name?: string
        }
        Relationships: []
      }
      sbu_options: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      assistant_conversation_length: {
        Row: {
          message_count: number | null
          session_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_escalation_rate: {
        Row: {
          escalated_sessions: number | null
          escalation_rate_pct: number | null
          total_sessions: number | null
        }
        Relationships: []
      }
      assistant_intent_frequency: {
        Row: {
          hit_count: number | null
          intent_id: string | null
        }
        Relationships: []
      }
      assistant_satisfaction_events: {
        Row: {
          event_count: number | null
          event_type: string | null
        }
        Relationships: []
      }
      assistant_unmatched_queries: {
        Row: {
          closest_intent: string | null
          created_at: string | null
          query_text: string | null
        }
        Insert: {
          closest_intent?: never
          created_at?: string | null
          query_text?: never
        }
        Update: {
          closest_intent?: never
          created_at?: string | null
          query_text?: never
        }
        Relationships: []
      }
    }
    Functions: {
      current_enroll_number: { Args: never; Returns: string }
      is_hr_admin: { Args: never; Returns: boolean }
      is_it_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_manager_of: { Args: { target_enroll: string }; Returns: boolean }
      manager_set_buddy: {
        Args: {
          p_buddy: string
          p_buddy_email: string
          p_buddy_phone: string
          p_enroll: string
        }
        Returns: undefined
      }
      manager_set_feedback: {
        Args: { p_assessment_key: string; p_enroll: string; p_feedback: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
