import { FC } from 'react'
import { ConnectionStatus } from '../services/dataService'

interface StatusBarProps {
  connection: ConnectionStatus
  file: { name: string; frameCount: number; position: number } | null
  historyLength: number
  framingErrors: number
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
}) => (
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
  </div>
)

export default StatusBar
