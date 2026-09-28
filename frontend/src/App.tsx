import { Menu, Moon, Plus, Sun, SunMoon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { AgentActivity } from './components/AgentActivity'
import { ApprovalCard } from './components/ApprovalCard'
import { MessageBubble } from './components/MessageBubble'
import { ModeSelector } from './components/ModeSelector'
import { NotificationCenter } from './components/NotificationCenter'
import { Sidebar } from './components/Sidebar'
import { FilesPage } from './pages/FilesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { useChatStore } from './stores/chatStore'
import type { AppView } from './types'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('chat')
  const [draft, setDraft] = useState('')
  const {
    conversations,
    messages,
    activeConversationId,
    backendConnection,
    connection,
    isStreaming,
    streamStatus,
    error,
    theme,
    autonomyMode,
    activeRunId,
    pendingApprovals,
    pendingAttachments,
    load,
    newChat,
    selectConversation,
    sendMessage,
    stopStreaming,
    setTheme,
    setAutonomyMode,
    approve,
    reject,
    uploadAttachment,
    removePendingAttachment,
  } = useChatStore()

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark))
  }, [theme])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-100 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onNewChat={newChat}
        onSelect={selectConversation}
        activeView={activeView}
        onNavigate={setActiveView}
      />
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-black/35"
            onClick={() => setMobileSidebarOpen(false)}
            type="button"
          />
          <div className="relative z-10">
            <Sidebar
              mobile
              conversations={conversations}
              activeId={activeConversationId}
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              onNewChat={() => {
                setMobileSidebarOpen(false)
                setActiveView('chat')
                void newChat()
              }}
              onSelect={(id) => {
                setMobileSidebarOpen(false)
                setActiveView('chat')
                void selectConversation(id)
              }}
              activeView={activeView}
              onNavigate={(view) => {
                setMobileSidebarOpen(false)
                setActiveView(view)
              }}
            />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50/90 px-3 py-2 backdrop-blur sm:h-14 sm:py-0 lg:px-4 dark:border-zinc-800 dark:bg-zinc-950/85">
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            title="Открыть меню"
            type="button"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0 flex-1 md:flex-none">
            <div className="truncate text-sm font-semibold sm:max-w-[38vw] lg:max-w-[44rem]">
              {activeConversation?.title ?? 'Dymok'}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 sm:gap-3">
              <span className="truncate">Backend: {backendConnection}</span>
              <span className="hidden sm:inline">Stream: {connection}</span>
            </div>
          </div>
          <div className="ml-auto hidden md:block">
            <ModeSelector value={autonomyMode} onChange={(mode) => void setAutonomyMode(mode)} />
          </div>
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 md:hidden"
            onClick={newChat}
            type="button"
            title="Новый чат"
          >
            <Plus size={18} />
          </button>
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            onClick={() => setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system')}
            title="Theme"
            type="button"
          >
            {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <SunMoon size={18} />}
          </button>
          <NotificationCenter />
        </header>

        {activeView === 'chat' && (
          <>
            <section className="min-h-0 flex-1 overflow-y-auto">
              {error && (
                <div className="mx-auto mt-4 max-w-[min(64rem,calc(100vw-2rem))] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </div>
              )}
              <div className="mx-auto mt-3 max-w-[min(64rem,calc(100vw-2rem))] px-0 md:hidden">
                <ModeSelector value={autonomyMode} onChange={(mode) => void setAutonomyMode(mode)} />
              </div>
              <AgentActivity active={isStreaming} runId={activeRunId} status={streamStatus} />
              {pendingApprovals.some((approval) => approval.status === 'pending') && (
                <div className="mx-auto mt-3 grid max-w-[min(64rem,calc(100vw-2rem))] gap-2 px-0">
                  {pendingApprovals
                    .filter((approval) => approval.status === 'pending')
                    .map((approval) => (
                      <ApprovalCard
                        approval={approval}
                        key={approval.id}
                        onApprove={(id) => void approve(id)}
                        onReject={(id) => void reject(id)}
                      />
                    ))}
                </div>
              )}
              {messages.length === 0 ? (
                <EmptyState
                  onPick={(value) => {
                    setDraft(value)
                    void sendMessage(value)
                  }}
                />
              ) : (
                <div className="mx-auto flex max-w-[min(64rem,calc(100vw-2rem))] flex-col gap-4 px-0 py-5 sm:gap-5 sm:py-6 xl:max-w-5xl">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} onRetry={() => sendMessage(message.content)} />
                  ))}
                </div>
              )}
            </section>

            <Composer
              attachments={pendingAttachments}
              disabled={backendConnection === 'error'}
              isStreaming={isStreaming}
              onAttach={(file) => void uploadAttachment(file)}
              onRemoveAttachment={removePendingAttachment}
              onSend={(content) => {
                setDraft('')
                void sendMessage(content)
              }}
              onStop={stopStreaming}
            />
          </>
        )}
        {activeView === 'tasks' && <TasksPage />}
        {activeView === 'files' && <FilesPage />}
        {activeView === 'settings' && <SettingsPage />}
        <input className="hidden" readOnly value={draft} aria-hidden />
      </main>
    </div>
  )
}

export default App
