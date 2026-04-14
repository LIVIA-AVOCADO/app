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
      agent_prompts: {
        Row: {
          age: string | null
          comunication: string | null
          created_at: string
          gender: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line: Json | null
          id: number
          id_agent: string | null
          id_tenant: string | null
          instructions: Json | null
          limitations: Json | null
          name: string | null
          objective: string | null
          others_instructions: Json | null
          personality: string | null
          rules: Json | null
        }
        Insert: {
          age?: string | null
          comunication?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line?: Json | null
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          instructions?: Json | null
          limitations?: Json | null
          name?: string | null
          objective?: string | null
          others_instructions?: Json | null
          personality?: string | null
          rules?: Json | null
        }
        Update: {
          age?: string | null
          comunication?: string | null
          created_at?: string
          gender?: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line?: Json | null
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          instructions?: Json | null
          limitations?: Json | null
          name?: string | null
          objective?: string | null
          others_instructions?: Json | null
          personality?: string | null
          rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_id_agent_fkey"
            columns: ["id_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_prompts_id_tenant_fkey"
            columns: ["id_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts_deleted_backup: {
        Row: {
          age: string | null
          backup_date: string | null
          comunication: string | null
          created_at: string | null
          gender: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line: Json | null
          id: number | null
          id_agent: string | null
          id_tenant: string | null
          instructions: Json | null
          limitations: Json | null
          name: string | null
          objective: string | null
          others_instructions: Json | null
          personality: string | null
          rules: Json | null
        }
        Insert: {
          age?: string | null
          backup_date?: string | null
          comunication?: string | null
          created_at?: string | null
          gender?: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line?: Json | null
          id?: number | null
          id_agent?: string | null
          id_tenant?: string | null
          instructions?: Json | null
          limitations?: Json | null
          name?: string | null
          objective?: string | null
          others_instructions?: Json | null
          personality?: string | null
          rules?: Json | null
        }
        Update: {
          age?: string | null
          backup_date?: string | null
          comunication?: string | null
          created_at?: string | null
          gender?: Database["public"]["Enums"]["agent_gender_enum"] | null
          guide_line?: Json | null
          id?: number | null
          id_agent?: string | null
          id_tenant?: string | null
          instructions?: Json | null
          limitations?: Json | null
          name?: string | null
          objective?: string | null
          others_instructions?: Json | null
          personality?: string | null
          rules?: Json | null
        }
        Relationships: []
      }
      agent_prompts_guard_rails: {
        Row: {
          created_at: string
          id: number
          id_agent: string | null
          id_tenant: string | null
          prompt_jailbreak: string | null
          prompt_nsfw: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt_jailbreak?: string | null
          prompt_nsfw?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt_jailbreak?: string | null
          prompt_nsfw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_guard_rails_id_agent_fkey"
            columns: ["id_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_guard_rails_id_tenant_fkey"
            columns: ["id_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts_intention: {
        Row: {
          created_at: string
          id: number
          id_agent: string | null
          id_tenant: string | null
          prompt: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompts_intention_id_agent_fkey"
            columns: ["id_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_prompts_intention_id_tenant_fkey"
            columns: ["id_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompts_observer: {
        Row: {
          created_at: string
          id: number
          id_agent: string | null
          id_tenant: string | null
          prompt: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          id_agent?: string | null
          id_tenant?: string | null
          prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_observer_id_agent_fkey"
            columns: ["id_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_observer_id_tenant_fkey"
            columns: ["id_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_templates: {
        Row: {
          age: string | null
          communication: string | null
          created_at: string | null
          created_by: string | null
          gender: string | null
          guide_line: Json | null
          id: string
          instructions: Json | null
          is_active: boolean | null
          limitations: Json | null
          name: string
          objective: string | null
          others_instructions: Json | null
          persona_name: string | null
          personality: string | null
          reactive: boolean
          rules: Json | null
          type: Database["public"]["Enums"]["agent_function"]
          updated_at: string | null
        }
        Insert: {
          age?: string | null
          communication?: string | null
          created_at?: string | null
          created_by?: string | null
          gender?: string | null
          guide_line?: Json | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          limitations?: Json | null
          name: string
          objective?: string | null
          others_instructions?: Json | null
          persona_name?: string | null
          personality?: string | null
          reactive?: boolean
          rules?: Json | null
          type: Database["public"]["Enums"]["agent_function"]
          updated_at?: string | null
        }
        Update: {
          age?: string | null
          communication?: string | null
          created_at?: string | null
          created_by?: string | null
          gender?: string | null
          guide_line?: Json | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          limitations?: Json | null
          name?: string
          objective?: string | null
          others_instructions?: Json | null
          persona_name?: string | null
          personality?: string | null
          reactive?: boolean
          rules?: Json | null
          type?: Database["public"]["Enums"]["agent_function"]
          updated_at?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string
          id: string
          id_neurocore: string | null
          name: string
          reactive: boolean
          template_id: string | null
          type: Database["public"]["Enums"]["agent_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_neurocore?: string | null
          name: string
          reactive?: boolean
          template_id?: string | null
          type: Database["public"]["Enums"]["agent_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          id_neurocore?: string | null
          name?: string
          reactive?: boolean
          template_id?: string | null
          type?: Database["public"]["Enums"]["agent_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_id_neurocore_fkey"
            columns: ["id_neurocore"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          input_usd_per_1m: number
          is_active: boolean
          model: string
          output_usd_per_1m: number
        }
        Insert: {
          input_usd_per_1m: number
          is_active?: boolean
          model: string
          output_usd_per_1m: number
        }
        Update: {
          input_usd_per_1m?: number
          is_active?: boolean
          model?: string
          output_usd_per_1m?: number
        }
        Relationships: []
      }
      base_conhecimentos: {
        Row: {
          base_conhecimentos_vectors: string | null
          created_at: string
          description: string | null
          domain: string | null
          id: string
          is_active: boolean
          name: string
          neurocore_id: string
          tenant_id: string
          updated_at: string
          url_attachment: string | null
        }
        Insert: {
          base_conhecimentos_vectors?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          neurocore_id: string
          tenant_id: string
          updated_at?: string
          url_attachment?: string | null
        }
        Update: {
          base_conhecimentos_vectors?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          neurocore_id?: string
          tenant_id?: string
          updated_at?: string
          url_attachment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimentos_base_conhecimentos_vectors_fkey"
            columns: ["base_conhecimentos_vectors"]
            isOneToOne: false
            referencedRelation: "base_conhecimentos_vectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimentos_domain_fkey"
            columns: ["domain"]
            isOneToOne: false
            referencedRelation: "knowledge_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimentos_neurocore_id_fkey"
            columns: ["neurocore_id"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conhecimentos_vectors: {
        Row: {
          base_conhecimentos_id: string | null
          content: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          tenant_id: string | null
        }
        Insert: {
          base_conhecimentos_id?: string | null
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
        }
        Update: {
          base_conhecimentos_id?: string | null
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimentos_vectors_base_conhecimentos_fkey"
            columns: ["base_conhecimentos_id"]
            isOneToOne: false
            referencedRelation: "base_conhecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimentos_vectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_providers: {
        Row: {
          api_base_config: Json | null
          channel_provider_identifier_code: string | null
          created_at: string
          description: string | null
          id: string
          id_subwork_n8n_master_integrator: string | null
          name: string
          updated_at: string
        }
        Insert: {
          api_base_config?: Json | null
          channel_provider_identifier_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          id_subwork_n8n_master_integrator?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          api_base_config?: Json | null
          channel_provider_identifier_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          id_subwork_n8n_master_integrator?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          channel_provider_id: string
          config_json: Json | null
          connection_status: string
          created_at: string
          id: string
          identification_number: string
          is_active: boolean
          is_receiving_messages: boolean
          is_sending_messages: boolean
          message_wait_time_fragments: number | null
          name: string
          observations: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel_provider_id: string
          config_json?: Json | null
          connection_status?: string
          created_at?: string
          id?: string
          identification_number: string
          is_active?: boolean
          is_receiving_messages?: boolean
          is_sending_messages?: boolean
          message_wait_time_fragments?: number | null
          name: string
          observations?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel_provider_id?: string
          config_json?: Json | null
          connection_status?: string
          created_at?: string
          id?: string
          identification_number?: string
          is_active?: boolean
          is_receiving_messages?: boolean
          is_sending_messages?: boolean
          message_wait_time_fragments?: number | null
          name?: string
          observations?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_channel_provider_id_fkey"
            columns: ["channel_provider_id"]
            isOneToOne: false
            referencedRelation: "channel_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_data_changes: {
        Row: {
          changed_at: string | null
          changed_by: string
          contact_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          tenant_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          contact_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          tenant_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          contact_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_data_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_data_changes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_data_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_complement: string | null
          address_number: string | null
          address_street: string | null
          city: string | null
          country: string | null
          cpf: string | null
          created_at: string
          customer_data_extracted: Json | null
          email: string | null
          external_contact_id: string | null
          external_identification_contact: string | null
          id: string
          last_interaction_at: string
          last_negotiation: Json | null
          name: string
          phone: string
          phone_secondary: string | null
          rg: string | null
          status: Database["public"]["Enums"]["contact_status_enum"]
          tag: string | null
          tenant_id: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          city?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          customer_data_extracted?: Json | null
          email?: string | null
          external_contact_id?: string | null
          external_identification_contact?: string | null
          id?: string
          last_interaction_at?: string
          last_negotiation?: Json | null
          name: string
          phone: string
          phone_secondary?: string | null
          rg?: string | null
          status: Database["public"]["Enums"]["contact_status_enum"]
          tag?: string | null
          tenant_id: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          address_street?: string | null
          city?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          customer_data_extracted?: Json | null
          email?: string | null
          external_contact_id?: string | null
          external_identification_contact?: string | null
          id?: string
          last_interaction_at?: string
          last_negotiation?: Json | null
          name?: string
          phone?: string
          phone_secondary?: string | null
          rg?: string | null
          status?: Database["public"]["Enums"]["contact_status_enum"]
          tag?: string | null
          tenant_id?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reactivations_settings: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_active: boolean
          max_reactivations: number
          reactivation_time_1_minutes: number | null
          reactivation_time_2_minutes: number | null
          reactivation_time_3_minutes: number | null
          reactivation_time_4_minutes: number | null
          reactivation_time_5_minutes: number | null
          start_time: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          max_reactivations?: number
          reactivation_time_1_minutes?: number | null
          reactivation_time_2_minutes?: number | null
          reactivation_time_3_minutes?: number | null
          reactivation_time_4_minutes?: number | null
          reactivation_time_5_minutes?: number | null
          start_time?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_active?: boolean
          max_reactivations?: number
          reactivation_time_1_minutes?: number | null
          reactivation_time_2_minutes?: number | null
          reactivation_time_3_minutes?: number | null
          reactivation_time_4_minutes?: number | null
          reactivation_time_5_minutes?: number | null
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reactivations_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reasons_pauses_and_closures: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          neurocore_id: string
          reason_type: Database["public"]["Enums"]["reason_type_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          neurocore_id: string
          reason_type: Database["public"]["Enums"]["reason_type_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          neurocore_id?: string
          reason_type?: Database["public"]["Enums"]["reason_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reasons_pauses_and_closures_neurocore_id_fkey"
            columns: ["neurocore_id"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel_id: string | null
          closure_notes: string | null
          consecutive_reactivations: number
          contact_id: string
          conversation_closure_reason_id: string | null
          conversation_pause_reason_id: string | null
          created_at: string
          external_id: string | null
          has_unread: boolean
          ia_active: boolean
          id: string
          is_important: boolean
          last_message_at: string
          overall_feedback_text: string | null
          overall_feedback_type:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          pause_notes: string | null
          status: Database["public"]["Enums"]["conversation_status_enum"]
          tenant_id: string
          total_reactivations: number
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          closure_notes?: string | null
          consecutive_reactivations?: number
          contact_id: string
          conversation_closure_reason_id?: string | null
          conversation_pause_reason_id?: string | null
          created_at?: string
          external_id?: string | null
          has_unread?: boolean
          ia_active?: boolean
          id?: string
          is_important?: boolean
          last_message_at?: string
          overall_feedback_text?: string | null
          overall_feedback_type?:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          pause_notes?: string | null
          status: Database["public"]["Enums"]["conversation_status_enum"]
          tenant_id: string
          total_reactivations?: number
          unread_count?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          closure_notes?: string | null
          consecutive_reactivations?: number
          contact_id?: string
          conversation_closure_reason_id?: string | null
          conversation_pause_reason_id?: string | null
          created_at?: string
          external_id?: string | null
          has_unread?: boolean
          ia_active?: boolean
          id?: string
          is_important?: boolean
          last_message_at?: string
          overall_feedback_text?: string | null
          overall_feedback_type?:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          pause_notes?: string | null
          status?: Database["public"]["Enums"]["conversation_status_enum"]
          tenant_id?: string
          total_reactivations?: number
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_conversation_closure_reason_id_fkey"
            columns: ["conversation_closure_reason_id"]
            isOneToOne: false
            referencedRelation: "conversation_reasons_pauses_and_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_conversation_pause_reason_id_fkey"
            columns: ["conversation_pause_reason_id"]
            isOneToOne: false
            referencedRelation: "conversation_reasons_pauses_and_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_modules: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          conversation_id: string
          created_at: string
          feedback_status: Database["public"]["Enums"]["feedback_process_status_enum"]
          feedback_text: string | null
          feedback_type: Database["public"]["Enums"]["feedback_type_enum"]
          id: string
          message_id: string | null
          super_admin_comment: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          feedback_status?: Database["public"]["Enums"]["feedback_process_status_enum"]
          feedback_text?: string | null
          feedback_type: Database["public"]["Enums"]["feedback_type_enum"]
          id?: string
          message_id?: string | null
          super_admin_comment?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          feedback_status?: Database["public"]["Enums"]["feedback_process_status_enum"]
          feedback_text?: string | null
          feedback_type?: Database["public"]["Enums"]["feedback_type_enum"]
          id?: string
          message_id?: string | null
          super_admin_comment?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_domains: {
        Row: {
          active: boolean
          created_at: string
          domain: string
          id: string
          neurocore_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain: string
          id?: string
          neurocore_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain?: string
          id?: string
          neurocore_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_domains_neurocore_id_fkey"
            columns: ["neurocore_id"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_feedback: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          rating: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          rating: string
          tenant_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          rating?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          external_message_id: string | null
          feedback_text: string | null
          feedback_type:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          id: string
          sender_agent_id: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type_enum"]
          sender_user_id: string | null
          status: Database["public"]["Enums"]["message_status"] | null
          timestamp: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          external_message_id?: string | null
          feedback_text?: string | null
          feedback_type?:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          id?: string
          sender_agent_id?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type_enum"]
          sender_user_id?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          timestamp?: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          external_message_id?: string | null
          feedback_text?: string | null
          feedback_type?:
            | Database["public"]["Enums"]["feedback_type_enum"]
            | null
          id?: string
          sender_agent_id?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type_enum"]
          sender_user_id?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          timestamp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      neurocores: {
        Row: {
          created_at: string
          description: string | null
          id: string
          id_subwork_n8n_neurocore: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          id_subwork_n8n_neurocore: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          id_subwork_n8n_neurocore?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      niches: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quick_reply_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          message: string
          tenant_id: string
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          message: string
          tenant_id: string
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          message?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quick_reply_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_reply_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      synapses: {
        Row: {
          base_conhecimento_id: string
          content: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_enabled: boolean
          status: Database["public"]["Enums"]["synapse_status_enum"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          base_conhecimento_id: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          status: Database["public"]["Enums"]["synapse_status_enum"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          base_conhecimento_id?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          status?: Database["public"]["Enums"]["synapse_status_enum"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "synapses_base_conhecimento_id_fkey"
            columns: ["base_conhecimento_id"]
            isOneToOne: false
            referencedRelation: "base_conhecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synapses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          active: boolean | null
          change_conversation_status:
            | Database["public"]["Enums"]["conversation_status_enum"]
            | null
          color: string
          created_at: string
          id: string
          id_neurocore: string | null
          is_category: boolean | null
          order_index: number
          prompt_to_ai: string | null
          tag_name: string
          tag_type: Database["public"]["Enums"]["tag_type"] | null
        }
        Insert: {
          active?: boolean | null
          change_conversation_status?:
            | Database["public"]["Enums"]["conversation_status_enum"]
            | null
          color?: string
          created_at?: string
          id?: string
          id_neurocore?: string | null
          is_category?: boolean | null
          order_index?: number
          prompt_to_ai?: string | null
          tag_name: string
          tag_type?: Database["public"]["Enums"]["tag_type"] | null
        }
        Update: {
          active?: boolean | null
          change_conversation_status?:
            | Database["public"]["Enums"]["conversation_status_enum"]
            | null
          color?: string
          created_at?: string
          id?: string
          id_neurocore?: string | null
          is_category?: boolean | null
          order_index?: number
          prompt_to_ai?: string | null
          tag_name?: string
          tag_type?: Database["public"]["Enums"]["tag_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_id_neurocore_fkey"
            columns: ["id_neurocore"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_reactivation_rules: {
        Row: {
          action_parameter: string | null
          action_type: Database["public"]["Enums"]["reactivation_action_type"]
          created_at: string
          end_time: string | null
          id: string
          sequence: number
          start_time: string | null
          tenant_id: string
          updated_at: string
          wait_time_minutes: number
        }
        Insert: {
          action_parameter?: string | null
          action_type: Database["public"]["Enums"]["reactivation_action_type"]
          created_at?: string
          end_time?: string | null
          id?: string
          sequence?: number
          start_time?: string | null
          tenant_id: string
          updated_at?: string
          wait_time_minutes: number
        }
        Update: {
          action_parameter?: string | null
          action_type?: Database["public"]["Enums"]["reactivation_action_type"]
          created_at?: string
          end_time?: string | null
          id?: string
          sequence?: number
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
          wait_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_reactivation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cnpj: string
          created_at: string
          ia_active: boolean | null
          id: string
          is_active: boolean
          master_integration_active: boolean
          name: string
          neurocore_id: string
          niche_id: string | null
          phone: string
          plan: string
          responsible_finance_email: string
          responsible_finance_name: string
          responsible_finance_whatsapp: string
          responsible_tech_email: string
          responsible_tech_name: string
          responsible_tech_whatsapp: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          ia_active?: boolean | null
          id?: string
          is_active?: boolean
          master_integration_active?: boolean
          name: string
          neurocore_id: string
          niche_id?: string | null
          phone: string
          plan: string
          responsible_finance_email: string
          responsible_finance_name: string
          responsible_finance_whatsapp: string
          responsible_tech_email: string
          responsible_tech_name: string
          responsible_tech_whatsapp: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          ia_active?: boolean | null
          id?: string
          is_active?: boolean
          master_integration_active?: boolean
          name?: string
          neurocore_id?: string
          niche_id?: string | null
          phone?: string
          plan?: string
          responsible_finance_email?: string
          responsible_finance_name?: string
          responsible_finance_whatsapp?: string
          responsible_tech_email?: string
          responsible_tech_name?: string
          responsible_tech_whatsapp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_neurocore_id_fkey"
            columns: ["neurocore_id"]
            isOneToOne: false
            referencedRelation: "neurocores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      usages: {
        Row: {
          created_at: string
          execution_id: number | null
          id: number
          id_agent: string | null
          id_contact: string | null
          id_conversation: string | null
          id_tenant: string | null
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          total_tokens: number | null
          usage_type: Database["public"]["Enums"]["usage_types"] | null
          workflow_id: string | null
        }
        Insert: {
          created_at?: string
          execution_id?: number | null
          id?: number
          id_agent?: string | null
          id_contact?: string | null
          id_conversation?: string | null
          id_tenant?: string | null
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          total_tokens?: number | null
          usage_type?: Database["public"]["Enums"]["usage_types"] | null
          workflow_id?: string | null
        }
        Update: {
          created_at?: string
          execution_id?: number | null
          id?: number
          id_agent?: string | null
          id_contact?: string | null
          id_conversation?: string | null
          id_tenant?: string | null
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          total_tokens?: number | null
          usage_type?: Database["public"]["Enums"]["usage_types"] | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usages_id_agent_fkey"
            columns: ["id_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usages_id_contact_fkey"
            columns: ["id_contact"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usages_id_conversation_fkey"
            columns: ["id_conversation"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usages_id_tenant_fkey"
            columns: ["id_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ai_paused: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invite_code: string | null
          is_active: boolean
          last_sign_in_at: string | null
          modules: string[]
          role: Database["public"]["Enums"]["access_user_role"]
          tenant_id: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          ai_paused?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          invite_code?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          modules?: string[]
          role?: Database["public"]["Enums"]["access_user_role"]
          tenant_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          ai_paused?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invite_code?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          modules?: string[]
          role?: Database["public"]["Enums"]["access_user_role"]
          tenant_id?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_data: {
        Args: {
          p_channel_id?: string
          p_days_ago?: number
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_funil_data: {
        Args: {
          p_channel_id?: string
          p_days_ago?: number
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_tags_data: {
        Args: {
          p_channel_id?: string
          p_days_ago?: number
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_user_tenant_id: { Args: never; Returns: string }
      increment_quick_reply_usage: {
        Args: { reply_id: string }
        Returns: undefined
      }
      match_base_conhecimentos: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_isp_cobertura: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      access_user_role: "super_admin" | "user"
      address_type:
        | "ESTADO"
        | "CIDADE"
        | "BAIRRO"
        | "CEP_FAIXA"
        | "CEP_UNICO"
        | "LOGRADOURO"
        | "CONDOMINIO"
        | "REGIAO"
      agent_function: "attendant" | "intention" | "in_guard_rails" | "observer"
      agent_function_enum:
        | "support"
        | "sales"
        | "after_sales"
        | "research"
        | "internal_system"
      agent_gender_enum: "male" | "female"
      agent_type_enum: "in_guard_rails" | "intention" | "attendant" | "observer"
      contact_status_enum: "open" | "with_ai" | "paused" | "closed"
      conversation_status_enum: "open" | "closed"
      feedback_process_status_enum: "open" | "in_progress" | "closed"
      feedback_type_enum: "like" | "dislike"
      message_sender_type_enum: "customer" | "attendant" | "ai" | "channel"
      message_status: "pending" | "sent" | "failed" | "read"
      reactivation_action_type:
        | "transfer_to_human"
        | "send_message"
        | "send_audio"
        | "close_conversation"
      reason_type_enum: "pause" | "closure"
      synapse_status_enum: "draft" | "indexing" | "publishing" | "error"
      tag_type: "description" | "success" | "fail"
      usage_types:
        | "text"
        | "audio_send"
        | "audio_listen"
        | "file_extract_data"
        | "image_extract_data"
        | "analisys"
        | "guard_rails"
        | "intention"
        | "parser_out"
        | "aux_tools"
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
      access_user_role: ["super_admin", "user"],
      address_type: [
        "ESTADO",
        "CIDADE",
        "BAIRRO",
        "CEP_FAIXA",
        "CEP_UNICO",
        "LOGRADOURO",
        "CONDOMINIO",
        "REGIAO",
      ],
      agent_function: ["attendant", "intention", "in_guard_rails", "observer"],
      agent_function_enum: [
        "support",
        "sales",
        "after_sales",
        "research",
        "internal_system",
      ],
      agent_gender_enum: ["male", "female"],
      agent_type_enum: ["in_guard_rails", "intention", "attendant", "observer"],
      contact_status_enum: ["open", "with_ai", "paused", "closed"],
      conversation_status_enum: ["open", "closed"],
      feedback_process_status_enum: ["open", "in_progress", "closed"],
      feedback_type_enum: ["like", "dislike"],
      message_sender_type_enum: ["customer", "attendant", "ai", "channel"],
      message_status: ["pending", "sent", "failed", "read"],
      reactivation_action_type: [
        "transfer_to_human",
        "send_message",
        "send_audio",
        "close_conversation",
      ],
      reason_type_enum: ["pause", "closure"],
      synapse_status_enum: ["draft", "indexing", "publishing", "error"],
      tag_type: ["description", "success", "fail"],
      usage_types: [
        "text",
        "audio_send",
        "audio_listen",
        "file_extract_data",
        "image_extract_data",
        "analisys",
        "guard_rails",
        "intention",
        "parser_out",
        "aux_tools",
      ],
    },
  },
} as const
