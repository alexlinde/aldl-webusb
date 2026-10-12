import { describe, expect, it } from 'vitest'
import {
  LineSplitter,
  LogFileFormat,
  NoteQueue,
  logFilename,
  pickPort,
  serializeEntry,
} from './captureCore'

describe('pickPort', () => {
  const ftdi = { path: '/dev/tty.usbserial-A1', vendorId: '0403', productId: '6001' }
  it('picks the single cable', () => {
    expect(pickPort([{ path: '/dev/tty.x' }, ftdi])).toEqual({ ok: true, path: ftdi.path })
  })
  it('accepts CP210x and CH340', () => {
    expect(pickPort([{ path: '/a', vendorId: '10C4' }]).ok).toBe(true)
    expect(pickPort([{ path: '/b', vendorId: '1a86' }]).ok).toBe(true)
  })
  it('fails on none, listing ports', () => {
    const r = pickPort([{ path: '/dev/tty.x' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('/dev/tty.x')
  })
  it('fails on several', () => {
    const r = pickPort([ftdi, { path: '/dev/tty.usbserial-B2', vendorId: '0403' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('Several')
  })
})

describe('serializeEntry and LogFileFormat', () => {
  const frame = Uint8Array.from({ length: 20 }, (_, i) => i)
  it('omits empty notes', () => {
    const e = JSON.parse(serializeEntry(frame, new Date(0)))
    expect(e).toEqual({ timestamp: '1970-01-01T00:00:00.000Z', frame: Array.from(frame) })
  })
  it('builds the exportLogBlob layout', () => {
    const f = new LogFileFormat()
    const a = serializeEntry(frame, new Date(0))
    const b = serializeEntry(frame, new Date(1000), 'x')
    const text = f.start() + f.append(a) + f.append(b) + f.end()
    expect(text).toBe(`[\n${a},\n${b}\n]\n`)
    expect(JSON.parse(text)[1].note).toBe('x')
  })
  it('empty log is valid JSON', () => {
    const f = new LogFileFormat()
    expect(JSON.parse(f.start() + f.end())).toEqual([])
  })
})

describe('NoteQueue / LineSplitter', () => {
  it('joins notes and clears', () => {
    const q = new NoteQueue()
    expect(q.add('  ')).toBeNull()
    q.add('a')
    q.add(' b ')
    expect(q.take()).toBe('a; b')
    expect(q.take()).toBeUndefined()
  })
  it('holds back partial lines', () => {
    const s = new LineSplitter()
    expect(s.push('one\ntw')).toEqual(['one'])
    expect(s.push('o\r\n')).toEqual(['two'])
  })
})

it('logFilename format', () => {
  expect(logFilename(new Date(2025, 3, 30, 19, 36, 19))).toBe('aldl_log_20250430_193619.json')
})
