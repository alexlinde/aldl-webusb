import type { DataService } from './services/dataService'
import type { ALDLProcessor } from './services/aldlProcessor'
import {
  decodeRow,
  formatRows,
  formatSummary,
  segmentByNotes,
  summarize,
  toCsv,
  type Row,
} from './services/logAnalysis'
import type { ProcessedFrame } from './types/aldl'

/** Console / automation surface: every method returns a string or plain JSON. */
export interface AldlDebugApi {
  help(): string
  status(): Record<string, unknown>
  recent(n?: number): string
  summary(seconds?: number): string
  segments(): string
  mark(text: string): string
  codes(): string
  csv(): string
  log(): string
}

declare global {
  interface Window {
    aldl?: AldlDebugApi
  }
}

const HELP = [
  'window.aldl methods:',
  '  help()          this list',
  '  status()        connection, frame count, framing errors, file position, last-frame age, notes',
  '  recent(n=30)    decoded table of the last n frames',
  '  summary(s=60)   summary of the last s seconds of frames',
  '  segments()      per-note segment summaries over all history',
  '  mark(text)      attach a note to the latest frame',
  '  codes()         MALF codes currently set, with names',
  '  csv()           full history as CSV',
  '  log()           full history as the export JSON string',
].join('\n')

export function installDebugHook(
  dataService: DataService,
  processor: ALDLProcessor,
): void {
  const frames = (): ProcessedFrame[] => dataService.getSnapshot().history
  const rowsOf = (list: ProcessedFrame[]): Row[] => list.map((f) => decodeRow(f))

  const api: AldlDebugApi = {
    help: () => HELP,

    status() {
      const s = dataService.getSnapshot()
      const last = s.latest
      return {
        connection: s.connection,
        frames: s.history.length,
        framingErrors: s.framingErrors,
        file: s.file,
        playing: s.playback.isPlaying,
        secondsSinceLastFrame: last
          ? Math.round((Date.now() - last.timestamp) / 100) / 10
          : null,
        error: s.error,
        notes: s.history
          .filter((f) => f.note)
          .map((f) => ({ time: new Date(f.timestamp).toISOString(), note: f.note })),
      }
    },

    recent(n = 30) {
      return formatRows(rowsOf(frames().slice(-Math.max(1, n))))
    },

    summary(seconds = 60) {
      const all = frames()
      if (all.length === 0) return 'No frames.'
      const cutoff = all[all.length - 1].timestamp - seconds * 1000
      return formatSummary(summarize(rowsOf(all.filter((f) => f.timestamp >= cutoff))))
    },

    segments() {
      const rows = rowsOf(frames())
      if (rows.length === 0) return 'No frames.'
      const t0 = rows[0].t
      return segmentByNotes(rows)
        .map(
          (seg) =>
            `=== Segment "${seg.label}" at +${((seg.startT - t0) / 1000).toFixed(1)} s ===\n` +
            formatSummary(summarize(seg.rows)),
        )
        .join('\n\n')
    },

    mark(text) {
      if (dataService.addNote(text)) return `Marked latest frame: ${text.trim()}`
      return 'Not marked: the note is blank or there is no frame yet.'
    },

    codes() {
      const latest = dataService.getSnapshot().latest
      if (!latest) return 'No frames.'
      const set = processor
        .processFrame(latest.raw)
        .flatMap((s) => s.bitFields ?? [])
        .filter((b) => b.type === 'MALF' && b.value)
        .map((b) => b.bitName)
      return set.length ? set.join('\n') : 'No MALF codes set.'
    },

    csv: () => toCsv(rowsOf(frames())),
    log: () => JSON.stringify(dataService.exportLog()),
  }

  window.aldl = api
}
