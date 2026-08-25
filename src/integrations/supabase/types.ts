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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      access_point_purposes: {
        Row: {
          access_point_id: string
          allowed: boolean
          id: string
          note: string | null
          purpose: string
        }
        Insert: {
          access_point_id: string
          allowed?: boolean
          id?: string
          note?: string | null
          purpose: string
        }
        Update: {
          access_point_id?: string
          allowed?: boolean
          id?: string
          note?: string | null
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_point_purposes_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
        ]
      }
      access_points: {
        Row: {
          access_type: string
          accessibility: string[]
          always_open: boolean
          closes_at: string | null
          confidence_score: number
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          instructions_ar: string | null
          instructions_en: string | null
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name_ar: string | null
          name_en: string | null
          node_id: string
          opens_at: string | null
          sort_order: number
          temporarily_closed: boolean
          updated_at: string
          verification_level: string
        }
        Insert: {
          access_type?: string
          accessibility?: string[]
          always_open?: boolean
          closes_at?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          instructions_ar?: string | null
          instructions_en?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          node_id: string
          opens_at?: string | null
          sort_order?: number
          temporarily_closed?: boolean
          updated_at?: string
          verification_level?: string
        }
        Update: {
          access_type?: string
          accessibility?: string[]
          always_open?: boolean
          closes_at?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          instructions_ar?: string | null
          instructions_en?: string | null
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          node_id?: string
          opens_at?: string | null
          sort_order?: number
          temporarily_closed?: boolean
          updated_at?: string
          verification_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_points_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      access_restrictions: {
        Row: {
          access_point_id: string
          created_at: string
          id: string
          note_ar: string | null
          restriction: string
        }
        Insert: {
          access_point_id: string
          created_at?: string
          id?: string
          note_ar?: string | null
          restriction: string
        }
        Update: {
          access_point_id?: string
          created_at?: string
          id?: string
          note_ar?: string | null
          restriction?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_restrictions_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clients: {
        Row: {
          created_at: string
          environment: string
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          rate_limit_per_minute: number
          scopes: string[]
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          rate_limit_per_minute?: number
          scopes?: string[]
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          rate_limit_per_minute?: number
          scopes?: string[]
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          client_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          revoked: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          revoked?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          revoked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          client_id: string | null
          created_at: string
          endpoint: string
          id: string
          status_code: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          status_code?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      business_claims: {
        Row: {
          business_id: string
          claimant_id: string
          created_at: string
          evidence: string | null
          id: string
          reviewed_by: string | null
          status: string
        }
        Insert: {
          business_id: string
          claimant_id: string
          created_at?: string
          evidence?: string | null
          id?: string
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          business_id?: string
          claimant_id?: string
          created_at?: string
          evidence?: string | null
          id?: string
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string | null
          created_at: string
          delivery_access_point_id: string | null
          id: string
          is_published: boolean
          logo_url: string | null
          name_ar: string
          name_en: string | null
          node_id: string | null
          opening_hours: string | null
          owner_id: string | null
          phone: string | null
          smart_address_id: string | null
          updated_at: string
          verification_level: string
          visitor_access_point_id: string | null
          website: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          delivery_access_point_id?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          node_id?: string | null
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          smart_address_id?: string | null
          updated_at?: string
          verification_level?: string
          visitor_access_point_id?: string | null
          website?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          delivery_access_point_id?: string | null
          id?: string
          is_published?: boolean
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          node_id?: string | null
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          smart_address_id?: string | null
          updated_at?: string
          verification_level?: string
          visitor_access_point_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_delivery_access_point_id_fkey"
            columns: ["delivery_access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_smart_address_id_fkey"
            columns: ["smart_address_id"]
            isOneToOne: false
            referencedRelation: "smart_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_visitor_access_point_id_fkey"
            columns: ["visitor_access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
        ]
      }
      confidence_events: {
        Row: {
          access_point_id: string | null
          created_at: string
          delta: number
          factor: string
          id: string
          node_id: string | null
        }
        Insert: {
          access_point_id?: string | null
          created_at?: string
          delta?: number
          factor: string
          id?: string
          node_id?: string | null
        }
        Update: {
          access_point_id?: string | null
          created_at?: string
          delta?: number
          factor?: string
          id?: string
          node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confidence_events_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confidence_events_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_reports: {
        Row: {
          access_point_id: string | null
          created_at: string
          details: string | null
          id: string
          issue_type: string
          node_id: string | null
          reporter_id: string | null
          reviewed_by: string | null
          smart_code: string | null
          status: string
        }
        Insert: {
          access_point_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          issue_type: string
          node_id?: string | null
          reporter_id?: string | null
          reviewed_by?: string | null
          smart_code?: string | null
          status?: string
        }
        Update: {
          access_point_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          issue_type?: string
          node_id?: string | null
          reporter_id?: string | null
          reviewed_by?: string | null
          smart_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_reports_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          created_at: string
          distance_meters: number | null
          id: string
          node_a: string
          node_b: string
          status: string
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          node_a: string
          node_b: string
          status?: string
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          id?: string
          node_a?: string
          node_b?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_node_a_fkey"
            columns: ["node_a"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_candidates_node_b_fkey"
            columns: ["node_b"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          label: string
          smart_address_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          smart_address_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          smart_address_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_smart_address_id_fkey"
            columns: ["smart_address_id"]
            isOneToOne: false
            referencedRelation: "smart_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      location_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          lang: string
          node_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          lang?: string
          node_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          lang?: string
          node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_aliases_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      location_nodes: {
        Row: {
          city: string | null
          confidence_score: number
          country_code: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          district: string | null
          floor_label: string | null
          floor_order: number | null
          floors_count: number | null
          governorate: string | null
          has_elevator: boolean | null
          id: string
          is_active: boolean
          landmark: string | null
          latitude: number | null
          lifecycle_status: string
          longitude: number | null
          name_ar: string | null
          name_en: string | null
          neighborhood: string | null
          node_type: string
          parent_id: string | null
          private_notes: string | null
          public_notes: string | null
          street: string | null
          unit_label: string | null
          updated_at: string
          verification_level: string
          visibility: string
        }
        Insert: {
          city?: string | null
          confidence_score?: number
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          district?: string | null
          floor_label?: string | null
          floor_order?: number | null
          floors_count?: number | null
          governorate?: string | null
          has_elevator?: boolean | null
          id?: string
          is_active?: boolean
          landmark?: string | null
          latitude?: number | null
          lifecycle_status?: string
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          neighborhood?: string | null
          node_type: string
          parent_id?: string | null
          private_notes?: string | null
          public_notes?: string | null
          street?: string | null
          unit_label?: string | null
          updated_at?: string
          verification_level?: string
          visibility?: string
        }
        Update: {
          city?: string | null
          confidence_score?: number
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          district?: string | null
          floor_label?: string | null
          floor_order?: number | null
          floors_count?: number | null
          governorate?: string | null
          has_elevator?: boolean | null
          id?: string
          is_active?: boolean
          landmark?: string | null
          latitude?: number | null
          lifecycle_status?: string
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          neighborhood?: string | null
          node_type?: string
          parent_id?: string | null
          private_notes?: string | null
          public_notes?: string | null
          street?: string | null
          unit_label?: string | null
          updated_at?: string
          verification_level?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      smart_address_redirects: {
        Row: {
          created_at: string
          id: string
          new_code: string
          old_code: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_code: string
          old_code: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_code?: string
          old_code?: string
          reason?: string | null
        }
        Relationships: []
      }
      smart_addresses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          default_access_point_id: string | null
          id: string
          is_public: boolean
          label: string | null
          node_id: string
          purpose_hint: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          default_access_point_id?: string | null
          id?: string
          is_public?: boolean
          label?: string | null
          node_id: string
          purpose_hint?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          default_access_point_id?: string | null
          id?: string
          is_public?: boolean
          label?: string | null
          node_id?: string
          purpose_hint?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_addresses_default_access_point_id_fkey"
            columns: ["default_access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_addresses_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_addresses: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number | null
          purpose: string
          revoked: boolean
          smart_address_id: string
          token: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses?: number | null
          purpose?: string
          revoked?: boolean
          smart_address_id: string
          token: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          purpose?: string
          revoked?: boolean
          smart_address_id?: string
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "temporary_addresses_smart_address_id_fkey"
            columns: ["smart_address_id"]
            isOneToOne: false
            referencedRelation: "smart_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verifications: {
        Row: {
          access_point_id: string | null
          actor_id: string | null
          created_at: string
          id: string
          level: string
          method: string | null
          node_id: string | null
        }
        Insert: {
          access_point_id?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          level: string
          method?: string | null
          node_id?: string | null
        }
        Update: {
          access_point_id?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          level?: string
          method?: string | null
          node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_feedback: {
        Row: {
          access_point_id: string | null
          created_at: string
          id: string
          notes: string | null
          purpose: string
          reporter_id: string | null
          smart_code: string
          successful: boolean
        }
        Insert: {
          access_point_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          purpose: string
          reporter_id?: string | null
          smart_code: string
          successful: boolean
        }
        Update: {
          access_point_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          purpose?: string
          reporter_id?: string | null
          smart_code?: string
          successful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "visit_feedback_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "user"
        | "business_owner"
        | "organization_manager"
        | "courier"
        | "verifier"
        | "moderator"
        | "admin"
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
    Enums: {
      app_role: [
        "user",
        "business_owner",
        "organization_manager",
        "courier",
        "verifier",
        "moderator",
        "admin",
      ],
    },
  },
} as const
