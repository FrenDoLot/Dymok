import { Bell, Check, RefreshCw, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from '../services/api'
import type { NotificationItem } from '../types'

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [busy, setBusy] = useState(false)
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications])

  const load = async () => {
    setNotifications(await api.notifications())
  }

  useEffect(() => {
    void load()
  }, [])

  const enablePush = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const registration = await navigator.serviceWorker?.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (subscription) {
      await api.savePushSubscription(subscription.toJSON())
    }
    await api.createTestNotification()
    await load()
  }

  return (
    <div className="relative">
      <button
        className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        onClick={() => setOpen((value) => !value)}
        title="Уведомления"
        type="button"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-30 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-80 sm:max-w-[calc(100vw-1rem)] dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="text-sm font-semibold">Notifications</div>
            <button
              className="ml-auto rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => void load()}
              title="Обновить"
              type="button"
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                setBusy(true)
                void enablePush().finally(() => setBusy(false))
              }}
              title="Включить уведомления"
              type="button"
            >
              <Send size={14} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-zinc-500">
                {busy ? 'Проверяю...' : 'Пока тихо'}
              </div>
            ) : (
              <div className="grid gap-1">
                {notifications.map((item) => (
                  <div
                    className="rounded-lg px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    key={item.id}
                  >
                    <div className="flex gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        {item.body && <div className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{item.body}</div>}
                        <div className="mt-1 text-[11px] text-zinc-400">{item.source}</div>
                      </div>
                      {!item.read_at && (
                        <button
                          className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          onClick={() => {
                            void api.markNotificationRead(item.id).then(load)
                          }}
                          title="Прочитано"
                          type="button"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
