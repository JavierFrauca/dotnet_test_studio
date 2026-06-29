import { spawn, ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { WebSocket } from 'ws'

export interface EngineCommand {
  command: string
  args: string[]
}

/** Lanza el sidecar .NET y habla con él por JSON-RPC sobre WebSocket loopback. */
export class EngineClient extends EventEmitter {
  private proc?: ChildProcess
  private ws?: WebSocket
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

  async start(cmd: EngineCommand): Promise<void> {
    const token = randomBytes(16).toString('hex')
    const proc = spawn(cmd.command, [...cmd.args, '--token', token, '--port', '0'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.proc = proc

    const addr = await new Promise<string>((resolve, reject) => {
      let buf = ''
      const onData = (d: Buffer) => {
        buf += d.toString()
        const m = buf.match(/DOTNETTEST_ENGINE_LISTENING (http:\/\/127\.0\.0\.1:\d+)/)
        if (m) {
          proc.stdout?.off('data', onData)
          resolve(m[1])
        }
      }
      proc.stdout?.on('data', onData)
      proc.stderr?.on('data', (d: Buffer) => this.emit('stderr', d.toString()))
      proc.on('exit', (code) => reject(new Error(`engine salió con código ${code}`)))
      setTimeout(() => reject(new Error('timeout arrancando el engine')), 30000)
    })

    const url = addr.replace('http://', 'ws://') + '/ws?token=' + token
    const ws = new WebSocket(url)
    this.ws = ws
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })
    ws.on('message', (data) => this.onMessage(data.toString()))
    ws.on('close', () => this.emit('closed'))
  }

  private onMessage(text: string): void {
    let msg: any
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    if (msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!
      this.pending.delete(msg.id)
      if (msg.error) p.reject(msg.error)
      else p.resolve(msg.result)
      return
    }
    if (msg.method) {
      const payload = Array.isArray(msg.params) ? msg.params[0] : msg.params
      this.emit('notify', msg.method, payload)
    }
  }

  call(method: string, params: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const ws = this.ws
      if (!ws || ws.readyState !== ws.OPEN) {
        reject(new Error('engine no conectado'))
        return
      }
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  stop(): void {
    try {
      this.ws?.close()
    } catch {
      /* noop */
    }
    try {
      this.proc?.kill()
    } catch {
      /* noop */
    }
  }
}
