import { FC } from 'react'
import { ConnectionStatus } from '../services/dataService'
import { ProcessedFrame } from '../types/aldl'

interface StatusBarProps {
  connection: ConnectionStatus
  file: { name: string; frameCount: number; position: number } | null
  historyLength: number
  framingErrors: number
  history: ProcessedFrame[]
}

/** How many recent event markers the bar lists. */
const MAX_NOTES = 5

function clockTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const CONNECTION_TEXT: Record<ConnectionStatus, string> = {
  unsupported: 'Web Serial not available',
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
}

const StatusBar: FC<StatusBarProps> = ({
  connection,
  file,
  historyLength,
  framingErrors,
  history,
}) => {
  const notes = history.filter((frame) => frame.note).slice(-MAX_NOTES)
  return (
    <div className="status-bar">
      <span className={`status-item status-${connection}`}>
        {CONNECTION_TEXT[connection]}
      </span>
      <span className="status-item">
        {file
          ? `${file.name} — frame ${file.position} / ${file.frameCount}`
          : 'No log file'}
      </span>
      <span className="status-item">
        {historyLength === 1 ? '1 frame' : `${historyLength} frames`} in history
      </span>
      {framingErrors > 0 && (
        <span className="status-item status-warning">
          {framingErrors === 1
            ? '1 framing error'
            : `${framingErrors} framing errors`}
        </span>
      )}
      {notes.length > 0 && (
        <span className="status-item status-notes">
          {notes.map((frame) => (
            <span key={frame.timestamp} className="status-note">
              {clockTime(frame.timestamp)} {frame.note}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

export default StatusBar
