import { ALDLProcessor } from './aldlProcessor'
import { SerialInterface } from './serialInterface'
import { FRAME_LENGTH, LogEntry, ProcessedFrame } from '../types/aldl'

/** How many frames the store keeps before dropping the oldest. */
export const MAX_HISTORY = 10000

export type ConnectionStatus =
  | 'unsupported'
  | 'disconnected'
  | 'connecting'
  | 'connected'

export type PlaybackSpeed = 1 | 5 | 'max'

export interface DataSnapshot {
  /** Oldest first, capped at MAX_HISTORY. */
  history: ProcessedFrame[]
  latest: ProcessedFrame | null
  connection: ConnectionStatus
  /** The loaded log file, if any. position = frames already played. */
  file: { name: string; frameCount: number; position: number } | null
  playback: { isPlaying: boolean; speed: PlaybackSpeed }
  /** Latest user-facing error message; null when there is none. */
  error: string | null
  framingErrors: number
}

/**
 * The single store the UI subscribes to, shaped for React's
 * useSyncExternalStore: getSnapshot() returns the same object until something
 * changes, and every change replaces the snapshot with a new one. Arrays and
 * objects already handed out in a snapshot are never mutated.
 */
export class DataService {
  private readonly listeners = new Set<() => void>()
  private snapshot: DataSnapshot
  /** Entries of the loaded log file; empty when nothing is loaded. */
  private entries: LogEntry[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly processor: ALDLProcessor,
    private readonly serial: SerialInterface,
  ) {
    this.snapshot = {
      history: [],
      latest: null,
      connection: serialSupported(serial) ? 'disconnected' : 'unsupported',
      file: null,
      playback: { isPlaying: false, speed: 1 },
      error: null,
      framingErrors: 0,
    }

    this.serial.onFrame = (frame, timestamp) => {
      this.appendFrame(frame, timestamp, {
        framingErrors: this.serial.framingErrors,
      })
    }
    this.serial.onDisconnect = (reason) => {
      this.update({
        connection: 'disconnected',
        error: reason,
        framingErrors: this.serial.framingErrors,
      })
    }
  }

