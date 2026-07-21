/*
  Types updated: add actual_amount to cost_codes, and add uom, products, standard_rates types
*/

// NOTE: this file is machine-generated typings for Supabase — we are adding a few minimal entries

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      cost_codes: {
        Row: {
          budgeted_amount: number | null;
          category: string;
          code: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          description: string | null;
          id: string;
          project_id: string;
+         actual_amount: number | null;
          updated_at: string;
        };
        Insert: {
          budgeted_amount?: number | null;
          category?: string;
          code: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          id?: string;
          project_id: string;
+         actual_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          budgeted_amount?: number | null;
          category?: string;
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string;
+         actual_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_codes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
+      uom: {
+        Row: {
+          id: string;
+          name: string;
+          created_at: string;
+        };
+        Insert: {
+          id?: string;
+          name: string;
+          created_at?: string;
+        };
+        Update: {
+          id?: string;
+          name?: string;
+          created_at?: string;
+        };
+        Relationships: [];
+      };
+      products: {
+        Row: {
+          id: string;
+          name: string;
+          description: string | null;
+          standard_price: number | null;
+          uom_id: string | null;
+          created_at: string;
+          updated_at: string;
+          deleted_at: string | null;
+        };
+        Insert: {
+          id?: string;
+          name: string;
+          description?: string | null;
+          standard_price?: number | null;
+          uom_id?: string | null;
+          created_at?: string;
+          updated_at?: string;
+          deleted_at?: string | null;
+        };
+        Update: {
+          id?: string;
+          name?: string;
+          description?: string | null;
+          standard_price?: number | null;
+          uom_id?: string | null;
+          created_at?: string;
+          updated_at?: string;
+          deleted_at?: string | null;
+        };
+        Relationships: [
+          {
+            foreignKeyName: "products_uom_id_fkey";
+            columns: ["uom_id"];
+            isOneToOne: false;
+            referencedRelation: "uom";
+            referencedColumns: ["id"];
+          }
+        ];
+      };
+      standard_rates: {
+        Row: {
+          id: string;
+          job_type: string;
+          rate_per_hour: number | null;
+          created_at: string;
+        };
+        Insert: {
+          id?: string;
+          job_type: string;
+          rate_per_hour?: number | null;
+          created_at?: string;
+        };
+        Update: {
+          id?: string;
+          job_type?: string;
+          rate_per_hour?: number | null;
+          created_at?: string;
+        };
+        Relationships: [];
+      };
    };
  };
}
