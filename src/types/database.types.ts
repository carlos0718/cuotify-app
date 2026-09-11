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
      borrowers: {
        Row: {
          address: string | null
          created_at: string | null
          dni: string | null
          email: string | null
          full_name: string
          id: string
          lender_id: string
          linked_profile_id: string | null
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          dni?: string | null
          email?: string | null
          full_name: string
          id?: string
          lender_id: string
          linked_profile_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          dni?: string | null
          email?: string | null
          full_name?: string
          id?: string
          lender_id?: string
          linked_profile_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrowers_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrowers_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          created_at: string | null
          debt_id: string
          due_date: string
          id: string
          interest_amount: number
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          payment_number: number
          penalty_amount: number | null
          principal_amount: number
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          debt_id: string
          due_date: string
          id?: string
          interest_amount: number
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_number: number
          penalty_amount?: number | null
          principal_amount: number
          status?: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          debt_id?: string
          due_date?: string
          id?: string
          interest_amount?: number
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_number?: number
          penalty_amount?: number | null
          principal_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "personal_debts"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          borrower_id: string
          color_code: string | null
          created_at: string | null
          currency: string | null
          delivery_date: string
          end_date: string | null
          first_payment_date: string
          grace_period_days: number | null
          id: string
          interest_rate: number
          interest_type: string | null
          late_penalty_rate: number | null
          late_penalty_type: string | null
          lender_id: string
          notes: string | null
          payment_amount: number
          principal_amount: number
          reminder_days_before: number | null
          status: string | null
          term_type: string
          term_value: number | null
          total_amount: number
          total_interest: number
          transfer_proof_url: string | null
          updated_at: string | null
        }
        Insert: {
          borrower_id: string
          color_code?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date: string
          end_date?: string | null
          first_payment_date: string
          grace_period_days?: number | null
          id?: string
          interest_rate: number
          interest_type?: string | null
          late_penalty_rate?: number | null
          late_penalty_type?: string | null
          lender_id: string
          notes?: string | null
          payment_amount: number
          principal_amount: number
          reminder_days_before?: number | null
          status?: string | null
          term_type: string
          term_value?: number | null
          total_amount: number
          total_interest: number
          transfer_proof_url?: string | null
          updated_at?: string | null
        }
        Update: {
          borrower_id?: string
          color_code?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date?: string
          end_date?: string | null
          first_payment_date?: string
          grace_period_days?: number | null
          id?: string
          interest_rate?: number
          interest_type?: string | null
          late_penalty_rate?: number | null
          late_penalty_type?: string | null
          lender_id?: string
          notes?: string | null
          payment_amount?: number
          principal_amount?: number
          reminder_days_before?: number | null
          status?: string | null
          term_type?: string
          term_value?: number | null
          total_amount?: number
          total_interest?: number
          transfer_proof_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          push_enabled: boolean
          reminder_days_before: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          push_enabled?: boolean
          reminder_days_before?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          push_enabled?: boolean
          reminder_days_before?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          loan_id: string | null
          payment_id: string | null
          scheduled_for: string | null
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          loan_id?: string | null
          payment_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          loan_id?: string | null
          payment_id?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          borrower_comment: string | null
          borrower_comment_date: string | null
          created_at: string | null
          due_date: string
          id: string
          interest_portion: number
          lender_note: string | null
          loan_id: string
          paid_amount: number | null
          paid_date: string | null
          payment_number: number
          penalty_amount: number | null
          penalty_calculated_at: string | null
          principal_portion: number
          remaining_balance: number
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          borrower_comment?: string | null
          borrower_comment_date?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          interest_portion: number
          lender_note?: string | null
          loan_id: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_number: number
          penalty_amount?: number | null
          penalty_calculated_at?: string | null
          principal_portion: number
          remaining_balance: number
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          borrower_comment?: string | null
          borrower_comment_date?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          interest_portion?: number
          lender_note?: string | null
          loan_id?: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_number?: number
          penalty_amount?: number | null
          penalty_calculated_at?: string | null
          principal_portion?: number
          remaining_balance?: number
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_debts: {
        Row: {
          color_code: string | null
          created_at: string | null
          creditor_name: string
          creditor_phone: string | null
          currency: string
          delivery_date: string
          description: string | null
          first_payment_date: string
          grace_period_days: number | null
          id: string
          installment_amount: number
          interest_rate: number
          interest_type: string
          late_penalty_rate: number | null
          late_penalty_type: string
          principal_amount: number
          status: string
          term_type: string
          term_value: number
          total_amount: number
          transfer_proof_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color_code?: string | null
          created_at?: string | null
          creditor_name: string
          creditor_phone?: string | null
          currency?: string
          delivery_date?: string
          description?: string | null
          first_payment_date: string
          grace_period_days?: number | null
          id?: string
          installment_amount: number
          interest_rate?: number
          interest_type?: string
          late_penalty_rate?: number | null
          late_penalty_type?: string
          principal_amount: number
          status?: string
          term_type: string
          term_value: number
          total_amount: number
          transfer_proof_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color_code?: string | null
          created_at?: string | null
          creditor_name?: string
          creditor_phone?: string | null
          currency?: string
          delivery_date?: string
          description?: string | null
          first_payment_date?: string
          grace_period_days?: number | null
          id?: string
          installment_amount?: number
          interest_rate?: number
          interest_type?: string
          late_penalty_rate?: number | null
          late_penalty_type?: string
          principal_amount?: number
          status?: string
          term_type?: string
          term_value?: number
          total_amount?: number
          transfer_proof_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_debts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          dni: string | null
          email: string
          full_name: string
          id: string
          notification_preferences: Json | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          dni?: string | null
          email: string
          full_name: string
          id: string
          notification_preferences?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          dni?: string | null
          email?: string
          full_name?: string
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_type: string | null
          id: string
          is_active: boolean | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_loan_payment: {
        Args: {
          p_annual_rate: number
          p_principal: number
          p_term_type: string
          p_term_value: number
        }
        Returns: {
          payment_amount: number
          total_amount: number
          total_interest: number
        }[]
      }
      generate_debt_payment_schedule: {
        Args: {
          p_debt_id: string
          p_first_payment_date: string
          p_interest_rate: number
          p_interest_type: string
          p_principal: number
          p_term_type: string
          p_term_value: number
        }
        Returns: undefined
      }
      generate_payment_schedule: {
        Args: { p_loan_id: string }
        Returns: undefined
      }
      get_monthly_interest_earned: {
        Args: never
        Returns: {
          currency: string
          month: number
          total_interest: number
          year: number
        }[]
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
    Enums: {},
  },
} as const

// Tipos auxiliares
export type NotificationPreferences = {
  email: boolean
  push: boolean
  reminder_days: number
}

export type NotificationType =
  | 'payment_reminder'
  | 'payment_overdue'
  | 'payment_received'
  | 'borrower_comment'
  | 'loan_linked'
  | 'loan_completed'

// Tipos para uso en la app
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Borrower = Database['public']['Tables']['borrowers']['Row']
export type Loan = Database['public']['Tables']['loans']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type PushToken = Database['public']['Tables']['push_tokens']['Row']

// Tipos para inserciones
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type BorrowerInsert = Database['public']['Tables']['borrowers']['Insert']
export type LoanInsert = Database['public']['Tables']['loans']['Insert']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']

// Tipos para actualizaciones
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type BorrowerUpdate = Database['public']['Tables']['borrowers']['Update']
export type LoanUpdate = Database['public']['Tables']['loans']['Update']
export type PaymentUpdate = Database['public']['Tables']['payments']['Update']
