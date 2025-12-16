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
      purchase_invoice_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          name: string
          note: string | null
          price: number
          quantity: number
          request_item_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["purchase_item_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          name: string
          note?: string | null
          price?: number
          quantity?: number
          request_item_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["purchase_item_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          name?: string
          note?: string | null
          price?: number
          quantity?: number
          request_item_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["purchase_item_status"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          amount: number
          ceo_comment: string | null
          ceo_decided_at: string | null
          ceo_decided_by: string | null
          ceo_decision: Database["public"]["Enums"]["approval_decision"] | null
          coo_comment: string | null
          coo_decided_at: string | null
          coo_decided_by: string | null
          coo_decision: Database["public"]["Enums"]["approval_decision"] | null
          created_at: string
          created_by: string
          currency: string
          delivered_date: string | null
          delivery_note: string | null
          description: string | null
          expected_date: string | null
          id: string
          invoice_date: string | null
          number: string
          paid_date: string | null
          payment_doc_no: string | null
          payment_terms: Database["public"]["Enums"]["payment_terms"]
          planned_payment_date: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          supplier_contact: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          ceo_comment?: string | null
          ceo_decided_at?: string | null
          ceo_decided_by?: string | null
          ceo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          coo_comment?: string | null
          coo_decided_at?: string | null
          coo_decided_by?: string | null
          coo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          created_at?: string
          created_by: string
          currency?: string
          delivered_date?: string | null
          delivery_note?: string | null
          description?: string | null
          expected_date?: string | null
          id?: string
          invoice_date?: string | null
          number?: string
          paid_date?: string | null
          payment_doc_no?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"]
          planned_payment_date?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          supplier_contact?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          ceo_comment?: string | null
          ceo_decided_at?: string | null
          ceo_decided_by?: string | null
          ceo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          coo_comment?: string | null
          coo_decided_at?: string | null
          coo_decided_by?: string | null
          coo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          created_at?: string
          created_by?: string
          currency?: string
          delivered_date?: string | null
          delivery_note?: string | null
          description?: string | null
          expected_date?: string | null
          id?: string
          invoice_date?: string | null
          number?: string
          paid_date?: string | null
          payment_doc_no?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"]
          planned_payment_date?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          supplier_contact?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_ceo_decided_by_fkey"
            columns: ["ceo_decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_coo_decided_by_fkey"
            columns: ["coo_decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_logs: {
        Row: {
          action: string
          comment: string | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["purchase_log_entity_type"]
          id: string
          payload: Json | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          comment?: string | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["purchase_log_entity_type"]
          id?: string
          payload?: Json | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          comment?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["purchase_log_entity_type"]
          id?: string
          payload?: Json | null
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          quantity: number
          request_id: string
          sort_order: number
          status: Database["public"]["Enums"]["purchase_item_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          quantity?: number
          request_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["purchase_item_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          quantity?: number
          request_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["purchase_item_status"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          coo_comment: string | null
          coo_decided_at: string | null
          coo_decided_by: string | null
          coo_decision: Database["public"]["Enums"]["approval_decision"] | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          desired_date: string | null
          id: string
          number: string
          purchase_type: Database["public"]["Enums"]["purchase_type"]
          status: Database["public"]["Enums"]["purchase_request_status"]
          updated_at: string
        }
        Insert: {
          coo_comment?: string | null
          coo_decided_at?: string | null
          coo_decided_by?: string | null
          coo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          desired_date?: string | null
          id?: string
          number?: string
          purchase_type?: Database["public"]["Enums"]["purchase_type"]
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Update: {
          coo_comment?: string | null
          coo_decided_at?: string | null
          coo_decided_by?: string | null
          coo_decision?: Database["public"]["Enums"]["approval_decision"] | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          desired_date?: string | null
          id?: string
          number?: string
          purchase_type?: Database["public"]["Enums"]["purchase_type"]
          status?: Database["public"]["Enums"]["purchase_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_coo_decided_by_fkey"
            columns: ["coo_decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      generate_purchase_invoice_number: { Args: never; Returns: string }
      generate_purchase_request_number: { Args: never; Returns: string }
      generate_request_code: { Args: never; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_role: string }; Returns: boolean }
      log_purchase_event: {
        Args: {
          p_action: string
          p_comment?: string
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["purchase_log_entity_type"]
          p_payload?: Json
        }
        Returns: string
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
      app_role:
        | "sales_manager"
        | "rd_dev"
        | "rd_manager"
        | "admin"
        | "procurement_manager"
        | "coo"
        | "ceo"
        | "treasurer"
        | "accountant"
      approval_decision: "PENDING" | "APPROVED" | "REJECTED"
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
      payment_terms: "PREPAYMENT" | "POSTPAYMENT"
      priority: "LOW" | "MEDIUM" | "HIGH"
      purchase_invoice_status:
        | "DRAFT"
        | "PENDING_COO"
        | "PENDING_CEO"
        | "TO_PAY"
        | "PAID"
        | "DELIVERED"
        | "REJECTED"
      purchase_item_status:
        | "PENDING"
        | "IN_PROGRESS"
        | "ORDERED"
        | "DELIVERED"
        | "REJECTED"
      purchase_log_entity_type: "REQUEST" | "INVOICE"
      purchase_request_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "IN_PROGRESS"
        | "REJECTED"
      purchase_type: "TMC" | "SERVICE"
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
      app_role: [
        "sales_manager",
        "rd_dev",
        "rd_manager",
        "admin",
        "procurement_manager",
        "coo",
        "ceo",
        "treasurer",
        "accountant",
      ],
      approval_decision: ["PENDING", "APPROVED", "REJECTED"],
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
      payment_terms: ["PREPAYMENT", "POSTPAYMENT"],
      priority: ["LOW", "MEDIUM", "HIGH"],
      purchase_invoice_status: [
        "DRAFT",
        "PENDING_COO",
        "PENDING_CEO",
        "TO_PAY",
        "PAID",
        "DELIVERED",
        "REJECTED",
      ],
      purchase_item_status: [
        "PENDING",
        "IN_PROGRESS",
        "ORDERED",
        "DELIVERED",
        "REJECTED",
      ],
      purchase_log_entity_type: ["REQUEST", "INVOICE"],
      purchase_request_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "IN_PROGRESS",
        "REJECTED",
      ],
      purchase_type: ["TMC", "SERVICE"],
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
