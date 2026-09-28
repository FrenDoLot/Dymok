import type { AutonomyMode } from '../types'

const labels: Record<AutonomyMode, string> = {
  chat_only: 'Chat only',
  ask_before_actions: 'Ask before actions',
  autonomous: 'Autonomous',
}

type Props = {
  value: AutonomyMode
  onChange: (value: AutonomyMode) => void
}

export function ModeSelector({ value, onChange }: Props) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
      <span className="shrink-0">Mode:</span>
      <select
        className={`min-w-0 rounded-lg border px-2 py-1 outline-none ${
          value === 'autonomous'
            ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
            : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
        }`}
        value={value}
        onChange={(event) => onChange(event.target.value as AutonomyMode)}
      >
        <option value="chat_only">{labels.chat_only}</option>
        <option value="ask_before_actions">{labels.ask_before_actions}</option>
        <option value="autonomous">{labels.autonomous}</option>
      </select>
    </label>
  )
}
