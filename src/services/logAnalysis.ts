import { ALDLProcessor } from './aldlProcessor'
import type { ProcessedFrame, Signal } from '../types/aldl'

/** Anything decodeRow can flatten: a ProcessedFrame or a structural twin. */
export interface FrameLike {
  timestamp: number
  raw: Uint8Array
  signals: Signal[]
  note?: string
}

/** One frame flattened to plain numbers and booleans. */
export interface Row {
  /** Epoch ms. */
  t: number
  RPM: number
  IAC: number
  /** kPa. */
  MAP: number
  MAPV: number
  /** Percent. */
  TPS: number
  TPSV: number
  /** Degrees C. */
  CT: number
  /** mV. */
  O2: number
  INT: number
  BLM: number
  VOLT: number
  MPH: number
  O2CNT: number
  OLDPA3: number
  /** PROM ID, (MSB << 8) | LSB. */
  PROM: number
  closedLoop: boolean
  rich: boolean
  learn: boolean
  idle: boolean
  /** True = park/neutral; false = in drive. */
  parkNeutral: boolean
  acRequest: boolean
  /** MALF code numbers set in this frame. */
  codes: number[]
  note?: string
}

export interface Stats {
  min: number
  max: number
  mean: number
  std: number
}

export interface IdleStats {
  count: number
  /** True when only warm (CT >= WARM_IDLE_C) frames were used. */
  warm: boolean
  rpm: Stats & { peakToPeak: number }
  iac: Stats
  map: Stats
  intMean: number
  blmMean: number
  /** RPM direction reversals (swing >= huntSwing) per minute of idle. */
  huntingPerMin: number
  huntingReversals: number
  corrRpmIac: number | null
  corrRpmMap: number | null
}

export interface Summary {
  frames: number
  startT: number
  endT: number
  durationSec: number
  medianGapSec: number
  gapCount: number
  gaps: Array<{ atSec: number; gapSec: number }>
  promId: number | null
  codes: Array<{ code: number; name: string; firstSec: number; lastSec: number; frames: number }>
  signals: Record<'RPM' | 'IAC' | 'MAP' | 'TPS' | 'CT' | 'O2' | 'INT' | 'BLM' | 'VOLT', Stats>
  pctClosedLoop: number
  pctRich: number
  o2CrossPerMin: number
  /** Mean coolant >= 80 C. */
  warm: boolean
  idle: IdleStats | null
}

export interface SummaryOptions {
  /** Gap (s) above which a frame gap is reported. Default 3. */
  gapSec?: number
  /** RPM swing counted as a reversal. Default 75. */
  huntSwing?: number
}

export interface Segment {
  label: string
  startT: number
  rows: Row[]
}

const O2_THRESHOLD = 450
const WARM_C = 80
/** Coolant temperature from which idle counts as warm idle. */
const WARM_IDLE_C = 70
/** Above this a closed-throttle frame is a decel or blip, not idle. */
const IDLE_MAX_RPM = 1600

function sig(signals: Signal[], name: string): Signal | undefined {
  return signals.find((s) => s.name === name)
}

function val(signals: Signal[], name: string): number {
  return sig(signals, name)?.value ?? NaN
}

function raw(signals: Signal[], name: string): number {
  return sig(signals, name)?.rawValue ?? 0
}

/** Set MALF code numbers across MALFFLG1-3, from the bit names. */
function malfCodes(signals: Signal[]): number[] {
  const codes: number[] = []
  for (const s of signals) {
    for (const b of s.bitFields ?? []) {
      if (!b.value || b.type !== 'MALF') continue
      const m = /MALF CODE (\d+)/.exec(b.bitName)
      if (m) codes.push(Number(m[1]))
    }
  }
  return codes.sort((a, b) => a - b)
}

/** Name of a MALF code, from the bit names of a template frame. */
function codeName(code: number, signals: Signal[]): string {
  for (const s of signals) {
    for (const b of s.bitFields ?? []) {
      if (b.type !== 'MALF') continue
      const m = /^MALF CODE (\d+)(?: - (.*))?$/.exec(b.bitName)
      if (m && Number(m[1]) === code) return m[2] ?? ''
    }
  }
  return ''
}

