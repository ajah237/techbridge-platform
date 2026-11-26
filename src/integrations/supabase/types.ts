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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      about_team_members: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          initials: string | null
          linkedin_url: string | null
          photo_url: string | null
          role: string
          sort_order: number
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          initials?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          role: string
          sort_order?: number
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          initials?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          role?: string
          sort_order?: number
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          performed_by: string
          resource_id: string | null
          resource_label: string | null
          resource_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          performed_by: string
          resource_id?: string | null
          resource_label?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          performed_by?: string
          resource_id?: string | null
          resource_label?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      auth_audit_log: {
        Row: {
          actor_id: string | null
          affected_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          affected_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          points_threshold: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          points_threshold?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          points_threshold?: number
          slug?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_email: string
          author_name: string
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          ip_hash: string | null
          parent_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["comment_status"]
          updated_at: string
        }
        Insert: {
          author_email: string
          author_name: string
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          parent_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Update: {
          author_email?: string
          author_name?: string
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          parent_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["comment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          scheduled_for: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          booking_id: string
          created_at: string
          event_type: string
          from_end_at: string | null
          from_start_at: string | null
          from_status: string | null
          id: string
          metadata: Json
          reason: string | null
          to_end_at: string | null
          to_start_at: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          from_end_at?: string | null
          from_start_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_end_at?: string | null
          to_start_at?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          from_end_at?: string | null
          from_start_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          to_end_at?: string | null
          to_start_at?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "mentor_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      category_fee_tiers: {
        Row: {
          amount: number
          category_id: string
          closes_at: string | null
          created_at: string
          currency: string
          id: string
          label: string
          opens_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id: string
          closes_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          label: string
          opens_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          closes_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          label?: string
          opens_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_fee_tiers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_reissues: {
        Row: {
          certificate_id: string
          created_at: string
          id: string
          new_number: string
          new_recipient_name: string | null
          previous_number: string
          previous_recipient_name: string | null
          reason: string | null
          reissued_by: string | null
        }
        Insert: {
          certificate_id: string
          created_at?: string
          id?: string
          new_number: string
          new_recipient_name?: string | null
          previous_number: string
          previous_recipient_name?: string | null
          reason?: string | null
          reissued_by?: string | null
        }
        Update: {
          certificate_id?: string
          created_at?: string
          id?: string
          new_number?: string
          new_recipient_name?: string | null
          previous_number?: string
          previous_recipient_name?: string | null
          reason?: string | null
          reissued_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_reissues_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_share_tokens: {
        Row: {
          certificate_id: string
          created_at: string
          expires_at: string
          id: string
          sent_by: string | null
          sent_to: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          certificate_id: string
          created_at?: string
          expires_at?: string
          id?: string
          sent_by?: string | null
          sent_to?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          certificate_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          sent_by?: string | null
          sent_to?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_share_tokens_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          accent_color: string | null
          body_intro: string | null
          default_signatories: Json
          footer_line: string | null
          heading_text: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          stamp_offset_x: number
          stamp_offset_y: number
          stamp_opacity: number
          stamp_rotation: number
          stamp_scale: number
          stamp_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          body_intro?: string | null
          default_signatories?: Json
          footer_line?: string | null
          heading_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          stamp_offset_x?: number
          stamp_offset_y?: number
          stamp_opacity?: number
          stamp_rotation?: number
          stamp_scale?: number
          stamp_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          body_intro?: string | null
          default_signatories?: Json
          footer_line?: string | null
          heading_text?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          stamp_offset_x?: number
          stamp_offset_y?: number
          stamp_opacity?: number
          stamp_rotation?: number
          stamp_scale?: number
          stamp_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          issued_at: string
          program_type: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signatories: Json
          user_id: string
        }
        Insert: {
          certificate_number: string
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          issued_at?: string
          program_type?: string | null
          recipient_name: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          signatories?: Json
          user_id: string
        }
        Update: {
          certificate_number?: string
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          issued_at?: string
          program_type?: string | null
          recipient_name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          signatories?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          source_path: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          source_path?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          source_path?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["report_content_type"]
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["report_content_type"]
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["report_content_type"]
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      event_announcements: {
        Row: {
          body: string
          category_id: string | null
          created_at: string
          event_id: string
          id: string
          recipient_count: number
          sent_by: string
          title: string
        }
        Insert: {
          body: string
          category_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          recipient_count?: number
          sent_by?: string
          title: string
        }
        Update: {
          body?: string
          category_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          recipient_count?: number
          sent_by?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_announcements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          challenge_release_at: string | null
          competition_date: string | null
          created_at: string
          currency: string
          description: string | null
          eligibility: string | null
          event_id: string
          id: string
          institution_label: string
          is_active: boolean
          max_team_size: number
          min_team_size: number
          name: string
          registration_deadline: string | null
          requires_class_level: boolean
          requires_institution: boolean
          requires_teacher_mentor: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          challenge_release_at?: string | null
          competition_date?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          eligibility?: string | null
          event_id: string
          id?: string
          institution_label?: string
          is_active?: boolean
          max_team_size?: number
          min_team_size?: number
          name: string
          registration_deadline?: string | null
          requires_class_level?: boolean
          requires_institution?: boolean
          requires_teacher_mentor?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          challenge_release_at?: string | null
          competition_date?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          eligibility?: string | null
          event_id?: string
          id?: string
          institution_label?: string
          is_active?: boolean
          max_team_size?: number
          min_team_size?: number
          name?: string
          registration_deadline?: string | null
          requires_class_level?: boolean
          requires_institution?: boolean
          requires_teacher_mentor?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          anonymous: boolean
          content: string | null
          created_at: string
          event_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          anonymous?: boolean
          content?: string | null
          created_at?: string
          event_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          anonymous?: boolean
          content?: string | null
          created_at?: string
          event_id?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      event_people: {
        Row: {
          created_at: string
          email: string | null
          event_id: string
          full_name: string
          id: string
          is_public: boolean
          kind: string
          notes: string | null
          organisation: string | null
          phone: string | null
          photo_url: string | null
          role_title: string | null
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_id: string
          full_name: string
          id?: string
          is_public?: boolean
          kind?: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_id?: string
          full_name?: string
          id?: string
          is_public?: boolean
          kind?: string
          notes?: string | null
          organisation?: string | null
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_people_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_programs: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_programs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attended: boolean
          attended_at: string | null
          event_id: string
          id: string
          paid: boolean
          paid_at: string | null
          participant_id: string
          program_id: string | null
          registered_at: string
          status: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          attended_at?: string | null
          event_id: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          participant_id?: string
          program_id?: string | null
          registered_at?: string
          status?: string
          user_id: string
        }
        Update: {
          attended?: boolean
          attended_at?: string | null
          event_id?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          participant_id?: string
          program_id?: string | null
          registered_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "event_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      event_teams: {
        Row: {
          captain_id: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          looking_for_members: boolean
          max_members: number
          name: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          looking_for_members?: boolean
          max_members?: number
          name: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          looking_for_members?: boolean
          max_members?: number
          name?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_mode: string
          event_type: Database["public"]["Enums"]["event_type"]
          faqs: Json
          id: string
          image_url: string | null
          is_virtual: boolean | null
          judges: Json
          judging_ends_at: string | null
          judging_starts_at: string | null
          location: string | null
          max_participants: number | null
          og_image_url: string | null
          online_url: string | null
          overview: string | null
          payment_instructions: Json
          prizes: Json
          registration_deadline: string | null
          registration_fee: number | null
          registration_open: boolean
          results_at: string | null
          rules: Json
          schedule: Json
          slug: string
          sponsors: Json
          start_date: string | null
          status: Database["public"]["Enums"]["event_status"]
          submission_deadline: string | null
          submission_opens_at: string | null
          tags: string[] | null
          theme: string | null
          timeline: Json
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_mode?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          faqs?: Json
          id?: string
          image_url?: string | null
          is_virtual?: boolean | null
          judges?: Json
          judging_ends_at?: string | null
          judging_starts_at?: string | null
          location?: string | null
          max_participants?: number | null
          og_image_url?: string | null
          online_url?: string | null
          overview?: string | null
          payment_instructions?: Json
          prizes?: Json
          registration_deadline?: string | null
          registration_fee?: number | null
          registration_open?: boolean
          results_at?: string | null
          rules?: Json
          schedule?: Json
          slug: string
          sponsors?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          submission_deadline?: string | null
          submission_opens_at?: string | null
          tags?: string[] | null
          theme?: string | null
          timeline?: Json
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_mode?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          faqs?: Json
          id?: string
          image_url?: string | null
          is_virtual?: boolean | null
          judges?: Json
          judging_ends_at?: string | null
          judging_starts_at?: string | null
          location?: string | null
          max_participants?: number | null
          og_image_url?: string | null
          online_url?: string | null
          overview?: string | null
          payment_instructions?: Json
          prizes?: Json
          registration_deadline?: string | null
          registration_fee?: number | null
          registration_open?: boolean
          results_at?: string | null
          rules?: Json
          schedule?: Json
          slug?: string
          sponsors?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          submission_deadline?: string | null
          submission_opens_at?: string | null
          tags?: string[] | null
          theme?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      forum_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          category_id: string
          content: string
          created_at: string
          id: string
          last_activity_at: string
          locked: boolean
          pinned: boolean
          reply_count: number
          title: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          id?: string
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          title: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          reply_count?: number
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_votes: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          event_id: string
          id: string
          name: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          event_id: string
          id?: string
          name?: string | null
          revoked_at?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          event_id?: string
          id?: string
          name?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      judging_criteria: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          max_score: number
          name: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          max_score?: number
          name: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          max_score?: number
          name?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "judging_criteria_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          mentor_id: string
          slot_duration_minutes: number
          start_time: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          mentor_id: string
          slot_duration_minutes?: number
          start_time: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          mentor_id?: string
          slot_duration_minutes?: number
          start_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      mentor_bookings: {
        Row: {
          cancelled_by: string | null
          cancelled_reason: string | null
          created_at: string
          end_at: string
          id: string
          meeting_url: string | null
          mentee_id: string
          mentor_id: string
          notes: string | null
          start_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_by?: string | null
          cancelled_reason?: string | null
          created_at?: string
          end_at: string
          id?: string
          meeting_url?: string | null
          mentee_id: string
          mentor_id: string
          notes?: string | null
          start_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_by?: string | null
          cancelled_reason?: string | null
          created_at?: string
          end_at?: string
          id?: string
          meeting_url?: string | null
          mentee_id?: string
          mentor_id?: string
          notes?: string | null
          start_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentor_profiles: {
        Row: {
          availability: string | null
          bio: string | null
          created_at: string
          expertise: string[]
          hourly_rate: number | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          expertise?: string[]
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string | null
          bio?: string | null
          created_at?: string
          expertise?: string[]
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          mentor_id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          mentor_id: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          mentor_id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentorship_requests: {
        Row: {
          created_at: string
          id: string
          mentee_id: string
          mentor_id: string
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentee_id: string
          mentor_id: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentee_id?: string
          mentor_id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_edits: {
        Row: {
          action: string
          actor_id: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          new_content: string | null
          previous_content: string | null
        }
        Insert: {
          action: string
          actor_id: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          new_content?: string | null
          previous_content?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          new_content?: string | null
          previous_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_edits_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_edits_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          performed_by: string
          subscriber_email: string | null
          subscriber_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by: string
          subscriber_email?: string | null
          subscriber_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          subscriber_email?: string | null
          subscriber_id?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          source: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      points_log: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          ref_id: string | null
          ref_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          portfolio_url: string | null
          skills: string[] | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          portfolio_url?: string | null
          skills?: string[] | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_score_items: {
        Row: {
          created_at: string
          criterion_id: string
          id: string
          judge_id: string
          notes: string | null
          project_id: string
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          id?: string
          judge_id: string
          notes?: string | null
          project_id: string
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          id?: string
          judge_id?: string
          notes?: string | null
          project_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_score_items_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "judging_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_score_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_votes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_votes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_notes: string | null
          cover_image_url: string | null
          created_at: string
          demo_url: string | null
          description: string
          event_id: string | null
          id: string
          registration_id: string | null
          repo_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          submitted_at: string | null
          team_id: string | null
          tech_tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          cover_image_url?: string | null
          created_at?: string
          demo_url?: string | null
          description: string
          event_id?: string | null
          id?: string
          registration_id?: string | null
          repo_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          submitted_at?: string | null
          team_id?: string | null
          tech_tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          cover_image_url?: string | null
          created_at?: string
          demo_url?: string | null
          description?: string
          event_id?: string | null
          id?: string
          registration_id?: string | null
          repo_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          submitted_at?: string | null
          team_id?: string | null
          tech_tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "team_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      registration_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["registration_status"] | null
          id: string
          metadata: Json
          note: string | null
          registration_id: string
          to_status: Database["public"]["Enums"]["registration_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          id?: string
          metadata?: Json
          note?: string | null
          registration_id: string
          to_status?: Database["public"]["Enums"]["registration_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          id?: string
          metadata?: Json
          note?: string | null
          registration_id?: string
          to_status?: Database["public"]["Enums"]["registration_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "team_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_participants: {
        Row: {
          class_level: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_leader: boolean
          phone: string | null
          registration_id: string
          role: Database["public"]["Enums"]["participant_role"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          class_level?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_leader?: boolean
          phone?: string | null
          registration_id: string
          role?: Database["public"]["Enums"]["participant_role"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          class_level?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_leader?: boolean
          phone?: string | null
          registration_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "team_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          notes: string | null
          payer_name: string | null
          payer_phone: string | null
          proof_url: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_verification_status"]
          transaction_reference: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          proof_url?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_verification_status"]
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          proof_url?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_verification_status"]
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "team_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          about_hero_tagline: string | null
          about_mission: string | null
          about_stats: Json
          about_story: string | null
          about_vision: string | null
          auto_issue_certificates: boolean
          contact_email: string | null
          contact_phone: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          office_address: string | null
          twitter_url: string | null
          updated_at: string
          updated_by: string | null
          weekly_digest_enabled: boolean
          youtube_url: string | null
        }
        Insert: {
          about_hero_tagline?: string | null
          about_mission?: string | null
          about_stats?: Json
          about_story?: string | null
          about_vision?: string | null
          auto_issue_certificates?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          office_address?: string | null
          twitter_url?: string | null
          updated_at?: string
          updated_by?: string | null
          weekly_digest_enabled?: boolean
          youtube_url?: string | null
        }
        Update: {
          about_hero_tagline?: string | null
          about_mission?: string | null
          about_stats?: Json
          about_story?: string | null
          about_vision?: string | null
          auto_issue_certificates?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          office_address?: string | null
          twitter_url?: string | null
          updated_at?: string
          updated_by?: string | null
          weekly_digest_enabled?: boolean
          youtube_url?: string | null
        }
        Relationships: []
      }
      sponsor_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          project_id: string
          reviewer_id: string
          sponsorship_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          project_id: string
          reviewer_id: string
          sponsorship_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          project_id?: string
          reviewer_id?: string
          sponsorship_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_reviews_sponsorship_id_fkey"
            columns: ["sponsorship_id"]
            isOneToOne: false
            referencedRelation: "sponsorships"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorships: {
        Row: {
          amount: number
          can_review: boolean
          contact_email: string | null
          contact_name: string | null
          created_at: string
          currency: string
          event_id: string
          id: string
          logo_url: string | null
          notes: string | null
          sponsor_name: string
          sponsor_user_id: string | null
          status: string
          tier: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          amount?: number
          can_review?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          logo_url?: string | null
          notes?: string | null
          sponsor_name: string
          sponsor_user_id?: string | null
          status?: string
          tier?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          amount?: number
          can_review?: boolean
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          logo_url?: string | null
          notes?: string | null
          sponsor_name?: string
          sponsor_user_id?: string | null
          status?: string
          tier?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorships_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_registrations: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          current_step: number
          declaration_accepted: boolean
          event_id: string
          fee_amount: number | null
          fee_tier_id: string | null
          fee_tier_label: string | null
          id: string
          institution_address: string | null
          institution_name: string | null
          institution_region: string | null
          institution_town: string | null
          institution_type: string | null
          notes: string | null
          reference: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          submitted_at: string | null
          team_code: string | null
          team_name: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          current_step?: number
          declaration_accepted?: boolean
          event_id: string
          fee_amount?: number | null
          fee_tier_id?: string | null
          fee_tier_label?: string | null
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          institution_region?: string | null
          institution_town?: string | null
          institution_type?: string | null
          notes?: string | null
          reference?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submitted_at?: string | null
          team_code?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          current_step?: number
          declaration_accepted?: boolean
          event_id?: string
          fee_amount?: number | null
          fee_tier_id?: string | null
          fee_tier_label?: string | null
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          institution_region?: string | null
          institution_town?: string | null
          institution_type?: string | null
          notes?: string | null
          reference?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submitted_at?: string | null
          team_code?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_registrations_fee_tier_id_fkey"
            columns: ["fee_tier_id"]
            isOneToOne: false
            referencedRelation: "category_fee_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
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
      about_team_members_public: {
        Row: {
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          initials: string | null
          linkedin_url: string | null
          photo_url: string | null
          role: string | null
          sort_order: number | null
          twitter_url: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          initials?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          role?: string | null
          sort_order?: number | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          initials?: string | null
          linkedin_url?: string | null
          photo_url?: string | null
          role?: string | null
          sort_order?: number | null
          twitter_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_comments_public: {
        Row: {
          author_name: string | null
          content: string | null
          created_at: string | null
          id: string | null
          parent_id: string | null
          post_id: string | null
          status: Database["public"]["Enums"]["comment_status"] | null
        }
        Insert: {
          author_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: string | null
          parent_id?: string | null
          post_id?: string | null
          status?: Database["public"]["Enums"]["comment_status"] | null
        }
        Update: {
          author_name?: string | null
          content?: string | null
          created_at?: string | null
          id?: string | null
          parent_id?: string | null
          post_id?: string | null
          status?: Database["public"]["Enums"]["comment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_judge_invitation: { Args: { _token: string }; Returns: Json }
      admin_run_publish_due: { Args: never; Returns: number }
      certificate_reissue_history: {
        Args: { _certificate_number: string }
        Returns: {
          created_at: string
          new_number: string
          previous_number: string
          reason: string
        }[]
      }
      count_user_cancellations: {
        Args: { _since: string; _user_id: string }
        Returns: number
      }
      delete_user_data: { Args: { _user_id: string }; Returns: undefined }
      get_about_stats: { Args: never; Returns: Json }
      get_event_feedback_summary: {
        Args: { _event_id: string }
        Returns: {
          avg_rating: number
          five_count: number
          four_count: number
          one_count: number
          recommend_count: number
          response_count: number
          three_count: number
          two_count: number
        }[]
      }
      get_judge_invitation: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          event_id: string
          event_slug: string
          event_title: string
          id: string
          name: string
          revoked_at: string
        }[]
      }
      get_leaderboard: {
        Args: { limit_n?: number }
        Returns: {
          avatar_url: string
          badge_count: number
          full_name: string
          total_points: number
          user_id: string
        }[]
      }
      get_mentor_busy: {
        Args: { _from: string; _mentor_id: string; _to: string }
        Returns: {
          end_at: string
          start_at: string
        }[]
      }
      get_mentor_ratings: {
        Args: { _mentor_ids: string[] }
        Returns: {
          avg_rating: number
          mentor_id: string
          review_count: number
        }[]
      }
      get_mentor_reviews_public: {
        Args: { _mentor_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          is_mine: boolean
          rating: number
        }[]
      }
      get_project_vote_counts: {
        Args: { _project_ids?: string[] }
        Returns: {
          project_id: string
          vote_count: number
        }[]
      }
      get_public_event_results: {
        Args: { _event_id: string }
        Returns: {
          cover_image_url: string
          demo_url: string
          description: string
          judge_count: number
          project_id: string
          rank: number
          title: string
          total_score: number
        }[]
      }
      get_public_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          github_url: string | null
          linkedin_url: string | null
          portfolio_url: string | null
          skills: string[] | null
          university: string | null
          user_id: string
        }[]
      }
      get_registration_stats: { Args: { _event_id?: string }; Returns: Json }
      get_thread_vote_count: { Args: { _thread_id: string }; Returns: number }
      get_weekly_leaderboard: {
        Args: { limit_n?: number }
        Returns: {
          avatar_url: string
          full_name: string
          total_points: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_thread_view: {
        Args: { _thread_id: string }
        Returns: undefined
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_sponsor: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_mentor_slot_free: {
        Args: {
          _end: string
          _exclude_booking?: string
          _mentor_id: string
          _start: string
        }
        Returns: boolean
      }
      issue_certificate: {
        Args: {
          _description?: string
          _event_id: string
          _program_type?: string
          _recipient_name: string
          _signatories?: Json
          _user_id: string
        }
        Returns: {
          certificate_number: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          issued_at: string
          program_type: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signatories: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      issue_certificates_for_event: {
        Args: { _event_id: string; _program_id?: string | null }
        Returns: number
      }
      issue_team_certificates: { Args: { _event_id: string }; Returns: number }
      log_admin_action: {
        Args: {
          _action: string
          _metadata?: Json
          _resource_id?: string
          _resource_label?: string
          _resource_type: string
        }
        Returns: string
      }
      mark_attendance_and_issue: {
        Args: {
          _description?: string
          _issue_certificate?: boolean
          _program_type?: string
          _registration_id: string
        }
        Returns: Json
      }
      owns_registration: {
        Args: { _registration_id: string; _user_id: string }
        Returns: boolean
      }
      publish_due_scheduled_posts: { Args: never; Returns: number }
      record_auth_event: {
        Args: { _event_type: string; _metadata?: Json }
        Returns: string
      }
      reissue_certificate: {
        Args: { _id: string; _reason?: string; _recipient_name?: string }
        Returns: {
          certificate_number: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          issued_at: string
          program_type: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signatories: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_certificate_share: {
        Args: { _token: string }
        Returns: {
          certificate_number: string
          event_title: string
          expired: boolean
          issued_at: string
          recipient_name: string
        }[]
      }
      resolve_content_report: {
        Args: {
          _id: string
          _notes?: string
          _status: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          content_id: string
          content_type: Database["public"]["Enums"]["report_content_type"]
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "content_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_team_registration: {
        Args: {
          _id: string
          _notes?: string
          _status: Database["public"]["Enums"]["registration_status"]
        }
        Returns: {
          category_id: string | null
          created_at: string
          created_by: string
          currency: string
          current_step: number
          declaration_accepted: boolean
          event_id: string
          fee_amount: number | null
          fee_tier_id: string | null
          fee_tier_label: string | null
          id: string
          institution_address: string | null
          institution_name: string | null
          institution_region: string | null
          institution_town: string | null
          institution_type: string | null
          notes: string | null
          reference: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          submitted_at: string | null
          team_code: string | null
          team_name: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "team_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_certificate: {
        Args: { _id: string; _reason?: string }
        Returns: {
          certificate_number: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          issued_at: string
          program_type: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signatories: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_certificates: {
        Args: { _limit?: number; _q: string }
        Returns: {
          certificate_number: string
          issued_at: string
          recipient_name: string
          revoked: boolean
        }[]
      }
      send_event_announcement: {
        Args: {
          _body: string
          _category_id?: string
          _event_id: string
          _statuses?: Database["public"]["Enums"]["registration_status"][]
          _title: string
        }
        Returns: number
      }
      sponsor_list_teams: {
        Args: { _event_id: string }
        Returns: {
          category_name: string
          demo_url: string
          institution_name: string
          member_count: number
          my_decision: string
          project_description: string
          project_id: string
          project_status: Database["public"]["Enums"]["project_status"]
          project_title: string
          registration_id: string
          repo_url: string
          status: Database["public"]["Enums"]["registration_status"]
          submitted_at: string
          team_code: string
          team_name: string
        }[]
      }
      sponsor_review_project: {
        Args: { _decision: string; _notes: string; _project_id: string }
        Returns: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          project_id: string
          reviewer_id: string
          sponsorship_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sponsor_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_project_for_review: {
        Args: { _project_id: string }
        Returns: {
          admin_notes: string | null
          cover_image_url: string | null
          created_at: string
          demo_url: string | null
          description: string
          event_id: string | null
          id: string
          registration_id: string | null
          repo_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          submitted_at: string | null
          team_id: string | null
          tech_tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unrevoke_certificate: {
        Args: { _id: string }
        Returns: {
          certificate_number: string
          created_at: string
          description: string | null
          event_id: string
          id: string
          issued_at: string
          program_type: string | null
          recipient_name: string
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          signatories: Json
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unsubscribe_newsletter: { Args: { _token: string }; Returns: string }
      verify_certificate: {
        Args: { _certificate_number: string }
        Returns: {
          certificate_number: string
          description: string
          event_title: string
          issued_at: string
          program_type: string
          recipient_name: string
          revoked_at: string
          revoked_reason: string
          signatories: Json
        }[]
      }
      verify_registration_payment: {
        Args: {
          _notes?: string
          _payment_id: string
          _status: Database["public"]["Enums"]["payment_verification_status"]
        }
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          notes: string | null
          payer_name: string | null
          payer_phone: string | null
          proof_url: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_verification_status"]
          transaction_reference: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "registration_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      blog_status: "draft" | "published" | "archived" | "scheduled"
      comment_status: "pending" | "approved" | "spam" | "rejected"
      event_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
      event_type:
        | "hackathon"
        | "bootcamp"
        | "workshop"
        | "webinar"
        | "conference"
        | "meetup"
      participant_role: "leader" | "member" | "teacher_mentor" | "coach"
      payment_verification_status:
        | "unpaid"
        | "pending"
        | "verified"
        | "rejected"
      project_status: "pending" | "approved" | "rejected"
      registration_status:
        | "draft"
        | "submitted"
        | "payment_pending"
        | "payment_verification"
        | "approved"
        | "rejected"
        | "withdrawn"
      report_content_type:
        | "forum_thread"
        | "forum_reply"
        | "blog_comment"
        | "project"
      report_status: "pending" | "resolved" | "dismissed"
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
      app_role: ["admin", "moderator", "user"],
      blog_status: ["draft", "published", "archived", "scheduled"],
      comment_status: ["pending", "approved", "spam", "rejected"],
      event_status: ["draft", "published", "ongoing", "completed", "cancelled"],
      event_type: [
        "hackathon",
        "bootcamp",
        "workshop",
        "webinar",
        "conference",
        "meetup",
      ],
      participant_role: ["leader", "member", "teacher_mentor", "coach"],
      payment_verification_status: [
        "unpaid",
        "pending",
        "verified",
        "rejected",
      ],
      project_status: ["pending", "approved", "rejected"],
      registration_status: [
        "draft",
        "submitted",
        "payment_pending",
        "payment_verification",
        "approved",
        "rejected",
        "withdrawn",
      ],
      report_content_type: [
        "forum_thread",
        "forum_reply",
        "blog_comment",
        "project",
      ],
      report_status: ["pending", "resolved", "dismissed"],
    },
  },
} as const
