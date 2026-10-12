import { describe, expect, it } from 'vitest'
import logJson from '../../test/aldl_log_20250430_193619.json'
import { ALDLProcessor } from './aldlProcessor'
import {
  countReversals,
  decodeRow,
  formatRows,
  formatSummary,
  pearson,
  segmentByNotes,
  summarize,
  toCsv,
  type Row,
} from './logAnalysis'
import type { LogEntry } from '../types/aldl'

const processor = new ALDLProcessor()
const entries = logJson as LogEntry[]

function rowOf(entry: LogEntry, note?: string): Row {
  const raw = Uint8Array.from(entry.frame)
  return decodeRow({
    timestamp: new Date(entry.timestamp).getTime(),
    raw,
    signals: processor.processFrame(raw),
    note,
  })
}

const rows = entries.map((e) => rowOf(e))

describe('decodeRow', () => {
  it('decodes a known frame', () => {
    // [0, 23, 43, 61, 118, 0, 58, 50, 26, 118, 13, 0, 0, 64, 163, 140, 128, 240, 110, 28]
    const r = rows[0]
    expect(r.RPM).toBe(1250)
    expect(r.IAC).toBe(61)
    expect(r.INT).toBe(118)
    expect(r.BLM).toBe(110)
    expect(r.VOLT).toBeCloseTo(14, 5)
    expect(r.MPH).toBe(0)
    expect(r.O2).toBeCloseTo(13 * 4.34, 5)
    expect(r.closedLoop).toBe(true)
    expect(r.rich).toBe(false)
    expect(r.learn).toBe(true)
    expect(r.idle).toBe(false)
    expect(r.parkNeutral).toBe(false)
    expect(r.acRequest).toBe(false)
    expect(r.codes).toEqual([44])
    expect(r.note).toBeUndefined()
  })
})

describe('summarize', () => {
  const s = summarize(rows)

  it('counts frames and duration', () => {
    expect(s.frames).toBe(548)
    expect(s.durationSec).toBeGreaterThan(640)
    expect(s.durationSec).toBeLessThan(660)
    expect(s.medianGapSec).toBeCloseTo(1.19, 1)
    expect(s.gapCount).toBe(0)
  })

  it('detects MALF code 44 throughout', () => {
    expect(s.codes).toHaveLength(1)
    expect(s.codes[0].code).toBe(44)
    expect(s.codes[0].frames).toBe(548)
    expect(s.codes[0].name).toContain('LEAN')
  })

  it('is closed loop nearly throughout and has idle stats', () => {
    expect(s.pctClosedLoop).toBeGreaterThan(95)
    expect(s.idle).not.toBeNull()
    expect(formatSummary(s)).toContain('PROM ID')
  })
})

describe('segmentByNotes', () => {
  it('splits at noted frames', () => {
    const noted = rows.map((r, i) =>
      i === 100 ? { ...r, note: 'A/C on' } : i === 300 ? { ...r, note: 'warm' } : r,
    )
    const segs = segmentByNotes(noted)
    expect(segs.map((s) => s.label)).toEqual(['start', 'A/C on', 'warm'])
    expect(segs.map((s) => s.rows.length)).toEqual([100, 200, 248])
    expect(segs[1].startT).toBe(rows[100].t)
  })

  it('starts with the note when the first frame is noted', () => {
    const segs = segmentByNotes([{ ...rows[0], note: 'first' }, rows[1]])
    expect(segs).toHaveLength(1)
    expect(segs[0].label).toBe('first')
  })
})

describe('statistics helpers', () => {
  it('returns null correlation on constant input', () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
    expect(pearson([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull()
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10)
  })

  it('counts reversals by swing', () => {
    expect(countReversals([800, 900, 800, 900, 800], 75)).toBe(3)
    expect(countReversals([800, 820, 800, 820], 75)).toBe(0)
  })
})

describe('formatting', () => {
  it('formats rows and csv', () => {
    const text = formatRows(rows.slice(0, 3))
    expect(text.split('\n')).toHaveLength(4)
    expect(text).toContain('RPM')
    const csv = toCsv(rows.slice(0, 2)).split('\n')
    expect(csv).toHaveLength(3)
    expect(csv[1]).toContain(',44,')
  })
})
