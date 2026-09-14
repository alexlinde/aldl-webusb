import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALDLProcessor } from './aldlProcessor'
import { DataService, MAX_HISTORY } from './dataService'
import { SerialInterface } from './serialInterface'
import { FRAME_LENGTH, LogEntry } from '../types/aldl'
import log from '../../test/aldl_log_20250430_193619.json'

const ENTRIES: LogEntry[] = log.slice(0, 10)

/** Stands in for SerialInterface: no Web Serial in the test environment. */
class StubSerial {
  static isSupported(): boolean {
    return true
  }

  onFrame: ((frame: Uint8Array, timestamp: number) => void) | null = null
  onDisconnect: ((reason: string) => void) | null = null
  framingErrors = 0
  connectResult: boolean = true
  connectError: Error | null = null
  disconnectCalls = 0
  private connected = false

  async connect(): Promise<boolean> {
    if (this.connectError) throw this.connectError
    this.connected = this.connectResult
    return this.connectResult
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls++
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }
}

function makeService(): { service: DataService; serial: StubSerial } {
  const serial = new StubSerial()
  const service = new DataService(
    new ALDLProcessor(),
    serial as unknown as SerialInterface,
  )
  return { service, serial }
}

function makeFile(entries: unknown, name = 'log.json'): File {
  return new File([JSON.stringify(entries)], name, {
    type: 'application/json',
  })
}

const gap = (a: number, b: number) =>
  new Date(ENTRIES[b].timestamp).getTime() -
  new Date(ENTRIES[a].timestamp).getTime()

