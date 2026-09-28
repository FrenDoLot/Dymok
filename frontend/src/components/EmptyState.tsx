const actions = ['Найди информацию', 'Помоги с кодом', 'Создай задачу', 'Проанализируй файл']

type Props = {
  onPick: (value: string) => void
}

export function EmptyState({ onPick }: Props) {
  return (
    <div className="mx-auto grid min-h-[55dvh] max-w-[min(44rem,calc(100vw-2rem))] place-items-center px-0 py-10 text-center sm:py-14 lg:min-h-[62dvh]">
      <div className="mb-5 grid size-14 place-items-center rounded-lg bg-zinc-900 text-xl font-semibold text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950">
        Д
      </div>
      <h1 className="text-2xl font-semibold text-zinc-950 sm:text-3xl dark:text-zinc-50">Чем займёмся?</h1>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <button
            className="min-h-12 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            key={action}
            onClick={() => onPick(action)}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}
