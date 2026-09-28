import { useEffect, useState } from 'react'

import { api } from '../services/api'
import type { AgentRun, AuditLog, PermissionDecision, PermissionsState } from '../types'

const decisions: PermissionDecision[] = ['ALLOW', 'ASK', 'DENY']

export function SettingsPage() {
  const [permissions, setPermissions] = useState<PermissionsState | null>(null)
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])

  const load = async () => {
    const [nextPermissions, nextRuns, nextAudit] = await Promise.all([
      api.permissions(),
      api.agentRuns(),
      api.audit(),
    ])
    setPermissions(nextPermissions)
    setRuns(nextRuns)
    setAudit(nextAudit)
  }

  useEffect(() => {
    void load()
  }, [])

  const updateDecision = (category: string, decision: PermissionDecision) => {
    if (!permissions) return
    const next = {
      ...permissions,
      rules: permissions.rules.map((rule) => (rule.category === category ? { ...rule, decision } : rule)),
    }
    setPermissions(next)
    void api.updatePermissions(next).then(setPermissions)
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto grid max-w-[min(68rem,100%)] gap-5 xl:max-w-6xl">
        <h1 className="text-xl font-semibold">Settings</h1>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Permissions</h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {permissions?.rules.map((rule) => (
              <div
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
                key={rule.category}
              >
                <div className="min-w-0 flex-1 text-sm font-medium">{rule.category.replaceAll('_', ' ')}</div>
                <div className="grid grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-50 p-1 sm:flex dark:border-zinc-800 dark:bg-zinc-950">
                  {decisions.map((decision) => (
                    <button
                      className={`min-h-8 rounded-md px-3 py-1 text-xs ${
                        rule.decision === decision
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                      key={decision}
                      onClick={() => updateDecision(rule.category, decision)}
                      type="button"
                    >
                      {decision}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Agent Runs</h2>
          <div className="grid gap-2">
            {runs.slice(0, 8).map((run) => (
              <div
                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                key={run.id}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium">{run.status}</span>
                  <span className="text-zinc-500">{run.autonomy_mode}</span>
                  <span className="text-zinc-500">{run.current_step}</span>
                </div>
                <div className="mt-1 truncate text-xs text-zinc-400">{run.id}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Activity</h2>
          <div className="grid gap-2">
            {audit.slice(0, 12).map((entry) => (
              <div
                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                key={entry.id}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="font-medium">{entry.action}</span>
                  {entry.tool_name && <span className="text-zinc-500">{entry.tool_name}</span>}
                  {entry.error && <span className="text-red-500">error</span>}
                </div>
                <div className="mt-1 text-xs text-zinc-400">{new Date(entry.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
