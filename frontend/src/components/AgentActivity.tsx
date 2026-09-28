type Props = {
  runId: string | null
  status: string
  active: boolean
}

export function AgentActivity({ runId, status, active }: Props) {
  if (!active && !status) return null

  return (
    <div className="mx-auto mt-3 max-w-[min(64rem,calc(100vw-2rem))] px-0 xl:max-w-5xl">
      <details className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-zinc-700 dark:text-zinc-200">
          {active ? status || 'Дымок работает...' : status || 'Готово'}
        </summary>
        <div className="mt-2 grid gap-1 text-xs text-zinc-500">
          <span>AgentRun: {runId ?? 'pending'}</span>
        </div>
      </details>
    </div>
  )
}
