import { Files, MessageSquare, PanelLeftClose, Plus, Search, Settings, SquareCheckBig } from 'lucide-react'
import clsx from 'clsx'

import type { Conversation } from '../types'
import type { AppView } from '../types'
import type { LucideIcon } from 'lucide-react'

type Props = {
  conversations: Conversation[]
  activeId: string | null
  collapsed: boolean
  onToggle: () => void
  onNewChat: () => void
  onSelect: (id: string) => void
  activeView: AppView
  onNavigate: (view: AppView) => void
  mobile?: boolean
}

export function Sidebar({
  conversations,
  activeId,
  collapsed,
  onToggle,
  onNewChat,
  onSelect,
  activeView,
  onNavigate,
  mobile = false,
}: Props) {
  const navigationItems: Array<[LucideIcon, string, AppView]> = [
    [MessageSquare, 'Chats', 'chat'],
    [SquareCheckBig, 'Tasks', 'tasks'],
    [Files, 'Files', 'files'],
    [Settings, 'Settings', 'settings'],
  ]
  const showTextClass = mobile ? 'block' : collapsed ? 'hidden' : 'hidden xl:block'
  const showPanelClass = mobile ? 'block' : collapsed ? 'hidden' : 'hidden xl:block'

  return (
    <aside
      className={clsx(
        'h-dvh shrink-0 border-r border-zinc-200 bg-zinc-50/95 p-3 transition-all dark:border-zinc-800 dark:bg-zinc-950/95',
        mobile ? 'flex w-80 max-w-[86vw] flex-col' : 'hidden md:flex md:flex-col',
        !mobile && (collapsed ? 'w-20' : 'md:w-20 xl:w-76'),
      )}
    >
      <div className="flex items-center gap-3 px-2 py-2 md:justify-center xl:justify-start">
        <div className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-lg text-white shadow-sm dark:bg-white dark:text-zinc-950">
          Д
        </div>
        {!collapsed && (
          <div className={clsx('min-w-0', showTextClass)}>
            <div className="font-semibold text-zinc-950 dark:text-zinc-50">Dymok</div>
            <div className="text-xs text-zinc-500">Mode: Chat only</div>
          </div>
        )}
        <button
          className={clsx(
            'ml-auto rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
            mobile ? 'block' : 'hidden xl:block',
          )}
          onClick={onToggle}
          title="Свернуть sidebar"
          type="button"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button
        className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        onClick={onNewChat}
        type="button"
        title="Новый чат"
      >
        <Plus size={17} />
        {!collapsed && <span className={showTextClass}>Новый чат</span>}
      </button>

      {!collapsed && (
        <label className={clsx('mt-3 h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900', showPanelClass, 'xl:flex')}>
          <Search size={16} />
          <input className="w-full bg-transparent outline-none" placeholder="Поиск" />
        </label>
      )}

      <nav className="mt-4 grid gap-1 text-sm text-zinc-600 dark:text-zinc-300">
        {navigationItems.map(([Icon, label, view]) => (
          <button
            className={clsx(
              'flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-left hover:bg-zinc-200 dark:hover:bg-zinc-800 xl:h-9 xl:justify-start',
              view === activeView && 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50',
            )}
            key={label}
            onClick={() => onNavigate(view)}
            type="button"
            title={label}
          >
            <Icon size={17} />
            {!collapsed && <span className={showTextClass}>{label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className={clsx('mt-5 min-h-0 flex-1', showPanelClass)}>
          <div className="mb-2 px-2 text-xs font-medium uppercase text-zinc-400">Chats</div>
          <div className="space-y-1 overflow-y-auto pr-1">
            {conversations.map((conversation) => (
              <button
                className={clsx(
                  'block w-full truncate rounded-lg px-3 py-2 text-left text-sm',
                  conversation.id === activeId
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800',
                )}
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                type="button"
              >
                {conversation.is_pinned ? 'Закреплено · ' : ''}
                {conversation.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