  // --- store plumbing -----------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): DataSnapshot {
    return this.snapshot
  }

  private update(changes: Partial<DataSnapshot>): void {
    let changed = false
    for (const key of Object.keys(changes) as Array<keyof DataSnapshot>) {
      if (changes[key] !== this.snapshot[key]) {
        changed = true
        break
      }
    }
    if (!changed) return

    this.snapshot = { ...this.snapshot, ...changes }
    for (const listener of [...this.listeners]) listener()
  }

  // --- live serial --------------------------------------------------------

  async connect(options?: { anyDevice?: boolean }): Promise<void> {
    if (this.snapshot.file) {
      this.update({
        error: 'Close the log file before connecting to the vehicle.',
      })
      return
    }
    if (this.snapshot.connection === 'unsupported') {
      this.update({
        error:
          'This browser cannot talk to serial devices. Try Chrome, Edge or Opera on a desktop computer.',
      })
      return
    }

    this.update({ connection: 'connecting', error: null })
    try {
      const connected = await this.serial.connect(options)
      // A cancelled chooser is not an error; we simply stay disconnected.
      this.update({ connection: connected ? 'connected' : 'disconnected' })
    } catch (error) {
      this.update({
        connection: 'disconnected',
        error: messageOf(error, 'Could not connect to the cable.'),
      })
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.serial.disconnect()
    } catch (error) {
      this.update({
        error: messageOf(error, 'Could not close the serial port cleanly.'),
      })
    }
    this.update({ connection: 'disconnected' })
  }

  // --- log files ----------------------------------------------------------

  /**
   * Load a JSON log file (the format written by the python aldl-logger).
   * On an invalid file the error is reported and nothing else changes.
   */
  async loadFile(file: File): Promise<void> {
    let text: string
    try {
      text = await readFileText(file)
    } catch {
      this.update({ error: `Could not read ${file.name}.` })
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      this.update({ error: `${file.name} is not a valid JSON file.` })
      return
    }

    const entries = validateLog(parsed)
    if (!entries) {
      this.update({
        error: `${file.name} does not look like an ALDL log: it should be a list of entries with a timestamp and ${FRAME_LENGTH} frame bytes.`,
      })
      return
    }

    this.stopTimer()
    if (this.serial.isConnected()) {
      await this.disconnect()
    }

    this.entries = entries
    this.update({
      file: { name: file.name, frameCount: entries.length, position: 0 },
      playback: { isPlaying: false, speed: this.snapshot.playback.speed },
      error: null,
    })
  }

  /** Forget the loaded file (so a live connection is possible again). */
  clearFile(): void {
    this.stopTimer()
    this.entries = []
    this.update({
      file: null,
      playback: { isPlaying: false, speed: this.snapshot.playback.speed },
    })
  }

  play(): void {
    const file = this.snapshot.file
    if (!file || file.frameCount === 0) return

    if (file.position >= file.frameCount) this.rewind()

    this.update({
      playback: { isPlaying: true, speed: this.snapshot.playback.speed },
    })
    this.scheduleNext()
  }

  pause(): void {
    this.stopTimer()
    this.update({
      playback: { isPlaying: false, speed: this.snapshot.playback.speed },
    })
  }

  /** Emit the next frame, if there is one. */
  step(): void {
    this.emitNext()
  }

  rewind(): void {
    this.stopTimer()
    const file = this.snapshot.file
    this.update({
      file: file ? { ...file, position: 0 } : null,
      playback: { isPlaying: false, speed: this.snapshot.playback.speed },
    })
  }

  /** Takes effect on the next scheduled frame. */
  setSpeed(speed: PlaybackSpeed): void {
    this.update({
      playback: { isPlaying: this.snapshot.playback.isPlaying, speed },
    })
  }

  private scheduleNext(): void {
    this.stopTimer()
    const file = this.snapshot.file
    if (!file || !this.snapshot.playback.isPlaying) return
    if (file.position >= file.frameCount) return

    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.snapshot.playback.isPlaying) return
      if (this.emitNext()) this.scheduleNext()
    }, this.delayBefore(file.position))
  }

  /**
   * Milliseconds to wait before emitting the frame at `position`: the real
   * gap between it and the frame before it, divided by the playback speed.
   * 'max' plays as fast as setTimeout allows while still yielding to the UI.
   */
  private delayBefore(position: number): number {
    const speed = this.snapshot.playback.speed
    if (speed === 'max' || position <= 0) return 0

    const previous = entryTime(this.entries[position - 1])
    const next = entryTime(this.entries[position])
    if (!Number.isFinite(previous) || !Number.isFinite(next)) return 0
    return Math.max(0, (next - previous) / speed)
  }

  /** Emit the frame at the current position. Returns true if more remain. */
  private emitNext(): boolean {
    const file = this.snapshot.file
    if (!file || file.position >= file.frameCount) return false

    const entry = this.entries[file.position]
    const raw = Uint8Array.from(entry.frame)
    const nextPosition = file.position + 1
    const atEnd = nextPosition >= file.frameCount

    this.appendFrame(raw, entryTime(entry), {
      file: { ...file, position: nextPosition },
      playback: atEnd
        ? { isPlaying: false, speed: this.snapshot.playback.speed }
        : this.snapshot.playback,
    })

    if (atEnd) this.stopTimer()
    return !atEnd
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  // --- history ------------------------------------------------------------

  private appendFrame(
    raw: Uint8Array,
    timestamp: number,
    extra: Partial<DataSnapshot> = {},
  ): void {
    const frame: ProcessedFrame = {
      timestamp,
      raw,
      signals: this.processor.processFrame(raw),
    }

    const history = this.snapshot.history.concat(frame)
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY)
    }

    this.update({ ...extra, history, latest: frame })
  }

  clearHistory(): void {
    this.update({ history: [], latest: null })
  }

  clearError(): void {
    this.update({ error: null })
  }

  // --- saving -------------------------------------------------------------

  /** Everything in history, in the on-disk log format. */
  exportLog(): LogEntry[] {
    return this.snapshot.history.map((frame) => ({
      timestamp: new Date(frame.timestamp).toISOString(),
      frame: Array.from(frame.raw),
    }))
  }

  /** The same thing as a downloadable file, one entry per line. */
  exportLogBlob(): Blob {
    const entries = this.exportLog()
    const body = entries.map((entry) => JSON.stringify(entry)).join(',\n')
    const json = entries.length === 0 ? '[]' : `[\n${body}\n]`
    return new Blob([json], { type: 'application/json' })
  }

  /** aldl_log_YYYYMMDD_HHMMSS.json, named after the first frame in history. */
  suggestedLogFilename(): string {
    const first = this.snapshot.history[0]
    const date = new Date(first ? first.timestamp : Date.now())
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp =
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    return `aldl_log_${stamp}.json`
  }

  dispose(): void {
    this.stopTimer()
    this.serial.onFrame = null
    this.serial.onDisconnect = null
  }
}

/**
 * The python logger writes naive ISO timestamps without a zone, which browsers
 * parse as local time. That is what we want: the log is read back on the same
 * machine that recorded it, and only the deltas drive playback anyway.
 */
function entryTime(entry: LogEntry): number {
  return new Date(entry.timestamp).getTime()
}

function validateLog(parsed: unknown): LogEntry[] | null {
  if (!Array.isArray(parsed)) return null

  const entries: LogEntry[] = []
  for (const candidate of parsed) {
    if (typeof candidate !== 'object' || candidate === null) return null
    const entry = candidate as Partial<LogEntry>
    if (typeof entry.timestamp !== 'string') return null
    if (!Number.isFinite(new Date(entry.timestamp).getTime())) return null
    if (!Array.isArray(entry.frame) || entry.frame.length !== FRAME_LENGTH) {
      return null
    }
    for (const byte of entry.frame) {
      if (typeof byte !== 'number' || !Number.isInteger(byte)) return null
      if (byte < 0 || byte > 255) return null
    }
    entries.push({ timestamp: entry.timestamp, frame: entry.frame })
  }
  return entries
}

/** Web Serial support, read from the instance's class so stubs can report it. */
function serialSupported(serial: SerialInterface): boolean {
  const ctor = serial.constructor as { isSupported?: () => boolean }
  return typeof ctor.isSupported === 'function' ? ctor.isSupported() : true
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return await file.text()
  const buffer = await file.arrayBuffer()
  return new TextDecoder().decode(buffer)
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  const text = String(error ?? '')
  return text.length > 0 ? text : fallback
}
