export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          is_helper: boolean
          helper_score: number
        }
        Insert: {
          id: string
          name?: string | null
          is_helper?: boolean
          helper_score?: number
        }
        Update: {
          id?: string
          name?: string | null
          is_helper?: boolean
          helper_score?: number
        }
      }
      requests: {
        Row: {
          id: string
          channel: string
          external_id: string
          summary: string
          risk: number
          status: string
          created_at: string
          claimed_by: string | null
        }
        Insert: {
          id?: string
          channel: string
          external_id: string
          summary: string
          risk: number
          status?: string
          created_at?: string
          claimed_by?: string | null
        }
        Update: {
          id?: string
          channel?: string
          external_id?: string
          summary?: string
          risk?: number
          status?: string
          created_at?: string
          claimed_by?: string | null
        }
      }
      messages: {
        Row: {
          id: number
          request_id: string
          sender: string
          content: string
          ts: string
        }
        Insert: {
          id?: number
          request_id: string
          sender: string
          content: string
          ts?: string
        }
        Update: {
          id?: number
          request_id?: string
          sender?: string
          content?: string
          ts?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 