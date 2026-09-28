import { randomUUID } from 'node:crypto'

const modulePath = process.env.OPENCLAW_GATEWAY_CLIENT_MODULE
  || '/opt/homebrew/lib/node_modules/openclaw/dist/gateway-chat-C7bhNw-W.js'
const { GatewayChatClient } = await import(modulePath)

function write(event, data = {}) {
  process.stdout.write(`${JSON.stringify({ event, data })}\n`)
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      input += chunk
    })
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(input || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    process.stdin.on('error', reject)
  })
}

function textFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return ''
  const message = payload.message
  if (typeof message === 'string') return message
  if (message && typeof message === 'object') {
    for (const key of ['content', 'text', 'reply']) {
      if (typeof message[key] === 'string') return message[key]
    }
  }
  const data = payload.data
  if (data && typeof data === 'object') {
    for (const key of ['text', 'delta', 'content']) {
      if (typeof data[key] === 'string') return data[key]
    }
  }
  return ''
}

function textFromMessage(message) {
  if (!message || typeof message !== 'object') return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && typeof item.text === 'string') return item.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function emitText(text) {
  if (!text || text === lastText) return
  if (text.startsWith(lastText)) {
    const delta = text.slice(lastText.length)
    if (delta) write('token', { text: delta })
  } else {
    write('token', { text })
  }
  lastText = text
}

function statusFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.state === 'string') return payload.state
  if (typeof payload.status === 'string') return payload.status
  return null
}

const request = await readStdin()
const runId = request.runId || randomUUID()
const sessionKey = request.sessionKey
const message = request.message
const timeoutMs = Number(request.timeoutMs || 120000)
const agentId = request.agentId || undefined
const model = request.model || undefined

if (!sessionKey || !message) {
  write('error', { message: 'sessionKey and message are required' })
  process.exit(2)
}

let client
let settled = false
let lastText = ''
let finalSeen = false

function finish(code = 0) {
  if (settled) return
  settled = true
  client?.stop?.()
  process.exit(code)
}

process.on('SIGTERM', async () => {
  try {
    await client?.abortChat?.({ sessionKey, agentId, runId })
    write('status', { status: 'cancelled', label: 'Остановлено' })
  } catch {
    // Process termination is already the fallback cancellation path.
  } finally {
    finish(130)
  }
})

try {
  const connectOptions = {}
  if (process.env.OPENCLAW_GATEWAY_URL) connectOptions.url = process.env.OPENCLAW_GATEWAY_URL
  if (process.env.OPENCLAW_GATEWAY_TOKEN) connectOptions.token = process.env.OPENCLAW_GATEWAY_TOKEN
  if (process.env.OPENCLAW_GATEWAY_PASSWORD) connectOptions.password = process.env.OPENCLAW_GATEWAY_PASSWORD
  client = await GatewayChatClient.connect(connectOptions)

  client.onEvent = (evt) => {
    if (evt.event !== 'chat') return
    const payload = evt.payload || {}
    if (payload.runId && payload.runId !== runId) return

    const status = statusFromPayload(payload)
    if (status && status !== 'delta') {
      write('status', { status, label: status })
    }

    const text = textFromPayload(payload)
    if (text && text !== lastText) {
      emitText(text)
    }

    if (payload.stream === 'tool' && payload.data && typeof payload.data === 'object') {
      write('tool', {
        name: payload.data.name,
        phase: payload.data.phase,
        status: payload.data.status,
      })
    }

    if (status === 'final') {
      finalSeen = true
    }
    if (status === 'error' || status === 'aborted') {
      write('error', { message: payload.errorMessage || `OpenClaw ${status}` })
      finish(1)
    }
  }

  client.onDisconnected = (reason) => {
    if (!settled) {
      write('error', { message: reason || 'OpenClaw gateway disconnected' })
      finish(1)
    }
  }

  client.start()
  await client.waitForReady()
  write('run', { run_id: runId, provider: 'openclaw_gateway' })
  write('status', { status: 'connected', label: 'OpenClaw connected' })

  await client.sendChat({
    sessionKey,
    agentId,
    runId,
    message,
    model,
    timeoutMs,
    deliver: false,
  })

  const result = await client.client.request('agent.wait', { runId, timeoutMs }, { timeoutMs: timeoutMs + 5000 })
  if (!settled) {
    const history = await client.loadHistory({ sessionKey, agentId, limit: 10 })
    const assistantMessages = Array.isArray(history?.messages)
      ? history.messages.filter((item) => item?.role === 'assistant')
      : []
    emitText(textFromMessage(assistantMessages.at(-1)))

    if (result?.status === 'completed' || result?.status === 'ok') {
      write('done', { ok: true })
      finish(0)
    }
    if (result?.status === 'timeout' && !finalSeen) {
      write('error', { message: 'OpenClaw gateway wait timed out' })
      finish(1)
    }
    if (result?.error) {
      write('error', { message: result.error })
      finish(1)
    }
    write('done', { ok: true, status: result?.status })
    finish(0)
  }
} catch (error) {
  write('error', { message: error instanceof Error ? error.message : String(error) })
  finish(1)
}