export function decodeRow(frame: FrameLike | ProcessedFrame): Row {
  const s = frame.signals
  const mw2 = raw(s, 'MW2')
  const mwaf1 = raw(s, 'MWAF1')
  const io = raw(s, 'MCU2IO')
  const row: Row = {
    t: frame.timestamp,
    RPM: val(s, 'RPM'),
    IAC: val(s, 'IAC'),
    MAP: val(s, 'MAP-P'),
    MAPV: val(s, 'MAP-V'),
    TPS: val(s, 'TPS-%'),
    TPSV: val(s, 'TPS-V'),
    CT: val(s, 'CT'),
    O2: val(s, 'O2'),
    INT: val(s, 'INT'),
    BLM: val(s, 'BLM'),
    VOLT: val(s, 'VOLT'),
    MPH: val(s, 'MPH'),
    O2CNT: val(s, 'O2_CNT'),
    OLDPA3: val(s, 'OLDPA3'),
    PROM: (raw(s, 'PROMIDMSB') << 8) | raw(s, 'PROMIDLSB'),
    closedLoop: !!(mwaf1 & 0x80),
    rich: !!(mwaf1 & 0x40),
    learn: !!(mwaf1 & 0x02),
    idle: !!(mw2 & 0x80),
    parkNeutral: !!(io & 0x10),
    acRequest: !(io & 0x80),
    codes: malfCodes(s),
  }
  if (frame.note) row.note = frame.note
  return row
}

// --- statistics -----------------------------------------------------------

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
}

