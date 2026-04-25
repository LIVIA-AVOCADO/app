export interface AgentOverview {
  id: string;
  full_name: string;
  avatar_url: string | null;
  availability_status: 'online' | 'busy' | 'offline';
  open_count: number;
}

export interface QueueConversation {
  id: string;
  last_message_at: string | null;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface OverviewStats {
  open_total: number;
  closed_today: number;
  unassigned_manual: number;
  ia_active: number;
}
