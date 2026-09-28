import { Check, X } from 'lucide-react'

import type { Approval } from '../types'

type Props = {
  approval: Approval
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function ApprovalCard({ approval, onApprove, onReject }: Props) {
  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm shadow-sm dark:border-amber-900 dark:bg-amber-950/35">
      <div className="font-medium text-amber-950 dark:text-amber-100">{approval.title}</div>
      <div className="mt-1 line-clamp-3 text-amber-800 dark:text-amber-200">{approval.description}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          onClick={() => onApprove(approval.id)}
          type="button"
        >
          <Check size={14} />
          Разрешить
        </button>
        <button
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
          onClick={() => onReject(approval.id)}
          type="button"
        >
          <X size={14} />
          Отклонить
        </button>
      </div>
    </article>
  )
}
