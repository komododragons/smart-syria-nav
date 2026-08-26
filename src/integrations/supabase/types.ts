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
          delivery_allowed: boolean
          display_name: string
          geo: unknown
          id: string
          instructions_ar: string | null
          instructions_en: string | null
          is_active: boolean
          is_delivery_entrance: boolean
          is_emergency_entrance: boolean
          is_loading_entrance: boolean
          is_parking_entrance: boolean
          is_pedestrian_entrance: boolean
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          name_ar: string | null
          name_en: string | null
          node_id: string
          opens_at: string | null
          photo_url: string | null
          sort_order: number
          status_reason: string | null
          temporarily_closed: boolean
          temporary_status: string | null
          updated_at: string
          vehicle_access: boolean
          verification_level: string
          wheelchair_accessible: boolean
        }
        Insert: {
          access_type?: string
          accessibility?: string[]
          always_open?: boolean
          closes_at?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          delivery_allowed?: boolean
          display_name: string
          geo?: unknown
          id?: string
          instructions_ar?: string | null
          instructions_en?: string | null
          is_active?: boolean
          is_delivery_entrance?: boolean
          is_emergency_entrance?: boolean
          is_loading_entrance?: boolean
          is_parking_entrance?: boolean
          is_pedestrian_entrance?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          node_id: string
          opens_at?: string | null
          photo_url?: string | null
          sort_order?: number
          status_reason?: string | null
          temporarily_closed?: boolean
          temporary_status?: string | null
          updated_at?: string
          vehicle_access?: boolean
          verification_level?: string
          wheelchair_accessible?: boolean
        }
        Update: {
          access_type?: string
          accessibility?: string[]
          always_open?: boolean
          closes_at?: string | null
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          delivery_allowed?: boolean
          display_name?: string
          geo?: unknown
          id?: string
          instructions_ar?: string | null
          instructions_en?: string | null
          is_active?: boolean
          is_delivery_entrance?: boolean
          is_emergency_entrance?: boolean
          is_loading_entrance?: boolean
          is_parking_entrance?: boolean
          is_pedestrian_entrance?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string | null
          name_en?: string | null
          node_id?: string
          opens_at?: string | null
          photo_url?: string | null
          sort_order?: number
          status_reason?: string | null
          temporarily_closed?: boolean
          temporary_status?: string | null
          updated_at?: string
          vehicle_access?: boolean
          verification_level?: string
          wheelchair_accessible?: boolean
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
      courier_route_stops: {
        Row: {
          access_point_id: string | null
          created_at: string
          eta_seconds: number | null
          id: string
          label: string | null
          latitude: number
          locked: boolean
          longitude: number
          node_id: string | null
          optimized_position: number | null
          position: number
          priority: number
          route_id: string
          service_time_s: number
          smart_code: string | null
          unreachable: boolean
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          access_point_id?: string | null
          created_at?: string
          eta_seconds?: number | null
          id?: string
          label?: string | null
          latitude: number
          locked?: boolean
          longitude: number
          node_id?: string | null
          optimized_position?: number | null
          position?: number
          priority?: number
          route_id: string
          service_time_s?: number
          smart_code?: string | null
          unreachable?: boolean
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          access_point_id?: string | null
          created_at?: string
          eta_seconds?: number | null
          id?: string
          label?: string | null
          latitude?: number
          locked?: boolean
          longitude?: number
          node_id?: string | null
          optimized_position?: number | null
          position?: number
          priority?: number
          route_id?: string
          service_time_s?: number
          smart_code?: string | null
          unreachable?: boolean
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_route_stops_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_route_stops_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "courier_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_routes: {
        Row: {
          created_at: string
          end_latitude: number | null
          end_longitude: number | null
          geometry: string | null
          id: string
          name: string
          optimized_at: string | null
          owner_id: string
          start_latitude: number | null
          start_longitude: number | null
          status: string
          total_distance_m: number | null
          total_duration_s: number | null
          updated_at: string
          vehicle_type: string
          warnings: string[]
        }
        Insert: {
          created_at?: string
          end_latitude?: number | null
          end_longitude?: number | null
          geometry?: string | null
          id?: string
          name?: string
          optimized_at?: string | null
          owner_id: string
          start_latitude?: number | null
          start_longitude?: number | null
          status?: string
          total_distance_m?: number | null
          total_duration_s?: number | null
          updated_at?: string
          vehicle_type?: string
          warnings?: string[]
        }
        Update: {
          created_at?: string
          end_latitude?: number | null
          end_longitude?: number | null
          geometry?: string | null
          id?: string
          name?: string
          optimized_at?: string | null
          owner_id?: string
          start_latitude?: number | null
          start_longitude?: number | null
          status?: string
          total_distance_m?: number | null
          total_duration_s?: number | null
          updated_at?: string
          vehicle_type?: string
          warnings?: string[]
        }
        Relationships: []
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
      last_metre_instructions: {
        Row: {
          access_point_id: string | null
          accessibility_notes: string | null
          call_on_arrival: boolean
          created_at: string
          created_by: string | null
          delivery_notes: string | null
          door_description: string | null
          elevator_available: boolean | null
          floor: string | null
          id: string
          instruction_text: string | null
          intercom_name: string | null
          landmark_description: string | null
          language: string
          node_id: string
          photo_urls: string[]
          stairs_required: boolean | null
          unit_number: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          access_point_id?: string | null
          accessibility_notes?: string | null
          call_on_arrival?: boolean
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          door_description?: string | null
          elevator_available?: boolean | null
          floor?: string | null
          id?: string
          instruction_text?: string | null
          intercom_name?: string | null
          landmark_description?: string | null
          language?: string
          node_id: string
          photo_urls?: string[]
          stairs_required?: boolean | null
          unit_number?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          access_point_id?: string | null
          accessibility_notes?: string | null
          call_on_arrival?: boolean
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          door_description?: string | null
          elevator_available?: boolean | null
          floor?: string | null
          id?: string
          instruction_text?: string | null
          intercom_name?: string | null
          landmark_description?: string | null
          language?: string
          node_id?: string
          photo_urls?: string[]
          stairs_required?: boolean | null
          unit_number?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "last_metre_instructions_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "last_metre_instructions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
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
          geo: unknown
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
          geo?: unknown
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
          geo?: unknown
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
      navigation_events: {
        Row: {
          city: string | null
          created_at: string
          destination_kind: string | null
          duration_ms: number | null
          event: string
          id: string
          origin_method: string | null
          provider: string | null
          smart_code: string | null
          success: boolean | null
          travel_mode: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          destination_kind?: string | null
          duration_ms?: number | null
          event: string
          id?: string
          origin_method?: string | null
          provider?: string | null
          smart_code?: string | null
          success?: boolean | null
          travel_mode?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          destination_kind?: string | null
          duration_ms?: number | null
          event?: string
          id?: string
          origin_method?: string | null
          provider?: string | null
          smart_code?: string | null
          success?: boolean | null
          travel_mode?: string | null
        }
        Relationships: []
      }
      navigation_provider_health: {
        Row: {
          created_at: string
          healthy: boolean
          id: string
          latency_ms: number | null
          message: string | null
          provider: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          healthy: boolean
          id?: string
          latency_ms?: number | null
          message?: string | null
          provider: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          healthy?: boolean
          id?: string
          latency_ms?: number | null
          message?: string | null
          provider?: string
          status_code?: number | null
        }
        Relationships: []
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
      road_access_points: {
        Row: {
          access_point_id: string | null
          access_type: string
          approach_direction: string | null
          created_at: string
          created_by: string | null
          geo: unknown
          id: string
          latitude: number
          longitude: number
          node_id: string
          notes_ar: string | null
          notes_en: string | null
          parking_available: boolean
          road_name: string | null
          stopping_allowed: boolean
          updated_at: string
          vehicle_types: string[]
          verification_status: string
        }
        Insert: {
          access_point_id?: string | null
          access_type?: string
          approach_direction?: string | null
          created_at?: string
          created_by?: string | null
          geo?: unknown
          id?: string
          latitude: number
          longitude: number
          node_id: string
          notes_ar?: string | null
          notes_en?: string | null
          parking_available?: boolean
          road_name?: string | null
          stopping_allowed?: boolean
          updated_at?: string
          vehicle_types?: string[]
          verification_status?: string
        }
        Update: {
          access_point_id?: string | null
          access_type?: string
          approach_direction?: string | null
          created_at?: string
          created_by?: string | null
          geo?: unknown
          id?: string
          latitude?: number
          longitude?: number
          node_id?: string
          notes_ar?: string | null
          notes_en?: string | null
          parking_available?: boolean
          road_name?: string | null
          stopping_allowed?: boolean
          updated_at?: string
          vehicle_types?: string[]
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "road_access_points_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "road_access_points_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_reports: {
        Row: {
          access_point_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          node_id: string | null
          photo_urls: string[]
          reporter_id: string | null
          resolved_at: string | null
          review_notes: string | null
          reviewer_id: string | null
          route_id: string | null
          smart_address_id: string | null
          status: string
        }
        Insert: {
          access_point_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          node_id?: string | null
          photo_urls?: string[]
          reporter_id?: string | null
          resolved_at?: string | null
          review_notes?: string | null
          reviewer_id?: string | null
          route_id?: string | null
          smart_address_id?: string | null
          status?: string
        }
        Update: {
          access_point_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          node_id?: string | null
          photo_urls?: string[]
          reporter_id?: string | null
          resolved_at?: string | null
          review_notes?: string | null
          reviewer_id?: string | null
          route_id?: string | null
          smart_address_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_reports_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_reports_smart_address_id_fkey"
            columns: ["smart_address_id"]
            isOneToOne: false
            referencedRelation: "smart_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      route_share_access: {
        Row: {
          accessed_at: string
          id: string
          outcome: string
          share_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          outcome?: string
          share_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          outcome?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_share_access_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "route_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      route_shares: {
        Row: {
          access_count: number
          access_point_id: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          include_last_metre: boolean
          node_id: string | null
          one_time: boolean
          revoked: boolean
          share_type: string
          smart_address_id: string | null
          token: string
          travel_mode: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          access_point_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          include_last_metre?: boolean
          node_id?: string | null
          one_time?: boolean
          revoked?: boolean
          share_type?: string
          smart_address_id?: string | null
          token: string
          travel_mode?: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          access_point_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          include_last_metre?: boolean
          node_id?: string | null
          one_time?: boolean
          revoked?: boolean
          share_type?: string
          smart_address_id?: string | null
          token?: string
          travel_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_shares_access_point_id_fkey"
            columns: ["access_point_id"]
            isOneToOne: false
            referencedRelation: "access_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_shares_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_shares_smart_address_id_fkey"
            columns: ["smart_address_id"]
            isOneToOne: false
            referencedRelation: "smart_addresses"
            referencedColumns: ["id"]
          },
        ]
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      nodes_near: {
        Args: {
          _lat: number
          _limit?: number
          _lng: number
          _radius_m?: number
        }
        Returns: {
          city: string
          display_name: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          neighborhood: string
        }[]
      }
      normalize_arabic: { Args: { _t: string }; Returns: string }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      record_verification: {
        Args: {
          _access_point_id: string
          _level: string
          _method: string
          _node_id: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
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
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
