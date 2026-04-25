export type UraMode = 'direct' | 'ura' | 'intent_agent';
export type OutsideHoursAction = 'queue' | 'ai' | 'auto_reply' | 'reject';
export type ActionType =
  | 'assign_team'
  | 'assign_agent'
  | 'assign_percentage'
  | 'route_ai'
  | 'queue'
  | 'auto_reply';

export interface BusinessHourSlot {
  from: string;
  to: string;
}

export interface UraConfig {
  id: string;
  tenant_id: string;
  mode: UraMode;
  business_hours: Record<string, BusinessHourSlot | null>;
  outside_hours_action: OutsideHoursAction;
  outside_hours_message: string | null;
  updated_at: string;
}

export interface UraCondition {
  type: string;
  op: string;
  value: unknown;
}

export interface UraRule {
  id: string;
  tenant_id: string;
  name: string;
  priority: number;
  is_active: boolean;
  conditions: UraCondition[];
  action_type: ActionType;
  action_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
