export type Role = 'user' | 'assistant' | 'system'

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  is_pinned: boolean
}

export interface Message {
  id: string
  conversation_id: string
  role: Role
  content: string
  created_at: string
  metadata: Record<string, unknown>
}

export type ConnectionStatus = 'connected' | 'connecting' | 'offline' | 'error'
export type ThemeMode = 'light' | 'dark' | 'system'
export type AutonomyMode = 'chat_only' | 'ask_before_actions' | 'autonomous'
export type PermissionDecision = 'ALLOW' | 'ASK' | 'DENY'
export type AppView = 'chat' | 'tasks' | 'files' | 'settings'

export interface Attachment {
  id: string
  user_id: string
  conversation_id: string | null
  filename: string
  content_type: string
  size_bytes: number
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string
  status: string
  created_at: string
  updated_at: string
  result: string | null
}

export interface AgentRun {
  id: string
  user_id: string
  conversation_id: string | null
  task_id: string | null
  status: string
  autonomy_mode: AutonomyMode
  started_at: string
  completed_at: string | null
  current_step: string | null
  result: string | null
  error: string | null
}

export interface PermissionRule {
  category: string
  decision: PermissionDecision
}

export interface PermissionsState {
  autonomy_mode: AutonomyMode
  rules: PermissionRule[]
}

export interface AuditLog {
  id: string
  user_id: string
  agent_run_id: string | null
  tool_call_id: string | null
  timestamp: string
  tool_name: string | null
  action: string
  autonomy_mode: string | null
  permission_decision: string | null
  approval_required: boolean
  result: string | null
  error: string | null
}

export interface Approval {
  id: string
  agent_run_id: string
  tool_call_id: string | null
  title: string
  description: string
  status: string
  created_at: string
  decided_at: string | null
}

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  body: string
  level: 'info' | 'success' | 'warning' | 'error' | string
  source: string
  read_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}
