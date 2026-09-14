import { describe, expect, it } from 'vitest'
import { ALDLProcessor } from './aldlProcessor'
import { FRAME_LENGTH, Signal } from '../types/aldl'
import pidJson from '../assets/aldlPIDs.json'
import log from '../../test/aldl_log_20250430_193619.json'

// The first frame of the real log.
const FRAME = [
  0, 23, 43, 61, 118, 0, 58, 50, 26, 118, 13, 0, 0, 64, 163, 140, 128, 240, 110,
  28,
]

const processor = new ALDLProcessor()

function signal(signals: Signal[], name: string): Signal {
  const found = signals.find((s) => s.name === name)
  if (!found) throw new Error(`no signal named ${name}`)
  return found
}

function decode(frame: number[]): Signal[] {
  return processor.processFrame(Uint8Array.from(frame))
}

function withByte(index: number, value: number): number[] {
  const frame = [...FRAME]
  frame[index] = value
  return frame
}

describe('ALDLProcessor', () => {
  it('uses the first frame of the real log', () => {
    expect(log[0].frame).toEqual(FRAME)
    expect(FRAME).toHaveLength(FRAME_LENGTH)
  })

  it('decodes the headline signals of a real frame', () => {
    const signals = decode(FRAME)

    expect(signal(signals, 'RPM').value).toBe(1250)
    expect(signal(signals, 'CT').value).toBeCloseTo(53.33, 2)
    expect(signal(signals, 'MAP-P').value).toBeCloseTo(31.8, 1)
    expect(signal(signals, 'TPS-%').value).toBeCloseTo(1, 0)
    expect(signal(signals, 'VOLT').value).toBeCloseTo(14.0, 5)
    expect(signal(signals, 'BLM').value).toBe(110)
  })

  it('keeps units, rounding and raw values', () => {
    const signals = decode(FRAME)
    const rpm = signal(signals, 'RPM')
    expect(rpm.unit).toBe('rpm')
    expect(rpm.rawValue).toBe(50)
    expect(rpm.min).toBe(0)
    expect(rpm.max).toBe(6375)
    expect(signal(signals, 'VOLT').round).toBe(1)
  })

  it('decodes malfunction bitfields', () => {
    const signals = decode(FRAME)
    const malf3 = signal(signals, 'MALFFLG3')
    expect(malf3.rawValue).toBe(64)

    const set = malf3.bitFields?.filter((bit) => bit.value) ?? []
    expect(set).toHaveLength(1)
    expect(set[0].bitName).toBe('MALF CODE 44 - OXYGEN SENSOR LEAN')
    expect(set[0].type).toBe('MALF')
    expect(malf3.bitFields).toHaveLength(8)
  })

  it('leaves bitFields undefined for plain PIDs', () => {
    expect(signal(decode(FRAME), 'RPM').bitFields).toBeUndefined()
  })

  it('interpolates the coolant table endpoints', () => {
    expect(signal(decode(withByte(4, 0)), 'CT').value).toBe(200)
    expect(signal(decode(withByte(4, 255)), 'CT').value).toBe(-40)
    expect(signal(decode(withByte(4, 114)), 'CT').value).toBe(55)
    expect(signal(decode(withByte(4, 126)), 'CT').value).toBe(50)
  })

  it('clamps the throttle percentage to 0..100', () => {
    expect(signal(decode(withByte(8, 0)), 'TPS-%').value).toBe(0)
    expect(signal(decode(withByte(8, 255)), 'TPS-%').value).toBe(100)
    expect(signal(decode(withByte(8, 24)), 'TPS-%').value).toBe(0)
    expect(signal(decode(withByte(8, 225)), 'TPS-%').value).toBe(100)
  })

  it('returns a template in the order of aldlPIDs.json', () => {
    const template = processor.getSignalTemplate()
    expect(template.map((s) => s.name)).toEqual(pidJson.map((pid) => pid.name))
    expect(template.every((s) => s.rawValue === 0)).toBe(true)
    expect(decode(FRAME).map((s) => s.name)).toEqual(
      pidJson.map((pid) => pid.name),
    )
  })

  it('exposes PID definitions by name', () => {
    expect(processor.getPidDefinition('RPM')?.scale).toBe(25)
    expect(processor.getPidDefinition('CT')?.lookup).toBe('coolant')
    expect(processor.getPidDefinition('NOPE')).toBeUndefined()
  })
})