describe('DataService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts empty and notifies subscribers on change', async () => {
    const { service, serial } = makeService()
    const snapshot = service.getSnapshot()
    expect(snapshot.history).toEqual([])
    expect(snapshot.latest).toBeNull()
    expect(snapshot.connection).toBe('disconnected')
    expect(snapshot.file).toBeNull()
    expect(snapshot.playback).toEqual({ isPlaying: false, speed: 1 })
    expect(service.getSnapshot()).toBe(snapshot)

    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)
    await service.loadFile(makeFile(ENTRIES))
    expect(listener).toHaveBeenCalled()
    expect(service.getSnapshot()).not.toBe(snapshot)

    unsubscribe()
    const before = service.getSnapshot()
    service.step()
    expect(service.getSnapshot()).not.toBe(before)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(serial.disconnectCalls).toBe(0)
  })

  it('loads a log file and steps through it', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))

    expect(service.getSnapshot().file).toEqual({
      name: 'log.json',
      frameCount: ENTRIES.length,
      position: 0,
    })
    expect(service.getSnapshot().error).toBeNull()

    service.step()
    const { history, latest, file } = service.getSnapshot()
    expect(file?.position).toBe(1)
    expect(history).toHaveLength(1)
    expect(latest?.raw).toEqual(Uint8Array.from(ENTRIES[0].frame))
    expect(latest?.timestamp).toBe(new Date(ENTRIES[0].timestamp).getTime())
    expect(latest?.signals.length).toBeGreaterThan(0)
    expect(history[0]).toBe(latest)
  })

  it('plays with real timing, pauses and rewinds', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))

    service.play()
    expect(service.getSnapshot().playback.isPlaying).toBe(true)

    await vi.advanceTimersByTimeAsync(0)
    expect(service.getSnapshot().history).toHaveLength(1)

    // The next frame is about 1.19 s later in the log.
    await vi.advanceTimersByTimeAsync(gap(0, 1) - 1)
    expect(service.getSnapshot().history).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(service.getSnapshot().history).toHaveLength(2)

    service.pause()
    expect(service.getSnapshot().playback.isPlaying).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(service.getSnapshot().history).toHaveLength(2)
    expect(service.getSnapshot().file?.position).toBe(2)

    service.rewind()
    expect(service.getSnapshot().file?.position).toBe(0)
    expect(service.getSnapshot().playback.isPlaying).toBe(false)
    expect(service.getSnapshot().history).toHaveLength(2)
  })

  it('plays faster at speed 5 and flat out at max', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.setSpeed(5)
    expect(service.getSnapshot().playback.speed).toBe(5)

    service.play()
    await vi.advanceTimersByTimeAsync(0)
    expect(service.getSnapshot().history).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(gap(0, 1) / 5)
    expect(service.getSnapshot().history).toHaveLength(2)

    service.pause()
    service.rewind()
    service.clearHistory()
    service.setSpeed('max')
    service.play()
    // 'max' still yields between frames: one timer tick per frame.
    await vi.runAllTimersAsync()
    expect(service.getSnapshot().history).toHaveLength(ENTRIES.length)
  })

  it('stops playing at the end of the file and rewinds on replay', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.setSpeed('max')
    service.play()
    await vi.runAllTimersAsync()

    const snapshot = service.getSnapshot()
    expect(snapshot.playback.isPlaying).toBe(false)
    expect(snapshot.file?.position).toBe(ENTRIES.length)
    expect(snapshot.history).toHaveLength(ENTRIES.length)

    // A step at the end does nothing.
    service.step()
    expect(service.getSnapshot()).toBe(snapshot)

    // Play again rewinds first.
    service.play()
    expect(service.getSnapshot().file?.position).toBe(0)
    await vi.runAllTimersAsync()
    expect(service.getSnapshot().history).toHaveLength(ENTRIES.length * 2)
  })

  it('clears the file, history and errors', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.step()

    service.clearFile()
    expect(service.getSnapshot().file).toBeNull()
    expect(service.getSnapshot().history).toHaveLength(1)

    service.clearHistory()
    expect(service.getSnapshot().history).toEqual([])
    expect(service.getSnapshot().latest).toBeNull()

    await service.loadFile(makeFile('nonsense'))
    expect(service.getSnapshot().error).toContain('log.json')
    service.clearError()
    expect(service.getSnapshot().error).toBeNull()
  })

  it('rejects an invalid file without changing anything', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.step()
    const before = service.getSnapshot()

    const badCases: unknown[] = [
      { not: 'an array' },
      [{ timestamp: ENTRIES[0].timestamp, frame: [1, 2, 3] }],
      [{ timestamp: 'not a date', frame: ENTRIES[0].frame }],
      [{ frame: ENTRIES[0].frame }],
      [{ timestamp: ENTRIES[0].timestamp, frame: new Array(FRAME_LENGTH).fill(300) }],
    ]

    for (const bad of badCases) {
      await service.loadFile(makeFile(bad, 'bad.json'))
      const after = service.getSnapshot()
      expect(after.error).toBeTruthy()
      expect(after.file).toEqual(before.file)
      expect(after.history).toBe(before.history)
      service.clearError()
    }

    // Not JSON at all.
    await service.loadFile(new File(['{oops'], 'bad.json'))
    expect(service.getSnapshot().error).toContain('valid JSON')
  })

  it('appends live frames and reports a lost connection', async () => {
    const { service, serial } = makeService()
    await service.connect()
    expect(service.getSnapshot().connection).toBe('connected')
    expect(serial.isConnected()).toBe(true)

    serial.framingErrors = 3
    serial.onFrame?.(Uint8Array.from(ENTRIES[0].frame), 1_000)
    const snapshot = service.getSnapshot()
    expect(snapshot.history).toHaveLength(1)
    expect(snapshot.latest?.timestamp).toBe(1_000)
    expect(snapshot.framingErrors).toBe(3)

    serial.onDisconnect?.('The cable was unplugged.')
    expect(service.getSnapshot().connection).toBe('disconnected')
    expect(service.getSnapshot().error).toBe('The cable was unplugged.')
    expect(service.getSnapshot().history).toHaveLength(1)
  })

  it('treats a cancelled chooser as a non-event and reports real failures', async () => {
    const { service, serial } = makeService()
    serial.connectResult = false
    await service.connect()
    expect(service.getSnapshot().connection).toBe('disconnected')
    expect(service.getSnapshot().error).toBeNull()

    serial.connectError = new Error(
      'Could not open the serial port. Is another program using it?',
    )
    await service.connect()
    expect(service.getSnapshot().connection).toBe('disconnected')
    expect(service.getSnapshot().error).toBe(
      'Could not open the serial port. Is another program using it?',
    )
  })

  it('disconnects the cable when a file is loaded', async () => {
    const { service, serial } = makeService()
    await service.connect()
    await service.loadFile(makeFile(ENTRIES))
    expect(serial.disconnectCalls).toBe(1)
    expect(service.getSnapshot().connection).toBe('disconnected')

    // Connecting is refused while a file is loaded, and possible again after.
    await service.connect()
    expect(service.getSnapshot().connection).toBe('disconnected')
    expect(service.getSnapshot().error).toBeTruthy()

    service.clearFile()
    service.clearError()
    await service.connect()
    expect(service.getSnapshot().connection).toBe('connected')
  })

  it('caps history at MAX_HISTORY, dropping the oldest', () => {
    const { service, serial } = makeService()
    const frame = Uint8Array.from(ENTRIES[0].frame)
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      serial.onFrame?.(frame, 1_000 + i)
    }
    const { history, latest } = service.getSnapshot()
    expect(history).toHaveLength(MAX_HISTORY)
    expect(history[0].timestamp).toBe(1_005)
    expect(latest?.timestamp).toBe(1_000 + MAX_HISTORY + 4)
  })

  it('exports a log that loads back in unchanged', async () => {
    const { service } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.setSpeed('max')
    service.play()
    await vi.runAllTimersAsync()

    const exported = service.exportLog()
    expect(exported).toHaveLength(ENTRIES.length)
    expect(exported[0].frame).toEqual(ENTRIES[0].frame)
    expect(new Date(exported[0].timestamp).getTime()).toBe(
      new Date(ENTRIES[0].timestamp).getTime(),
    )

    const blob = service.exportLogBlob()
    const text = await blob.text()
    expect(text.startsWith('[\n{')).toBe(true)
    expect(text.endsWith('}\n]')).toBe(true)
    expect(JSON.parse(text)).toEqual(exported)

    const { service: reloaded } = makeService()
    await reloaded.loadFile(new File([text], 'exported.json'))
    expect(reloaded.getSnapshot().error).toBeNull()
    reloaded.setSpeed('max')
    reloaded.play()
    await vi.runAllTimersAsync()

    const original = service.getSnapshot().history
    const copy = reloaded.getSnapshot().history
    expect(copy).toHaveLength(original.length)
    copy.forEach((frame, index) => {
      expect(Array.from(frame.raw)).toEqual(Array.from(original[index].raw))
      expect(frame.timestamp).toBe(original[index].timestamp)
    })
  })

  it('suggests a filename from the first frame', () => {
    const { service, serial } = makeService()
    const when = new Date(2025, 3, 30, 19, 36, 22)
    serial.onFrame?.(Uint8Array.from(ENTRIES[0].frame), when.getTime())
    expect(service.suggestedLogFilename()).toBe('aldl_log_20250430_193622.json')
  })

  it('stops timers and detaches callbacks on dispose', async () => {
    const { service, serial } = makeService()
    await service.loadFile(makeFile(ENTRIES))
    service.play()
    service.dispose()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(service.getSnapshot().history).toEqual([])
    expect(serial.onFrame).toBeNull()
    expect(serial.onDisconnect).toBeNull()
  })

  it('reports Web Serial support from the serial interface', () => {
    class Unsupported extends StubSerial {
      static isSupported(): boolean {
        return false
      }
    }
    const service = new DataService(
      new ALDLProcessor(),
      new Unsupported() as unknown as SerialInterface,
    )
    expect(service.getSnapshot().connection).toBe('unsupported')
  })
})
