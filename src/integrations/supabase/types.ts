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
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          contact_type: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          project_id: string | null
        }
        Insert: {
          company?: string | null
          contact_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          project_id?: string | null
        }
        Update: {
          company?: string | null
          contact_type?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          actual_amount: number | null
          budgeted_amount: number | null
          category: string
          code: string
          committed_amount: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          category?: string
          code: string
          committed_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          budgeted_amount?: number | null
          category?: string
          code?: string
          committed_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheet_labour: {
        Row: {
          actual_cost: number | null
          actual_days: number | null
          cost_sheet_id: string
          created_at: string
          daily_rate: number | null
          deleted_at: string | null
          description: string | null
          id: string
          job_type: string | null
          line_date: string | null
          planned_cost: number | null
          planned_days: number | null
          variance: number | null
          worker: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_days?: number | null
          cost_sheet_id: string
          created_at?: string
          daily_rate?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          job_type?: string | null
          line_date?: string | null
          planned_cost?: number | null
          planned_days?: number | null
          variance?: number | null
          worker?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_days?: number | null
          cost_sheet_id?: string
          created_at?: string
          daily_rate?: number | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          job_type?: string | null
          line_date?: string | null
          planned_cost?: number | null
          planned_days?: number | null
          variance?: number | null
          worker?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheet_labour_cost_sheet_id_fkey"
            columns: ["cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "cost_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheet_materials: {
        Row: {
          actual_purchased_cost: number | null
          actual_purchased_qty: number | null
          actual_req_qty: number | null
          cost_price_subtotal: number | null
          cost_sheet_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          invoice_subtotal: number | null
          line_date: string | null
          planned_amount: number | null
          planned_qty: number | null
          product: string | null
          unit_cost: number | null
          uom: string | null
          vendor_bill_cost: number | null
          vendor_bill_qty: number | null
        }
        Insert: {
          actual_purchased_cost?: number | null
          actual_purchased_qty?: number | null
          actual_req_qty?: number | null
          cost_price_subtotal?: number | null
          cost_sheet_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_subtotal?: number | null
          line_date?: string | null
          planned_amount?: number | null
          planned_qty?: number | null
          product?: string | null
          unit_cost?: number | null
          uom?: string | null
          vendor_bill_cost?: number | null
          vendor_bill_qty?: number | null
        }
        Update: {
          actual_purchased_cost?: number | null
          actual_purchased_qty?: number | null
          actual_req_qty?: number | null
          cost_price_subtotal?: number | null
          cost_sheet_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          invoice_subtotal?: number | null
          line_date?: string | null
          planned_amount?: number | null
          planned_qty?: number | null
          product?: string | null
          unit_cost?: number | null
          uom?: string | null
          vendor_bill_cost?: number | null
          vendor_bill_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheet_materials_cost_sheet_id_fkey"
            columns: ["cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "cost_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheet_overhead: {
        Row: {
          actual_amount: number | null
          category: string | null
          cost_sheet_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          line_date: string | null
          planned_amount: number | null
          variance: number | null
        }
        Insert: {
          actual_amount?: number | null
          category?: string | null
          cost_sheet_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          line_date?: string | null
          planned_amount?: number | null
          variance?: number | null
        }
        Update: {
          actual_amount?: number | null
          category?: string | null
          cost_sheet_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          line_date?: string | null
          planned_amount?: number | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheet_overhead_cost_sheet_id_fkey"
            columns: ["cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "cost_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheets: {
        Row: {
          analytic_account: string | null
          cost_code_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          job_order: string | null
          notes: string | null
          number: string
          project_id: string
          sale_reference: string | null
          sheet_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          analytic_account?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          job_order?: string | null
          notes?: string | null
          number?: string
          project_id: string
          sale_reference?: string | null
          sheet_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          analytic_account?: string | null
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          job_order?: string | null
          notes?: string | null
          number?: string
          project_id?: string
          sale_reference?: string | null
          sheet_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheets_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          doc_type: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          name: string
          project_id: string | null
          updated_at: string
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          actual_date: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          name: string
          percent_complete: number | null
          project_id: string
          status: string
          target_date: string | null
        }
        Insert: {
          actual_date?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name: string
          percent_complete?: number | null
          project_id: string
          status?: string
          target_date?: string | null
        }
        Update: {
          actual_date?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          name?: string
          percent_complete?: number | null
          project_id?: string
          status?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string | null
          link: string | null
          read: boolean | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          link?: string | null
          read?: boolean | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          link?: string | null
          read?: boolean | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          standard_price: number | null
          uom_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          standard_price?: number | null
          uom_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          standard_price?: number | null
          uom_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uom"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role_on_project: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role_on_project?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role_on_project?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          name: string
          percent_complete: number | null
          project_manager_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          percent_complete?: number | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          percent_complete?: number | null
          project_manager_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          number: string
          project_id: string | null
          requisition_id: string | null
          status: string
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          number?: string
          project_id?: string | null
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_lines: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          item_name: string | null
          qty: number | null
          requisition_id: string
          supplier_id: string | null
          total: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_name?: string | null
          qty?: number | null
          requisition_id: string
          supplier_id?: string | null
          total?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_name?: string | null
          qty?: number | null
          requisition_id?: string
          supplier_id?: string | null
          total?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          cost_code_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          employee_id: string | null
          id: string
          is_change_order: boolean | null
          notes: string | null
          number: string
          project_id: string | null
          status: string
          total_amount: number | null
          type: string
          updated_at: string
        }
        Insert: {
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_id?: string | null
          id?: string
          is_change_order?: boolean | null
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: string
          total_amount?: number | null
          type?: string
          updated_at?: string
        }
        Update: {
          cost_code_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          employee_id?: string | null
          id?: string
          is_change_order?: boolean | null
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: string
          total_amount?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_cost_code_id_fkey"
            columns: ["cost_code_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_reports: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          issues: Json | null
          materials_used: Json | null
          project_id: string | null
          report_date: string
          site_manager_id: string | null
          status: string
          tomorrow_plan: string | null
          updated_at: string
          weather: string | null
          work_done: Json | null
          workers_count: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          issues?: Json | null
          materials_used?: Json | null
          project_id?: string | null
          report_date?: string
          site_manager_id?: string | null
          status?: string
          tomorrow_plan?: string | null
          updated_at?: string
          weather?: string | null
          work_done?: Json | null
          workers_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          issues?: Json | null
          materials_used?: Json | null
          project_id?: string | null
          report_date?: string
          site_manager_id?: string | null
          status?: string
          tomorrow_plan?: string | null
          updated_at?: string
          weather?: string | null
          work_done?: Json | null
          workers_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_reports_site_manager_id_fkey"
            columns: ["site_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_rates: {
        Row: {
          created_at: string
          id: string
          job_type: string
          rate_per_hour: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_type: string
          rate_per_hour?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          job_type?: string
          rate_per_hour?: number | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          bank_details: string | null
          category: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uom: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
      variation_orders: {
        Row: {
          amount: number | null
          approved_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          project_id: string
          status: string
          updated_at: string
          vo_type: string | null
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string
          vo_type?: string | null
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
          vo_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variation_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_catalog: { Args: { _uid: string }; Returns: boolean }
      can_manage_costing: { Args: { _uid: string }; Returns: boolean }
      can_manage_procurement: { Args: { _uid: string }; Returns: boolean }
      can_manage_requisitions: { Args: { _uid: string }; Returns: boolean }
      can_manage_site: { Args: { _uid: string }; Returns: boolean }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_privileged: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "project_manager"
        | "site_manager"
        | "accountant"
        | "procurement_officer"
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
        "admin",
        "project_manager",
        "site_manager",
        "accountant",
        "procurement_officer",
      ],
    },
  },
} as const
