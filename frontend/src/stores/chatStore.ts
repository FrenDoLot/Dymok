import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api, streamChat } from '../services/api'
import type {
  Approval,
  Attachment,
  AutonomyMode,
  ConnectionStatus,
  Conversation,
  Message,
  PermissionRule,
  ThemeMode,
} from '../types'

type ChatState = {
  conversations: Conversation[]
  messages: Message[]
  activeConversationId: string | null
  connection: ConnectionStatus
  backendConnection: ConnectionStatus
  isStreaming: boolean
  streamText: string
  streamStatus: string
  error: string | null
  theme: ThemeMode
  autonomyMode: AutonomyMode
  permissionRules: PermissionRule[]
  abortController: AbortController | null
  activeRunId: string | null
  pendingApprovals: Approval[]
  pendingAttachments: Attachment[]
  load: () => Promise<void>
  newChat: () => Promise<void>
  selectConversation: (id: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  uploadAttachment: (file: File) => Promise<void>
  removePendingAttachment: (id: string) => void
  stopStreaming: () => void
  setTheme: (theme: ThemeMode) => void
  setAutonomyMode: (mode: AutonomyMode) => Promise<void>
  approve: (id: string) => Promise<void>
  reject: (id: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: [],
      activeConversationId: null,
      connection: 'offline',
      backendConnection: 'offline',
      isStreaming: false,
      streamText: '',
      streamStatus: '',
      error: null,
      theme: 'system',
      autonomyMode: 'ask_before_actions',
      permissionRules: [],
      abortController: null,
      activeRunId: null,
      pendingApprovals: [],
      pendingAttachments: [],

      async load() {
        set({ backendConnection: 'connecting', error: null })
        try {
          await api.health()
          const [conversations, permissions, approvals] = await Promise.all([
            api.conversations(),
            api.permissions(),
            api.approvals(),
          ])
          const activeConversationId = get().activeConversationId ?? conversations[0]?.id ?? null
          const messages = activeConversationId ? await api.messages(activeConversationId) : []
          set({
            conversations,
            activeConversationId,
            messages,
            backendConnection: 'connected',
            autonomyMode: permissions.autonomy_mode,
            permissionRules: permissions.rules,
            pendingApprovals: approvals.filter((approval) => approval.status === 'pending'),
          })
        } catch (error) {
          set({ backendConnection: 'error', error: error instanceof Error ? error.message : 'Ошибка загрузки' })
        }
      },

      async newChat() {
        const conversation = await api.createConversation()
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id,
          messages: [],
          streamText: '',
          error: null,
          pendingAttachments: [],
        }))
      },

      async selectConversation(id: string) {
        const messages = await api.messages(id)
        set({ activeConversationId: id, messages, streamText: '', error: null, pendingAttachments: [] })
      },

      async sendMessage(content: string) {
        const trimmed = content.trim()
        if (!trimmed || get().isStreaming) return

        let conversationId = get().activeConversationId
        if (!conversationId) {
          const conversation = await api.createConversation()
          conversationId = conversation.id
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id,
          }))
        }

        const controller = new AbortController()
        const temporaryAssistant: Message = {
          id: 'streaming',
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          metadata: {},
        }

        set((state) => ({
          isStreaming: true,
          streamText: '',
          streamStatus: 'Подключение...',
          connection: 'connecting',
          error: null,
          abortController: controller,
          messages: [...state.messages, temporaryAssistant],
        }))

        try {
          const pendingAttachments = get().pendingAttachments
          await streamChat(conversationId, trimmed, get().autonomyMode, pendingAttachments.map((item) => item.id), {
            signal: controller.signal,
            onMessage(message) {
              set((state) => {
                const shouldReplaceStreaming = message.role === 'assistant'
                const messages = shouldReplaceStreaming
                  ? state.messages.filter((item) => item.id !== 'streaming')
                  : state.messages
                const exists = messages.some((item) => item.id === message.id)
                return { messages: exists ? messages : [...messages, message] }
              })
            },
            onRun(runId) {
              set({ activeRunId: runId || null })
            },
            onApproval(approval) {
              set((state) => ({ pendingApprovals: [approval, ...state.pendingApprovals] }))
            },
            onToken(token) {
              set((state) => ({
                streamText: state.streamText + token,
                messages: state.messages.map((message) =>
                  message.id === 'streaming' ? { ...message, content: state.streamText + token } : message,
                ),
              }))
            },
            onStatus(label) {
              set({ streamStatus: label, connection: label === 'Готово' ? 'connected' : 'connecting' })
            },
            onError(message) {
              set({ error: message, connection: 'error' })
            },
          })
          const [conversations, approvals] = await Promise.all([api.conversations(), api.approvals()])
          set({
            conversations,
            pendingAttachments: [],
            pendingApprovals: approvals.filter((approval) => approval.status === 'pending'),
          })
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            set({ error: error instanceof Error ? error.message : 'Ошибка отправки', connection: 'error' })
          }
        } finally {
          set((state) => ({
            isStreaming: false,
            streamText: '',
            streamStatus: '',
            abortController: null,
            activeRunId: null,
            messages: state.messages.filter((message) => message.id !== 'streaming' || message.content.trim()),
          }))
        }
      },

      async uploadAttachment(file) {
        let conversationId = get().activeConversationId
        if (!conversationId) {
          const conversation = await api.createConversation()
          conversationId = conversation.id
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            activeConversationId: conversation.id,
          }))
        }
        const attachment = await api.uploadAttachment(file, conversationId)
        set((state) => ({ pendingAttachments: [...state.pendingAttachments, attachment] }))
      },

      removePendingAttachment(id) {
        set((state) => ({ pendingAttachments: state.pendingAttachments.filter((item) => item.id !== id) }))
      },

      stopStreaming() {
        const runId = get().activeRunId
        if (runId) {
          void api.stopChat(runId).catch(() => undefined)
        }
        get().abortController?.abort()
        set({ isStreaming: false, streamStatus: 'Остановлено', abortController: null, activeRunId: null })
      },

      setTheme(theme) {
        set({ theme })
      },

      async setAutonomyMode(mode) {
        const rules = get().permissionRules
        set({ autonomyMode: mode })
        try {
          const permissions = await api.updatePermissions({ autonomy_mode: mode, rules })
          set({ autonomyMode: permissions.autonomy_mode, permissionRules: permissions.rules })
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Ошибка сохранения режима' })
        }
      },

      async approve(id) {
        await api.approve(id)
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter((item) => item.id !== id),
        }))
      },

      async reject(id) {
        await api.reject(id)
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter((item) => item.id !== id),
        }))
      },
    }),
    {
      name: 'dymok-chat-store',
      partialize: (state) => ({ activeConversationId: state.activeConversationId, theme: state.theme }),
    },
  ),
)
