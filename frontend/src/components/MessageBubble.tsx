import { Copy, Paperclip, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import type { Attachment, Message } from '../types'

type Props = {
  message: Message
  onRetry?: () => void
}

export function MessageBubble({ message, onRetry }: Props) {
  const isUser = message.role === 'user'
  const attachments = Array.isArray(message.metadata.attachments)
    ? (message.metadata.attachments as Attachment[])
    : []
  return (
    <article className={`group flex gap-2 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-900 text-sm text-white dark:bg-zinc-100 dark:text-zinc-950">
          Д
        </div>
      )}
      <div className={`max-w-[92%] sm:max-w-[82%] lg:max-w-[760px] xl:max-w-[820px] ${isUser ? 'order-1' : ''}`}>
        <div
          className={
            isUser
              ? 'break-words rounded-lg bg-zinc-900 px-4 py-3 text-sm leading-6 text-white dark:bg-zinc-100 dark:text-zinc-950'
              : 'markdown max-w-none break-words rounded-lg bg-white px-4 py-3 text-sm leading-6 shadow-sm dark:bg-zinc-900'
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || ' '}
            </ReactMarkdown>
          )}
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <span
                  className={`inline-flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                    isUser
                      ? 'bg-white/10 text-zinc-100 dark:bg-zinc-950/10 dark:text-zinc-700'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                  key={attachment.id}
                >
                  <Paperclip size={13} />
                  <span className="max-w-52 truncate">{attachment.filename}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={() => navigator.clipboard.writeText(message.content)}
            title="Copy"
            type="button"
          >
            <Copy size={14} />
          </button>
          {!isUser && (
            <button
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={onRetry}
              title="Retry"
              type="button"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
