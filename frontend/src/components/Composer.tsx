import { Paperclip, Send, Square, X } from 'lucide-react'
import { useRef, useState } from 'react'

import type { Attachment } from '../types'

type Props = {
  disabled: boolean
  isStreaming: boolean
  attachments: Attachment[]
  onSend: (content: string) => void
  onStop: () => void
  onAttach: (file: File) => void
  onRemoveAttachment: (id: string) => void
}

export function Composer({ disabled, isStreaming, attachments, onSend, onStop, onAttach, onRemoveAttachment }: Props) {
  const [value, setValue] = useState('')
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const next = value.trim()
    if (!next || disabled) return
    setValue('')
    onSend(next)
  }

  return (
    <div
      className="border-t border-zinc-200 bg-zinc-50/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 dark:border-zinc-800 dark:bg-zinc-950/75"
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        Array.from(event.dataTransfer.files).forEach(onAttach)
      }}
    >
      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-[min(56rem,calc(100vw-2rem))] flex-wrap gap-2 xl:max-w-4xl">
          {attachments.map((attachment) => (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              key={attachment.id}
            >
              <Paperclip size={13} />
              <span className="max-w-48 truncate">{attachment.filename}</span>
              <button
                className="rounded p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => onRemoveAttachment(attachment.id)}
                title="Убрать файл"
                type="button"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mx-auto flex max-w-[min(56rem,calc(100vw-2rem))] items-end gap-2 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm xl:max-w-4xl dark:border-zinc-800 dark:bg-zinc-900">
        <input
          className="hidden"
          accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.markdown,.csv,.json,.py,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.doc,.docx"
          multiple
          ref={fileInputRef}
          type="file"
          onChange={(event) => {
            Array.from(event.target.files ?? []).forEach(onAttach)
            event.currentTarget.value = ''
          }}
        />
        <button
          className="mb-1 grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          onClick={() => fileInputRef.current?.click()}
          title="Прикрепить файл"
          type="button"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={textareaRef}
          className="max-h-44 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          placeholder="Напиши Дымку..."
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          onPaste={(event) => {
            Array.from(event.clipboardData.files).forEach(onAttach)
          }}
        />
        {isStreaming ? (
          <button
            className="mb-1 grid size-9 place-items-center rounded-lg bg-red-600 text-white hover:bg-red-500"
            onClick={onStop}
            title="Stop generation"
            type="button"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            className="mb-1 grid size-9 place-items-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
            disabled={!value.trim() || disabled}
            onClick={submit}
            title="Send"
            type="button"
          >
            <Send size={16} />
          </button>
        )}
      </div>
      {dragging && <div className="mx-auto mt-2 max-w-3xl text-xs text-zinc-500">Отпусти файл, прикреплю к чату</div>}
    </div>
  )
}
