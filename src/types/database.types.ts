export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          dni: string | null;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: 'lender' | 'borrower' | 'both';
          notification_preferences: NotificationPreferences;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          dni?: string | null;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'lender' | 'borrower' | 'both';
          notification_preferences?: NotificationPreferences;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          dni?: string | null;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'lender' | 'borrower' | 'both';
          notification_preferences?: NotificationPreferences;
          created_at?: string;
          updated_at?: string;
        };
      };
      borrowers: {
        Row: {
          id: string;
          lender_id: string;
          linked_profile_id: string | null;
          dni: string | null;
          email: string | null;
          full_name: string;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lender_id: string;
          linked_profile_id?: string | null;
          dni?: string | null;
          email?: string | null;
          full_name: string;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lender_id?: string;
          linked_profile_id?: string | null;
          dni?: string | null;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      loans: {
        Row: {
          id: string;
          lender_id: string;
          borrower_id: string;
          principal_amount: number;
          interest_rate: number;
          term_value: number;
          term_type: 'weeks' | 'months';
          interest_type: 'simple' | 'french';
          payment_amount: number;
          total_interest: number;
          total_amount: number;
          delivery_date: string;
          first_payment_date: string;
          end_date: string;
          status: 'active' | 'completed' | 'defaulted' | 'cancelled';
          reminder_days_before: number;
          color_code: string;
          notes: string | null;
          grace_period_days: number;
          late_penalty_rate: number;
          late_penalty_type: 'none' | 'fixed' | 'daily' | 'weekly';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lender_id: string;
          borrower_id: string;
          principal_amount: number;
          interest_rate: number;
          term_value: number;
          term_type: 'weeks' | 'months';
          interest_type?: 'simple' | 'french';
          payment_amount: number;
          total_interest: number;
          total_amount: number;
          delivery_date: string;
          first_payment_date: string;
          end_date: string;
          status?: 'active' | 'completed' | 'defaulted' | 'cancelled';
          reminder_days_before?: number;
          color_code?: string;
          notes?: string | null;
          grace_period_days?: number;
          late_penalty_rate?: number;
          late_penalty_type?: 'none' | 'fixed' | 'daily' | 'weekly';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lender_id?: string;
          borrower_id?: string;
          principal_amount?: number;
          interest_rate?: number;
          term_value?: number;
          term_type?: 'weeks' | 'months';
          interest_type?: 'simple' | 'french';
          payment_amount?: number;
          total_interest?: number;
          total_amount?: number;
          delivery_date?: string;
          first_payment_date?: string;
          end_date?: string;
          status?: 'active' | 'completed' | 'defaulted' | 'cancelled';
          reminder_days_before?: number;
          color_code?: string;
          notes?: string | null;
          grace_period_days?: number;
          late_penalty_rate?: number;
          late_penalty_type?: 'none' | 'fixed' | 'daily' | 'weekly';
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          loan_id: string;
          payment_number: number;
          due_date: string;
          principal_portion: number;
          interest_portion: number;
          total_amount: number;
          remaining_balance: number;
          status: 'pending' | 'paid' | 'partial' | 'overdue';
          paid_amount: number;
          paid_date: string | null;
          borrower_comment: string | null;
          borrower_comment_date: string | null;
          lender_note: string | null;
          penalty_amount: number;
          penalty_calculated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          loan_id: string;
          payment_number: number;
          due_date: string;
          principal_portion: number;
          interest_portion: number;
          total_amount: number;
          remaining_balance: number;
          status?: 'pending' | 'paid' | 'partial' | 'overdue';
          paid_amount?: number;
          paid_date?: string | null;
          borrower_comment?: string | null;
          borrower_comment_date?: string | null;
          lender_note?: string | null;
          penalty_amount?: number;
          penalty_calculated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          loan_id?: string;
          payment_number?: number;
          due_date?: string;
          principal_portion?: number;
          interest_portion?: number;
          total_amount?: number;
          remaining_balance?: number;
          status?: 'pending' | 'paid' | 'partial' | 'overdue';
          paid_amount?: number;
          paid_date?: string | null;
          borrower_comment?: string | null;
          borrower_comment_date?: string | null;
          lender_note?: string | null;
          penalty_amount?: number;
          penalty_calculated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          loan_id: string | null;
          payment_id: string | null;
          type: NotificationType;
          title: string;
          body: string;
          data: Json | null;
          is_read: boolean;
          scheduled_for: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          loan_id?: string | null;
          payment_id?: string | null;
          type: NotificationType;
          title: string;
          body: string;
          data?: Json | null;
          is_read?: boolean;
          scheduled_for?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          loan_id?: string | null;
          payment_id?: string | null;
          type?: NotificationType;
          title?: string;
          body?: string;
          data?: Json | null;
          is_read?: boolean;
          scheduled_for?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          device_type: 'ios' | 'android' | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          device_type?: 'ios' | 'android' | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          device_type?: 'ios' | 'android' | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Tipos auxiliares
export type NotificationPreferences = {
  email: boolean;
  push: boolean;
  reminder_days: number;
};

export type NotificationType =
  | 'payment_reminder'
  | 'payment_overdue'
  | 'payment_received'
  | 'borrower_comment'
  | 'loan_linked'
  | 'loan_completed';

// Tipos para uso en la app
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Borrower = Database['public']['Tables']['borrowers']['Row'];
export type Loan = Database['public']['Tables']['loans']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PushToken = Database['public']['Tables']['push_tokens']['Row'];

// Tipos para inserciones
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type BorrowerInsert = Database['public']['Tables']['borrowers']['Insert'];
export type LoanInsert = Database['public']['Tables']['loans']['Insert'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

// Tipos para actualizaciones
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type BorrowerUpdate = Database['public']['Tables']['borrowers']['Update'];
export type LoanUpdate = Database['public']['Tables']['loans']['Update'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];
