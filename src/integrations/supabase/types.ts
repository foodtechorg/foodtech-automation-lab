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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          actor_email: string
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          payload: Json | null
          request_id: string
        }
        Insert: {
          actor_email: string
          created_at?: string
          event_type: Database["public"]["Enums"]["event_type"]
          id?: string
          payload?: Json | null
          request_id: string
        }
        Update: {
          actor_email?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          payload?: Json | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          author_email: string
          code: string
          created_at: string
          customer_company: string
          customer_contact: string | null
          customer_feedback: string | null
          customer_result: Database["public"]["Enums"]["client_result"] | null
          date_sent_for_test: string | null
          description: string
          desired_due_date: string | null
          direction: Database["public"]["Enums"]["direction"]
          domain: Database["public"]["Enums"]["domain"]
          eta_first_stage: string | null
          final_product_name: string | null
          has_sample_analog: boolean
          id: string
          priority: Database["public"]["Enums"]["priority"]
          production_start_date: string | null
          rd_comment: string | null
          responsible_email: string | null
          status: Database["public"]["Enums"]["status"]
          updated_at: string
        }
        Insert: {
          author_email: string
          code: string
          created_at?: string
          customer_company: string
          customer_contact?: string | null
          customer_feedback?: string | null
          customer_result?: Database["public"]["Enums"]["client_result"] | null
          date_sent_for_test?: string | null
          description: string
          desired_due_date?: string | null
          direction: Database["public"]["Enums"]["direction"]
          domain: Database["public"]["Enums"]["domain"]
          eta_first_stage?: string | null
          final_product_name?: string | null
          has_sample_analog?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["priority"]
          production_start_date?: string | null
          rd_comment?: string | null
          responsible_email?: string | null
          status?: Database["public"]["Enums"]["status"]
          updated_at?: string
        }
        Update: {
          author_email?: string
          code?: string
          created_at?: string
          customer_company?: string
          customer_contact?: string | null
          customer_feedback?: string | null
          customer_result?: Database["public"]["Enums"]["client_result"] | null
          date_sent_for_test?: string | null
          description?: string
          desired_due_date?: string | null
          direction?: Database["public"]["Enums"]["direction"]
          domain?: Database["public"]["Enums"]["domain"]
          eta_first_stage?: string | null
          final_product_name?: string | null
          has_sample_analog?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["priority"]
          production_start_date?: string | null
          rd_comment?: string | null
          responsible_email?: string | null
          status?: Database["public"]["Enums"]["status"]
          updated_at?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          actor_email: string
          created_at: string
          feedback: string
          id: string
          is_final: boolean
          request_id: string
          result: Database["public"]["Enums"]["client_result"]
        }
        Insert: {
          actor_email: string
          created_at?: string
          feedback: string
          id?: string
          is_final?: boolean
          request_id: string
          result: Database["public"]["Enums"]["client_result"]
        }
        Update: {
          actor_email?: string
          created_at?: string
          feedback?: string
          id?: string
          is_final?: boolean
          request_id?: string
          result?: Database["public"]["Enums"]["client_result"]
        }
        Relationships: [
          {
            foreignKeyName: "test_results_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_request_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_request_event: {
        Args: {
          p_actor_email: string
          p_event_type: Database["public"]["Enums"]["event_type"]
          p_payload?: Json
          p_request_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "sales_manager" | "rd_dev" | "rd_manager" | "admin"
      client_result: "PRODUCTION" | "REWORK" | "DECLINE"
      direction: "FUNCTIONAL" | "FLAVOR" | "COLORANT" | "COMPLEX"
      domain:
        | "MEAT"
        | "CONFECTIONERY"
        | "DAIRY"
        | "BAKERY"
        | "FISH"
        | "FATS_OILS"
        | "ICE_CREAM"
        | "SEMI_FINISHED"
      event_type:
        | "CREATED"
        | "ASSIGNED"
        | "STATUS_CHANGED"
        | "FEEDBACK_ADDED"
        | "FIELD_UPDATED"
        | "SENT_FOR_TEST"
        | "PRODUCTION_SET"
        | "FEEDBACK_PROVIDED"
      priority: "LOW" | "MEDIUM" | "HIGH"
      status:
        | "PENDING"
        | "IN_PROGRESS"
        | "SENT_FOR_TEST"
        | "APPROVED_FOR_PRODUCTION"
        | "REJECTED_BY_CLIENT"
        | "CANCELLED"
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
      app_role: ["sales_manager", "rd_dev", "rd_manager", "admin"],
      client_result: ["PRODUCTION", "REWORK", "DECLINE"],
      direction: ["FUNCTIONAL", "FLAVOR", "COLORANT", "COMPLEX"],
      domain: [
        "MEAT",
        "CONFECTIONERY",
        "DAIRY",
        "BAKERY",
        "FISH",
        "FATS_OILS",
        "ICE_CREAM",
        "SEMI_FINISHED",
      ],
      event_type: [
        "CREATED",
        "ASSIGNED",
        "STATUS_CHANGED",
        "FEEDBACK_ADDED",
        "FIELD_UPDATED",
        "SENT_FOR_TEST",
        "PRODUCTION_SET",
        "FEEDBACK_PROVIDED",
      ],
      priority: ["LOW", "MEDIUM", "HIGH"],
      status: [
        "PENDING",
        "IN_PROGRESS",
        "SENT_FOR_TEST",
        "APPROVED_FOR_PRODUCTION",
        "REJECTED_BY_CLIENT",
        "CANCELLED",
      ],
    },
  },
} as const
