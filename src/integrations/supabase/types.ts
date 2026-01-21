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
      development_recipe_ingredients: {
        Row: {
          created_at: string
          grams: number
          id: string
          ingredient_name: string
          recipe_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grams: number
          id?: string
          ingredient_name: string
          recipe_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grams?: number
          id?: string
          ingredient_name?: string
          recipe_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "development_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      development_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          recipe_code: string
          recipe_seq: number
          request_id: string
          status: Database["public"]["Enums"]["development_recipe_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          recipe_code: string
          recipe_seq: number
          request_id: string
          status?: Database["public"]["Enums"]["development_recipe_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          recipe_code?: string
          recipe_seq?: number
          request_id?: string
          status?: Database["public"]["Enums"]["development_recipe_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_recipes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      development_sample_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_name: string
          lot_number: string | null
          recipe_grams: number
          required_grams: number
          sample_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_name: string
          lot_number?: string | null
          recipe_grams: number
          required_grams: number
          sample_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_name?: string
          lot_number?: string | null
          recipe_grams?: number
          required_grams?: number
          sample_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_sample_ingredients_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "development_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      development_sample_lab_results: {
        Row: {
          additional_info: string | null
          appearance: string | null
          bulk_density_g_dm3: number | null
          chlorides_pct: number | null
          color: string | null
          colority: number | null
          created_at: string
          gel_strength_g_cm3: number | null
          hydration: string | null
          id: string
          moisture_pct: number | null
          ph_value: number | null
          phosphates_pct: number | null
          sample_id: string
          smell: string | null
          taste: string | null
          updated_at: string
          viscosity_cps: number | null
        }
        Insert: {
          additional_info?: string | null
          appearance?: string | null
          bulk_density_g_dm3?: number | null
          chlorides_pct?: number | null
          color?: string | null
          colority?: number | null
          created_at?: string
          gel_strength_g_cm3?: number | null
          hydration?: string | null
          id?: string
          moisture_pct?: number | null
          ph_value?: number | null
          phosphates_pct?: number | null
          sample_id: string
          smell?: string | null
          taste?: string | null
          updated_at?: string
          viscosity_cps?: number | null
        }
        Update: {
          additional_info?: string | null
          appearance?: string | null
          bulk_density_g_dm3?: number | null
          chlorides_pct?: number | null
          color?: string | null
          colority?: number | null
          created_at?: string
          gel_strength_g_cm3?: number | null
          hydration?: string | null
          id?: string
          moisture_pct?: number | null
          ph_value?: number | null
          phosphates_pct?: number | null
          sample_id?: string
          smell?: string | null
          taste?: string | null
          updated_at?: string
          viscosity_cps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "development_sample_lab_results_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: true
            referencedRelation: "development_samples"
            referencedColumns: ["id"]
          },
        ]
      }
      development_samples: {
        Row: {
          batch_weight_g: number
          created_at: string
          created_by: string | null
          id: string
          recipe_id: string
          request_id: string
          sample_code: string
          sample_seq: number
          status: Database["public"]["Enums"]["development_sample_status"]
          updated_at: string
        }
        Insert: {
          batch_weight_g: number
          created_at?: string
          created_by?: string | null
          id?: string
          recipe_id: string
          request_id: string
          sample_code: string
          sample_seq: number
          status?: Database["public"]["Enums"]["development_sample_status"]
          updated_at?: string
        }
        Update: {
          batch_weight_g?: number
          created_at?: string
          created_by?: string | null
          id?: string
          recipe_id?: string
          request_id?: string
          sample_code?: string
          sample_seq?: number
          status?: Database["public"]["Enums"]["development_sample_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_samples_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_samples_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "development_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_samples_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: number
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: number
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          access_level: string
          category: string
          created_at: string
          created_by: string
          id: string
          index_error: string | null
          index_status: string
          indexed_at: string | null
          mime_type: string | null
          raw_text: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          access_level?: string
          category: string
          created_at?: string
          created_by: string
          id?: string
          index_error?: string | null
          index_status?: string
          indexed_at?: string | null
          mime_type?: string | null
          raw_text?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          access_level?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          index_error?: string | null
          index_status?: string
          indexed_at?: string | null
          mime_type?: string | null
          raw_text?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_vector_documents: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_invoice_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          invoice_id: string
          is_supplier_invoice: boolean
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          invoice_id: string
          is_supplier_invoice?: boolean
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          invoice_id?: string
          is_supplier_invoice?: boolean
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_attachments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      purchase_request_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          request_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          request_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          request_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
      rd_request_attachments: {
        Row: {
          created_at: string | null
          event_id: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          request_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          request_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          request_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_request_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "request_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
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
          complexity_level:
            | Database["public"]["Enums"]["complexity_level"]
            | null
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
          complexity_level?:
            | Database["public"]["Enums"]["complexity_level"]
            | null
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
          complexity_level?:
            | Database["public"]["Enums"]["complexity_level"]
            | null
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
      telegram_links: {
        Row: {
          created_at: string
          phone: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      copy_development_recipe: {
        Args: { p_recipe_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          recipe_code: string
          recipe_seq: number
          request_id: string
          status: Database["public"]["Enums"]["development_recipe_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "development_recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      copy_development_sample: { Args: { p_sample_id: string }; Returns: Json }
      create_development_recipe: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          recipe_code: string
          recipe_seq: number
          request_id: string
          status: Database["public"]["Enums"]["development_recipe_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "development_recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_development_sample: {
        Args: { p_batch_weight_g: number; p_recipe_id: string }
        Returns: Json
      }
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
      is_coo: { Args: never; Returns: boolean }
      kb_match_chunks: {
        Args: {
          doc_status?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          similarity: number
          title: string
        }[]
      }
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
      match_documents: {
        Args: { filter: Json; match_count: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      recalculate_sample_ingredients: {
        Args: { p_new_batch_weight_g: number; p_sample_id: string }
        Returns: Json
      }
      reject_purchase_invoice: {
        Args: { p_comment: string; p_invoice_id: string; p_role: string }
        Returns: Json
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
        | "quality_manager"
        | "admin_director"
        | "chief_engineer"
        | "production_deputy"
        | "warehouse_manager"
        | "chief_accountant"
        | "lawyer"
        | "office_manager"
        | "foreign_trade_manager"
        | "finance_deputy"
        | "financial_analyst"
        | "economist"
      approval_decision: "PENDING" | "APPROVED" | "REJECTED"
      client_result: "PRODUCTION" | "REWORK" | "DECLINE"
      complexity_level: "EASY" | "MEDIUM" | "COMPLEX" | "EXPERT"
      development_recipe_status: "Draft" | "Locked" | "Archived"
      development_sample_status:
        | "Draft"
        | "Prepared"
        | "Lab"
        | "LabDone"
        | "Pilot"
        | "PilotDone"
        | "ReadyForHandoff"
        | "HandedOff"
        | "Archived"
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
        | "SNACKS"
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
        | "INVOICE_PENDING"
        | "DELIVERING"
        | "COMPLETED"
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
        "quality_manager",
        "admin_director",
        "chief_engineer",
        "production_deputy",
        "warehouse_manager",
        "chief_accountant",
        "lawyer",
        "office_manager",
        "foreign_trade_manager",
        "finance_deputy",
        "financial_analyst",
        "economist",
      ],
      approval_decision: ["PENDING", "APPROVED", "REJECTED"],
      client_result: ["PRODUCTION", "REWORK", "DECLINE"],
      complexity_level: ["EASY", "MEDIUM", "COMPLEX", "EXPERT"],
      development_recipe_status: ["Draft", "Locked", "Archived"],
      development_sample_status: [
        "Draft",
        "Prepared",
        "Lab",
        "LabDone",
        "Pilot",
        "PilotDone",
        "ReadyForHandoff",
        "HandedOff",
        "Archived",
      ],
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
        "SNACKS",
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
        "INVOICE_PENDING",
        "DELIVERING",
        "COMPLETED",
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
