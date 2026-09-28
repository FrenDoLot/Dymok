import type {
  AgentRun,
  Approval,
  Attachment,
  AuditLog,
  AutonomyMode,
  Conversation,
  Message,
  NotificationItem,
  PermissionsState,
  Task,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),
  conversations: () => request<Conversation[]>('/api/conversations'),
  createConversation: (title = 'Новый чат') =>
    request<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  messages: (conversationId: string) => request<Message[]>(`/api/conversations/${conversationId}/messages`),
  stopChat: (runId: string) =>
    request<{ ok: boolean }>('/api/chat/stop', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId }),
    }),
  models: () => request<{ models: Array<{ id: string; name: string; provider: string }> }>('/api/models'),
  tools: () => request<{ tools: Array<{ id: string; name: string; safe: boolean }> }>('/api/tools'),
  attachments: (conversationId?: string | null) =>
    request<Attachment[]>(conversationId ? `/api/attachments?conversation_id=${conversationId}` : '/api/attachments'),
  attachmentDownloadUrl: (id: string) => `${API_BASE}/api/attachments/${id}/download`,
  uploadAttachment: async (file: File, conversationId?: string | null) => {
    const form = new FormData()
    form.append('file', file)
    const suffix = conversationId ? `?conversation_id=${conversationId}` : ''
    const response = await fetch(`${API_BASE}/api/attachments${suffix}`, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      throw new Error(`API ${response.status}: ${await response.text()}`)
    }
    return response.json() as Promise<Attachment>
  },
  tasks: () => request<Task[]>('/api/tasks'),
  createTask: (title: string, description = '') =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),
  cancelTask: (id: string) => request<Task>(`/api/tasks/${id}/cancel`, { method: 'POST' }),
  agentRuns: () => request<AgentRun[]>('/api/agent-runs'),
  stopAgentRun: (id: string) => request<{ ok: boolean }>(`/api/agent-runs/${id}/stop`, { method: 'POST' }),
  approvals: () => request<Approval[]>('/api/approvals'),
  approve: (id: string) => request<Approval>(`/api/approvals/${id}/approve`, { method: 'POST' }),
  reject: (id: string) => request<Approval>(`/api/approvals/${id}/reject`, { method: 'POST' }),
  permissions: () => request<PermissionsState>('/api/permissions'),
  updatePermissions: (payload: PermissionsState) =>
    request<PermissionsState>('/api/permissions', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  audit: () => request<AuditLog[]>('/api/audit?limit=50'),
  notifications: () => request<NotificationItem[]>('/api/notifications'),
  createTestNotification: () => request<NotificationItem>('/api/notifications/test', { method: 'POST' }),
  markNotificationRead: (id: string) => request<NotificationItem>(`/api/notifications/${id}/read`, { method: 'POST' }),
  savePushSubscription: (subscription: PushSubscriptionJSON) =>
    request<{ id: string }>('/api/push-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),
}

type StreamHandlers = {
  onMessage?: (message: Message) => void
  onRun?: (runId: string) => void
  onApproval?: (approval: Approval) => void
  onToken?: (token: string) => void
  onStatus?: (label: string) => void
  onError?: (message: string) => void
  signal?: AbortSignal
}

export async function streamChat(
  conversationId: string,
  content: string,
  autonomyMode: AutonomyMode,
  attachmentIds: string[],
  handlers: StreamHandlers,
) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, content, autonomy_mode: autonomyMode, attachment_ids: attachmentIds }),
    signal: handlers.signal,
  })

  if (!response.ok || !response.body) {
    throw new Error(`Stream failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const rawEvent of events) {
      const lines = rawEvent.split('\n')
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
      const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim()
      if (!event || !dataLine) continue
      const data = JSON.parse(dataLine)

      if (event === 'token') handlers.onToken?.(data.text ?? '')
      if (event === 'run') handlers.onRun?.(data.run_id ?? '')
      if (event === 'approval') handlers.onApproval?.(data.approval)
      if (event === 'status') handlers.onStatus?.(data.label ?? data.status ?? '')
      if (event === 'message') handlers.onMessage?.(data.message)
      if (event === 'error') handlers.onError?.(data.message ?? 'Ошибка streaming')
    }
  }
}
