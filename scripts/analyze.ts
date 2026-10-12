import { readFileSync, writeFileSync } from 'node:fs'
import { ALDLProcessor } from '../src/services/aldlProcessor'
import {
  decodeRow,
  formatRows,
  formatSummary,
  segmentByNotes,
  summarize,
  toCsv,
  type Row,
} from '../src/services/logAnalysis'
import { FRAME_LENGTH, type LogEntry } from '../src/types/aldl'

const USAGE =
  'Usage: npm run analyze -- <log.json> [--rows] [--csv out.csv] [--from SEC] [--to SEC] [--segments]'

function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

/** Same checks as DataService's validateLog, with a message per failure. */
function validateLog(parsed: unknown): LogEntry[] {
  if (!Array.isArray(parsed)) fail('log must be a JSON array of entries.')
  return parsed.map((entry: unknown, i: number) => {
    const where = `entry ${i}`
    if (typeof entry !== 'object' || entry === null) fail(`${where} is not an object.`)
    const e = entry as Partial<LogEntry>
    if (typeof e.timestamp !== 'string') fail(`${where} has no string timestamp.`)
    if (!Number.isFinite(new Date(e.timestamp).getTime())) {
      fail(`${where} has an unparseable timestamp "${e.timestamp}".`)
    }
    if (!Array.isArray(e.frame) || e.frame.length !== FRAME_LENGTH) {
      fail(`${where} frame must be an array of ${FRAME_LENGTH} bytes.`)
    }
    for (const b of e.frame) {
      if (!Number.isInteger(b) || b < 0 || b > 255) fail(`${where} has a non-byte frame value ${b}.`)
    }
    if (e.note !== undefined && typeof e.note !== 'string') fail(`${where} note must be a string.`)
    return e as LogEntry
  })
}

function numArg(args: string[], flag: string): number | undefined {
  const i = args.indexOf(flag)
  if (i < 0) return undefined
  const n = Number(args[i + 1])
  if (!Number.isFinite(n)) fail(`${flag} needs a number.`)
  return n
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('--help')) fail(USAGE)

  const valueFlags = new Set(['--csv', '--from', '--to'])
  const known = new Set([...valueFlags, '--rows', '--segments'])
  const positional: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (valueFlags.has(args[i])) i++
    else if (args[i].startsWith('--')) {
      if (!known.has(args[i])) fail(`unknown option ${args[i]}\n${USAGE}`)
    } else positional.push(args[i])
  }
  if (positional.length !== 1) fail(USAGE)

  const path = positional[0]
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`could not read ${path}: ${error instanceof Error ? error.message : error}`)
  }
  const entries = validateLog(parsed)

  const processor = new ALDLProcessor()
  let rows: Row[] = entries.map((e) => {
    const raw = Uint8Array.from(e.frame)
    return decodeRow({
      timestamp: new Date(e.timestamp).getTime(),
      raw,
      signals: processor.processFrame(raw),
      note: e.note,
    })
  })
  if (rows.length === 0) fail('log has no entries.')

  const t0 = rows[0].t
  const from = numArg(args, '--from')
  const to = numArg(args, '--to')
  if (from !== undefined) rows = rows.filter((r) => (r.t - t0) / 1000 >= from)
  if (to !== undefined) rows = rows.filter((r) => (r.t - t0) / 1000 <= to)

  const csvIdx = args.indexOf('--csv')
  if (csvIdx >= 0) {
    const out = args[csvIdx + 1]
    if (!out) fail('--csv needs an output path.')
    writeFileSync(out, toCsv(rows) + '\n')
    console.log(`Wrote ${rows.length} rows to ${out}`)
  }

  if (args.includes('--rows')) {
    console.log(formatRows(rows, { startT: t0 }))
    console.log()
  }

  console.log(formatSummary(summarize(rows)))

  const segments = segmentByNotes(rows)
  if (args.includes('--segments') || rows.some((r) => r.note)) {
    for (const seg of segments) {
      const sec = (seg.startT - t0) / 1000
      console.log(`\n=== Segment "${seg.label}" at +${sec.toFixed(1)} s ===`)
      console.log(formatSummary(summarize(seg.rows)))
    }
  }
}

main()
