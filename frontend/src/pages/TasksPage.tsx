import { Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../services/api'
import type { Task } from '../types'

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')

  const load = async () => {
    setTasks(await api.tasks())
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[min(64rem,100%)] xl:max-w-5xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <h1 className="text-xl font-semibold">Tasks</h1>
          <form
            className="flex min-w-0 gap-2 sm:ml-auto"
            onSubmit={(event) => {
              event.preventDefault()
              const next = title.trim()
              if (!next) return
              setTitle('')
              void api.createTask(next).then(load)
            }}
          >
            <input
              className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none sm:h-9 sm:w-72 sm:flex-none dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Новая задача"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button
              className="grid size-9 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              title="Создать задачу"
              type="submit"
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        <div className="grid gap-2">
          {tasks.map((task) => (
            <article
              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              key={task.id}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">{task.status}</div>
                </div>
                {!['completed', 'failed', 'cancelled'].includes(task.status) && (
                  <button
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                    onClick={() => void api.cancelTask(task.id).then(load)}
                    title="Отменить"
                    type="button"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
          {tasks.length === 0 && <div className="py-12 text-center text-sm text-zinc-500">Задач пока нет.</div>}
        </div>
      </div>
    </section>
  )
}
