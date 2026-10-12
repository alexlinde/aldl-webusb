import type { LogEntry } from '../types/aldl'

/** Serial baud rate that yields one UART byte per 160-baud ALDL bit. */
export const CAPTURE_BAUD = 1600

/** USB vendor ids of the supported cables: FTDI, Silicon Labs CP210x, WCH CH340. */
const CABLE_VENDOR_IDS = ['0403', '10c4', '1a86']

/** The subset of serialport's PortInfo that port picking needs. */
export interface PortLike {
  path: string
  vendorId?: string
  productId?: string
  manufacturer?: string
}

export type PickResult =
  | { ok: true; path: string }
  | { ok: false; message: string }

function describePort(p: PortLike): string {
  const id = p.vendorId ? ` [${p.vendorId}:${p.productId ?? '????'}]` : ''
  return `  ${p.path}${id}${p.manufacturer ? ` ${p.manufacturer}` : ''}`
}

/** Pick the single supported USB-serial cable from a port list, or explain why not. */
export function pickPort(ports: PortLike[]): PickResult {
  const cables = ports.filter(
    (p) => p.vendorId && CABLE_VENDOR_IDS.includes(p.vendorId.toLowerCase()),
  )
  if (cables.length === 1) return { ok: true, path: cables[0].path }
  const listing = ports.length ? ports.map(describePort).join('\n') : '  (none)'
  const problem =
    cables.length === 0
      ? 'No FTDI / CP210x / CH340 serial device found.'
      : 'Several supported serial devices found.'
  return {
    ok: false,
    message: `${problem} Pass --port <path>. Available ports:\n${listing}`,
  }
}

/** One log entry as a single JSON line; `note` is omitted when empty. */
export function serializeEntry(
  frame: Uint8Array | number[],
  timestamp: Date,
  note?: string,
): string {
  const entry: LogEntry = { timestamp: timestamp.toISOString(), frame: Array.from(frame) }
  if (note) entry.note = note
  return JSON.stringify(entry)
}

/**
 * Incremental writer for the exportLogBlob format: `[\n`, entries joined by
 * `,\n`, then `\n]\n`. Every chunk leaves a file that is valid once closed.
 */
export class LogFileFormat {
  private count = 0

  start(): string {
    return '[\n'
  }

  append(entryJson: string): string {
    return (this.count++ === 0 ? '' : ',\n') + entryJson
  }

  end(): string {
    return '\n]\n'
  }
}

/** Notes waiting to be attached to the next frame. */
export class NoteQueue {
  private pending: string[] = []

  /** Queue a note; blank text is ignored. Returns the trimmed text or null. */
  add(text: string): string | null {
    const t = text.trim()
    if (!t) return null
    this.pending.push(t)
    return t
  }

  /** Take all queued notes joined with '; ', or undefined if none. */
  take(): string | undefined {
    if (this.pending.length === 0) return undefined
    const note = this.pending.join('; ')
    this.pending = []
    return note
  }
}

/** Splits a text stream into complete lines, holding back a partial tail. */
export class LineSplitter {
  private tail = ''

  push(chunk: string): string[] {
    const parts = (this.tail + chunk).split(/\r?\n/)
    this.tail = parts.pop() ?? ''
    return parts
  }
}

/** aldl_log_YYYYMMDD_HHMMSS.json in local time. */
export function logFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `aldl_log_${stamp}.json`
}
