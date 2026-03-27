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
      flight_tracking: {
        Row: {
          airline: string | null
          arrival_airport: string | null
          arrival_time: string | null
          created_at: string
          delay_minutes: number | null
          departure_airport: string | null
          departure_time: string | null
          flight_number: string
          gate: string | null
          id: string
          raw_data: Json | null
          status: string | null
          terminal: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          created_at?: string
          delay_minutes?: number | null
          departure_airport?: string | null
          departure_time?: string | null
          flight_number: string
          gate?: string | null
          id?: string
          raw_data?: Json | null
          status?: string | null
          terminal?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          created_at?: string
          delay_minutes?: number | null
          departure_airport?: string | null
          departure_time?: string | null
          flight_number?: string
          gate?: string | null
          id?: string
          raw_data?: Json | null
          status?: string | null
          terminal?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_tracking_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          cancellation_deadline: string | null
          category: Database["public"]["Enums"]["itinerary_category"]
          confirmation_code: string | null
          cost: number | null
          created_at: string
          currency: string
          date: string | null
          description: string | null
          end_time: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          metadata: Json | null
          points_used: number | null
          sort_order: number
          source_reference: string | null
          start_time: string | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          cancellation_deadline?: string | null
          category: Database["public"]["Enums"]["itinerary_category"]
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          currency?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          metadata?: Json | null
          points_used?: number | null
          sort_order?: number
          source_reference?: string | null
          start_time?: string | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          cancellation_deadline?: string | null
          category?: Database["public"]["Enums"]["itinerary_category"]
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          currency?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          metadata?: Json | null
          points_used?: number | null
          sort_order?: number
          source_reference?: string | null
          start_time?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_cards: Json | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          loyalty_memberships: Json | null
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_cards?: Json | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          loyalty_memberships?: Json | null
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_cards?: Json | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          loyalty_memberships?: Json | null
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tml_core_tenets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          tenet_key: string
          tenet_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          tenet_key: string
          tenet_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          tenet_key?: string
          tenet_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      trip_access_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          owner_user_id: string
          requester_user_id: string
          status: Database["public"]["Enums"]["access_request_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          owner_user_id: string
          requester_user_id: string
          status?: Database["public"]["Enums"]["access_request_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          owner_user_id?: string
          requester_user_id?: string
          status?: Database["public"]["Enums"]["access_request_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_access_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          destination: string | null
          end_date: string | null
          id: string
          is_published: boolean
          name: string
          start_date: string | null
          target_nightly_budget: number | null
          total_trip_budget: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          name: string
          start_date?: string | null
          target_nightly_budget?: number | null
          total_trip_budget?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          is_published?: boolean
          name?: string
          start_date?: string | null
          target_nightly_budget?: number | null
          total_trip_budget?: number | null
          updated_at?: string
          user_id?: string
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
      itinerary_items_public: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          category: Database["public"]["Enums"]["itinerary_category"] | null
          created_at: string | null
          date: string | null
          description: string | null
          end_time: string | null
          id: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          metadata: Json | null
          points_used: number | null
          sort_order: number | null
          source_reference: string | null
          start_time: string | null
          title: string | null
          trip_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          category?: Database["public"]["Enums"]["itinerary_category"] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          metadata?: Json | null
          points_used?: number | null
          sort_order?: number | null
          source_reference?: string | null
          start_time?: string | null
          title?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          category?: Database["public"]["Enums"]["itinerary_category"] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          metadata?: Json | null
          points_used?: number | null
          sort_order?: number | null
          source_reference?: string | null
          start_time?: string | null
          title?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
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
      access_request_status: "pending" | "approved" | "denied"
      app_role: "admin" | "user"
      approval_status: "draft" | "confirmed" | "cancelled"
      itinerary_category:
        | "stays"
        | "logistics"
        | "dining"
        | "agenda"
        | "activity"
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
      access_request_status: ["pending", "approved", "denied"],
      app_role: ["admin", "user"],
      approval_status: ["draft", "confirmed", "cancelled"],
      itinerary_category: [
        "stays",
        "logistics",
        "dining",
        "agenda",
        "activity",
      ],
    },
  },
} as const
