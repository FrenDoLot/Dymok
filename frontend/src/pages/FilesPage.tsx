import { FileText, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../services/api'
import type { Attachment } from '../types'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FilesPage() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setAttachments(await api.attachments())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-[min(64rem,100%)] xl:max-w-5xl">
        <div className="mb-5 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Files</h1>
            <p className="text-sm text-zinc-500">Файлы, загруженные через чат.</p>
          </div>
          <button
            className="ml-auto grid size-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:text-zinc-50"
            onClick={() => void load()}
            title="Обновить"
            type="button"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {loading ? 'Загружаю...' : 'Пока нет файлов'}
          </div>
        ) : (
          <div className="grid gap-2">
            {attachments.map((attachment) => (
              <a
                className="flex min-h-14 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                href={api.attachmentDownloadUrl(attachment.id)}
                key={attachment.id}
                rel="noreferrer"
                target="_blank"
              >
                <div className="grid size-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <FileText size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{attachment.filename}</div>
                  <div className="text-xs text-zinc-500">
                    {attachment.content_type} · {formatSize(attachment.size_bytes)}
                  </div>
                </div>
                <div className="hidden shrink-0 text-xs text-zinc-500 sm:block">
                  {new Date(attachment.created_at).toLocaleString()}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