function stats(xs: number[]): Stats {
  if (xs.length === 0) return { min: NaN, max: NaN, mean: NaN, std: NaN }
  const m = mean(xs)
  const variance = mean(xs.map((x) => (x - m) ** 2))
  return {
    min: Math.min(...xs),
    max: Math.max(...xs),
    mean: m,
    std: Math.sqrt(variance),
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const a = [...xs].sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

/** Pearson correlation; null when either side has zero variance or n < 2. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx < 1e-12 || syy < 1e-12) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Count direction reversals whose swing from the last extreme is >= swing. */
export function countReversals(xs: number[], swing: number): number {
  if (xs.length < 2) return 0
  let dir = 0
  let extreme = xs[0]
  let reversals = 0
  for (const x of xs) {
    if (dir === 0) {
      if (Math.abs(x - extreme) >= swing) {
        dir = x > extreme ? 1 : -1
        extreme = x
      }
    } else if (dir === 1) {
      if (x > extreme) extreme = x
      else if (extreme - x >= swing) {
        dir = -1
        extreme = x
        reversals++
      }
    } else if (x < extreme) extreme = x
    else if (x - extreme >= swing) {
      dir = 1
      extreme = x
      reversals++
    }
  }
  return reversals
}

function fmtClock(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// --- summary ----------------------------------------------------------------

export function summarize(rows: Row[], opts: SummaryOptions = {}): Summary {
  const gapLimit = opts.gapSec ?? 3
  const huntSwing = opts.huntSwing ?? 75
  const startT = rows.length ? rows[0].t : NaN
  const endT = rows.length ? rows[rows.length - 1].t : NaN
  const durationSec = rows.length ? (endT - startT) / 1000 : 0

  const deltas: number[] = []
  const gaps: Summary['gaps'] = []
  for (let i = 1; i < rows.length; i++) {
    const g = (rows[i].t - rows[i - 1].t) / 1000
    deltas.push(g)
    if (g > gapLimit) gaps.push({ atSec: (rows[i - 1].t - startT) / 1000, gapSec: g })
  }
  const medianGapSec = median(deltas)

  const codeMap = new Map<number, { first: number; last: number; frames: number }>()
  for (const r of rows) {
    for (const c of r.codes) {
      const e = codeMap.get(c)
      if (e) {
        e.last = r.t
        e.frames++
      } else codeMap.set(c, { first: r.t, last: r.t, frames: 1 })
    }
  }
  const template = templateSignals()
  const codes = [...codeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, e]) => ({
      code,
      name: codeName(code, template),
      firstSec: (e.first - startT) / 1000,
      lastSec: (e.last - startT) / 1000,
      frames: e.frames,
    }))

  const col = (k: keyof Row) => rows.map((r) => r[k] as number)
  const n = rows.length || 1
  const o2 = col('O2')
  let crossings = 0
  for (let i = 1; i < o2.length; i++) {
    if (o2[i - 1] > O2_THRESHOLD !== o2[i] > O2_THRESHOLD) crossings++
  }

  // Closed throttle, stationary, running, and not a decel or a blip: those
  // would swamp the idle statistics. Prefer warm idle; the cold-start fast
  // idle drags IAC and RPM up together and fakes a strong correlation.
  const anyIdle = rows.filter(
    (r) => r.TPS < 3 && r.MPH === 0 && r.RPM > 300 && r.RPM < IDLE_MAX_RPM,
  )
  const warmIdle = anyIdle.filter((r) => r.CT >= WARM_IDLE_C)
  const idleWarm = warmIdle.length > 0
  const idleRows = idleWarm ? warmIdle : anyIdle
  let idle: IdleStats | null = null
  if (idleRows.length > 0) {
    const rpm = idleRows.map((r) => r.RPM)
    const iac = idleRows.map((r) => r.IAC)
    const map = idleRows.map((r) => r.MAP)
    const rpmStats = stats(rpm)
    const gap = Number.isFinite(medianGapSec) ? medianGapSec : 1.19
    const minutes = (idleRows.length * gap) / 60
    const reversals = countReversals(rpm, huntSwing)
    idle = {
      count: idleRows.length,
      warm: idleWarm,
      rpm: { ...rpmStats, peakToPeak: rpmStats.max - rpmStats.min },
      iac: stats(iac),
      map: stats(map),
      intMean: mean(idleRows.map((r) => r.INT)),
      blmMean: mean(idleRows.map((r) => r.BLM)),
      huntingReversals: reversals,
      huntingPerMin: reversals / minutes,
      corrRpmIac: pearson(rpm, iac),
      corrRpmMap: pearson(rpm, map),
    }
  }

  const ctMean = mean(col('CT'))
  return {
    frames: rows.length,
    startT,
    endT,
    durationSec,
    medianGapSec,
    gapCount: gaps.length,
    gaps,
    promId: rows.length ? rows[0].PROM : null,
    codes,
    signals: {
      RPM: stats(col('RPM')),
      IAC: stats(col('IAC')),
      MAP: stats(col('MAP')),
      TPS: stats(col('TPS')),
      CT: stats(col('CT')),
      O2: stats(o2),
      INT: stats(col('INT')),
      BLM: stats(col('BLM')),
      VOLT: stats(col('VOLT')),
    },
    pctClosedLoop: (rows.filter((r) => r.closedLoop).length / n) * 100,
    pctRich: (rows.filter((r) => r.rich).length / n) * 100,
    o2CrossPerMin: durationSec > 0 ? crossings / (durationSec / 60) : 0,
    warm: ctMean >= WARM_C,
    idle,
  }
}

/** Signal template for MALF names, built once. */
let cachedTemplate: Signal[] | null = null
function templateSignals(): Signal[] {
  cachedTemplate ??= new ALDLProcessor().getSignalTemplate()
  return cachedTemplate
}

/** Split at each noted row; the first segment is "start" until the first note. */
export function segmentByNotes(rows: Row[]): Segment[] {
  const segments: Segment[] = []
  let current: Segment | null = null
  for (const r of rows) {
    if (r.note || current === null) {
      if (current && current.rows.length === 0) segments.pop()
      current = { label: r.note ?? 'start', startT: r.t, rows: [] }
      segments.push(current)
    }
    current.rows.push(r)
  }
  return segments
}

// --- formatting -------------------------------------------------------------

function f(x: number, d = 0): string {
  return Number.isFinite(x) ? x.toFixed(d) : '-'
}

function fstats(s: Stats, d = 0): string {
  return `min ${f(s.min, d)}  max ${f(s.max, d)}  mean ${f(s.mean, d)}  std ${f(s.std, d)}`
}

function fcorr(c: number | null): string {
  return c === null ? 'n/a' : c.toFixed(2)
}

export function formatSummary(s: Summary): string {
  if (s.frames === 0) return 'No frames.'
  const L: string[] = []
  L.push(
    `Frames: ${s.frames}   Duration: ${f(s.durationSec, 1)} s   Start: ${fmtClock(s.startT)}   Median gap: ${f(s.medianGapSec, 2)} s`,
  )
  L.push(
    `Gaps > 3 s: ${s.gapCount}` +
      (s.gaps.length
        ? ' (' + s.gaps.slice(0, 10).map((g) => `${f(g.gapSec, 1)} s at +${f(g.atSec, 0)} s`).join(', ') + (s.gaps.length > 10 ? ', ...' : '') + ')'
        : ''),
  )
  L.push(
    `PROM ID: ${s.promId === null ? '-' : `${s.promId} (0x${s.promId.toString(16).toUpperCase()})`}   Coolant: ${s.warm ? 'warm' : 'not warm'} (mean ${f(s.signals.CT.mean)} C, warm >= 80)`,
  )
  L.push(
    'MALF codes: ' +
      (s.codes.length
        ? s.codes
            .map((c) => `${c.code}${c.name ? ' ' + c.name : ''} [+${f(c.firstSec, 0)}..+${f(c.lastSec, 0)} s, ${c.frames} frames]`)
            .join('; ')
        : 'none'),
  )
  L.push(
    `Closed loop: ${f(s.pctClosedLoop, 1)}%   Rich: ${f(s.pctRich, 1)}%   O2 450 mV crossings: ${f(s.o2CrossPerMin, 1)}/min`,
  )
  L.push('Signals:')
  const units: Record<string, [string, number]> = {
    RPM: ['rpm', 0],
    IAC: ['cnt', 0],
    MAP: ['kPa', 1],
    TPS: ['%', 1],
    CT: ['C', 0],
    O2: ['mV', 0],
    INT: ['', 0],
    BLM: ['', 0],
    VOLT: ['V', 1],
  }
  for (const [k, st] of Object.entries(s.signals)) {
    const [u, d] = units[k]
    L.push(`  ${k.padEnd(5)} ${fstats(st, d)} ${u}`)
  }
  if (s.idle) {
    const i = s.idle
    L.push(
      `${i.warm ? `Warm idle (CT >= ${WARM_IDLE_C} C, ` : 'Idle (cold, '}TPS < 3%, MPH 0, 300 < RPM < ${IDLE_MAX_RPM}): ${i.count} frames`,
    )
    L.push(`  RPM  ${fstats(i.rpm)}  p-p ${f(i.rpm.peakToPeak)}`)
    L.push(`  IAC  ${fstats(i.iac, 1)}`)
    L.push(`  MAP  ${fstats(i.map, 1)}`)
    L.push(`  INT mean ${f(i.intMean, 1)}   BLM mean ${f(i.blmMean, 1)}   (128 = neutral)`)
    L.push(
      `  Hunting: ${i.huntingReversals} RPM reversals (>= 75 rpm) = ${f(i.huntingPerMin, 1)}/min   corr(RPM,IAC) ${fcorr(i.corrRpmIac)}   corr(RPM,MAP) ${fcorr(i.corrRpmMap)}`,
    )
  } else {
    L.push(`Idle: no idle frames (TPS < 3%, MPH 0, 300 < RPM < ${IDLE_MAX_RPM})`)
  }
  return L.join('\n')
}

export interface FormatRowsOptions {
  /** Epoch ms that the "t(s)" column counts from; defaults to the first row. */
  startT?: number
  /** Keep every Nth row. */
  every?: number
}

export function formatRows(rows: Row[], opts: FormatRowsOptions = {}): string {
  if (rows.length === 0) return 'No frames.'
  const t0 = opts.startT ?? rows[0].t
  const every = Math.max(1, opts.every ?? 1)
  const header = [
    't(s)'.padStart(7), 'time'.padEnd(8), 'RPM'.padStart(5), 'IAC'.padStart(4),
    'MAP'.padStart(5), 'TPS%'.padStart(5), 'CT'.padStart(4), 'O2'.padStart(4),
    'INT'.padStart(4), 'BLM'.padStart(4), 'V'.padStart(5), 'MPH'.padStart(3), 'CL', 'R/L',
    'codes', 'note',
  ].join(' ')
  const lines = [header]
  rows.forEach((r, i) => {
    if (i % every !== 0 && !r.note) return
    lines.push(
      [
        f((r.t - t0) / 1000, 1).padStart(7),
        fmtClock(r.t),
        f(r.RPM).padStart(5),
        f(r.IAC).padStart(4),
        f(r.MAP, 1).padStart(5),
        f(r.TPS, 1).padStart(5),
        f(r.CT).padStart(4),
        f(r.O2).padStart(4),
        f(r.INT).padStart(4),
        f(r.BLM).padStart(4),
        f(r.VOLT, 1).padStart(5),
        f(r.MPH).padStart(3),
        r.closedLoop ? 'CL' : 'OL',
        r.rich ? ' R ' : ' L ',
        r.codes.length ? r.codes.join(',') : '-',
        r.note ?? '',
      ].join(' ').trimEnd(),
    )
  })
  return lines.join('\n')
}

const CSV_COLUMNS: Array<keyof Row> = [
  't', 'RPM', 'IAC', 'MAP', 'MAPV', 'TPS', 'TPSV', 'CT', 'O2', 'INT', 'BLM',
  'VOLT', 'MPH', 'O2CNT', 'OLDPA3', 'closedLoop', 'rich', 'learn', 'idle',
  'parkNeutral', 'acRequest', 'codes', 'note',
]

export function toCsv(rows: Row[]): string {
  const cell = (v: unknown): string => {
    if (v === undefined || v === null) return ''
    if (Array.isArray(v)) return v.join(' ')
    if (typeof v === 'boolean') return v ? '1' : '0'
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [CSV_COLUMNS.join(',')]
  for (const r of rows) {
    lines.push(
      CSV_COLUMNS.map((k) => {
        if (k === 't') return new Date(r.t).toISOString()
        return cell(r[k])
      }).join(','),
    )
  }
  return lines.join('\n')
}
