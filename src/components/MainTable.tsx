import { FC, useMemo, useState, useSyncExternalStore } from 'react'
import { ProcessedFrame, Signal } from '../types/aldl'

interface MainTableProps {
  /** The ordered PID list to render one row per; from the signal template. */
  rows: Signal[]
  /** Oldest first, exactly as the store holds it. */
  history: ProcessedFrame[]
  /** Which column is selected, counted back from the newest frame. */
  selectedOffset: number
  onSelectOffset: (offset: number) => void
}

const NARROW_QUERY = '(max-width: 767px)'

function subscribeToWidth(onChange: () => void): () => void {
  const media = window.matchMedia(NARROW_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function readFramesPerPage(): number {
  return window.matchMedia(NARROW_QUERY).matches ? 4 : 8
}

function wideFramesPerPage(): number {
  return 8
}

function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function hexOf(signal: Signal | undefined): string {
  if (!signal) return ''
  return signal.rawValue.toString(16).toUpperCase().padStart(2, '0')
}

function decodedOf(signal: Signal | undefined): string {
  if (!signal) return ''
  const value = signal.value.toFixed(signal.round)
  return signal.unit ? `${value} ${signal.unit}` : value
}

const MainTable: FC<MainTableProps> = ({
  rows,
  history,
  selectedOffset,
  onSelectOffset,
}) => {
  const framesPerPage = useSyncExternalStore(
    subscribeToWidth,
    readFramesPerPage,
    wideFramesPerPage,
  )
  const [requestedPage, setRequestedPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(history.length / framesPerPage))
  // Derived, so a shrinking history can never strand us on a missing page.
  const page = Math.min(requestedPage, pageCount - 1)

  /** One entry per column: the frame shown there, and its signals by name. */
  const columns = useMemo(
    () =>
      Array.from({ length: framesPerPage }, (_, index) => {
        const offset = page * framesPerPage + index
        const frame = history[history.length - 1 - offset]
        return {
          offset,
          frame,
          byName: frame
            ? new Map(frame.signals.map((signal) => [signal.name, signal]))
            : null,
        }
      }),
    [history, page, framesPerPage],
  )

  const selectedFrame = history[history.length - 1 - selectedOffset]
  const selectedByName = useMemo(
    () =>
      selectedFrame
        ? new Map(selectedFrame.signals.map((signal) => [signal.name, signal]))
        : null,
    [selectedFrame],
  )

  const selectedColumn =
    Math.floor(selectedOffset / framesPerPage) === page
      ? selectedOffset % framesPerPage
      : -1

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), pageCount - 1)
    setRequestedPage(clamped)
    // Keep the same column selected as the table pages across history.
    onSelectOffset(clamped * framesPerPage + (selectedOffset % framesPerPage))
  }

  return (
    <div className="table-container">
      <div className="pagination-controls">
        <button type="button" onClick={() => goToPage(page - 1)} disabled={page === 0}>
          ←
        </button>
        <span>
          Page {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= pageCount - 1}
        >
          →
        </button>
      </div>
      <div className="table-responsive">
        <table className="aldl-table">
          <thead>
            <tr>
              <th>PID</th>
              {columns.map((column, index) => (
                <th
                  key={column.offset}
                  className={index === selectedColumn ? 'selected' : ''}
                  onClick={() => onSelectOffset(column.offset)}
                >
                  <span className="header-offset">-{column.offset}</span>
                  <span className="header-time">
                    {column.frame ? formatClock(column.frame.timestamp) : '—'}
                  </span>
                </th>
              ))}
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td title={row.description}>{row.name}</td>
                {columns.map((column, index) => (
                  <td
                    key={column.offset}
                    className={index === selectedColumn ? 'selected' : ''}
                  >
                    {hexOf(column.byName?.get(row.name))}
                  </td>
                ))}
                <td>{decodedOf(selectedByName?.get(row.name))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MainTable
