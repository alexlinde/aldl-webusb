import { describe, expect, it, vi } from 'vitest'
import { ALDLBitDecoder, Bit } from './aldlBitDecoder'
import { FRAME_LENGTH } from '../types/aldl'
import log from '../../test/aldl_log_20250430_193619.json'

const REAL_FRAME = log[0].frame
const SECOND_FRAME = log[1].frame

/** Sync ones, then per byte a 0 start bit and 8 data bits, MSB first. */
function frameToBits(frame: number[], syncOnes = 9): Bit[] {
  const bits: Bit[] = []
  for (let i = 0; i < syncOnes; i++) bits.push(1)
  for (const byte of frame) {
    bits.push(0)
    for (let shift = 7; shift >= 0; shift--) {
      bits.push(((byte >> shift) & 1) as Bit)
    }
  }
  return bits
}

function collect(bits: Bit[]): { frames: number[][]; decoder: ALDLBitDecoder } {
  const frames: number[][] = []
  const decoder = new ALDLBitDecoder((frame) => frames.push(Array.from(frame)))
  for (const bit of bits) decoder.pushBit(bit)
  return { frames, decoder }
}

describe('ALDLBitDecoder', () => {
  it('decodes a real frame from a 9-bit sync stream', () => {
    const { frames, decoder } = collect(frameToBits(REAL_FRAME))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toHaveLength(FRAME_LENGTH)
    expect(frames[0]).toEqual(REAL_FRAME)
    expect(decoder.framingErrors).toBe(0)
  })

  it('tolerates a longer sync run', () => {
    const { frames, decoder } = collect(frameToBits(REAL_FRAME, 12))
    expect(frames).toEqual([REAL_FRAME])
    expect(decoder.framingErrors).toBe(0)
  })

  it('decodes two back-to-back frames', () => {
    const { frames, decoder } = collect([
      ...frameToBits(REAL_FRAME),
      ...frameToBits(SECOND_FRAME),
    ])
    expect(frames).toEqual([REAL_FRAME, SECOND_FRAME])
    expect(decoder.framingErrors).toBe(0)
  })

  it('discards a frame with a framing error and recovers on the next one', () => {
    const bad = frameToBits(REAL_FRAME)
    // Corrupt the start bit of the sixth byte: 9 sync bits + 5 whole bytes.
    const startBitIndex = 9 + 5 * 9
    expect(bad[startBitIndex]).toBe(0)
    bad[startBitIndex] = 1

    const { frames, decoder } = collect([...bad, ...frameToBits(SECOND_FRAME)])
    expect(frames).toEqual([SECOND_FRAME])
    expect(decoder.framingErrors).toBe(1)
  })

  it('maps UART bytes with the bit-3 sampling rule', () => {
    const decoder = new ALDLBitDecoder(() => {})
    const pushBit = vi.spyOn(decoder, 'pushBit')

    decoder.pushUartByte(0x00)
    decoder.pushUartByte(0x08)
    decoder.pushUartByte(0xff)

    expect(pushBit.mock.calls.map((call) => call[0])).toEqual([1, 0, 0])
  })

  it('decodes a frame fed as UART bytes', () => {
    const frames: number[][] = []
    const decoder = new ALDLBitDecoder((frame) => frames.push(Array.from(frame)))
    // A 1 bit is a long low pulse (bit 3 still low), a 0 bit a short one.
    for (const bit of frameToBits(REAL_FRAME)) {
      decoder.pushUartByte(bit === 1 ? 0x00 : 0xff)
    }
    expect(frames).toEqual([REAL_FRAME])
  })

  it('forgets a partial frame on reset', () => {
    const frames: number[][] = []
    const decoder = new ALDLBitDecoder((frame) => frames.push(Array.from(frame)))
    const bits = frameToBits(REAL_FRAME)
    for (const bit of bits.slice(0, 40)) decoder.pushBit(bit)
    decoder.reset()
    for (const bit of bits.slice(40)) decoder.pushBit(bit)
    expect(frames).toEqual([])

    for (const bit of frameToBits(SECOND_FRAME)) decoder.pushBit(bit)
    expect(frames).toEqual([SECOND_FRAME])
  })
})
