import { ChangeEvent, FC, FormEvent, useRef, useState } from 'react'
import { ConnectionStatus, PlaybackSpeed } from '../services/dataService'

interface ControlPanelProps {
  connection: ConnectionStatus
  file: { name: string; frameCount: number; position: number } | null
  playback: { isPlaying: boolean; speed: PlaybackSpeed }
  historyLength: number
  anyDevice: boolean
  onAnyDeviceChange: (anyDevice: boolean) => void
  onConnect: () => void
  onDisconnect: () => void
  onLoadFile: (file: File) => void
  onCloseFile: () => void
  onPlay: () => void
  onPause: () => void
  onStep: () => void
  onRewind: () => void
  onSpeedChange: (speed: PlaybackSpeed) => void
  onDownloadLog: () => void
  onClearHistory: () => void
  /** Returns true when the note was attached to a frame. */
  onAddNote: (text: string) => boolean
}

const SPEEDS: PlaybackSpeed[] = [1, 5, 'max']

function speedLabel(speed: PlaybackSpeed): string {
  return speed === 'max' ? 'max' : `${speed}x`
}

function parseSpeed(value: string): PlaybackSpeed {
  if (value === 'max') return 'max'
  return value === '5' ? 5 : 1
}

const ControlPanel: FC<ControlPanelProps> = ({
  connection,
  file,
  playback,
  historyLength,
  anyDevice,
  onAnyDeviceChange,
  onConnect,
  onDisconnect,
  onLoadFile,
  onCloseFile,
  onPlay,
  onPause,
  onStep,
  onRewind,
  onSpeedChange,
  onDownloadLog,
  onClearHistory,
  onAddNote,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [noteText, setNoteText] = useState('')

  // Everything below is derived from the store, so nothing can get stuck.
  const unsupported = connection === 'unsupported'
  const connected = connection === 'connected'
  const connecting = connection === 'connecting'
  const atEnd = file !== null && file.position >= file.frameCount

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const chosen = input.files?.[0]
    // Reset the input so picking the same file again still fires onChange.
    input.value = ''
    if (chosen) onLoadFile(chosen)
  }

  const handleNoteSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (onAddNote(noteText)) setNoteText('')
  }

  return (
    <div className="controls">
      <div className="control-group">
        {connected ? (
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={unsupported || connecting || file !== null}
            title={
              unsupported
                ? 'Web Serial needs Chrome or Edge on a desktop computer.'
                : file !== null
                  ? 'Close the log file first.'
                  : undefined
            }
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <label className="checkbox-label" title="Show every serial device in the chooser, not just known ALDL cables.">
          <input
            type="checkbox"
            checked={anyDevice}
            disabled={unsupported || connected || connecting}
            onChange={(event) => onAnyDeviceChange(event.target.checked)}
          />
          any device
        </label>
      </div>

      <div className="control-group">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={connected || connecting}
        >
          Load log file
        </button>
        {file !== null && (
          <>
            <button type="button" onClick={onCloseFile}>
              Close file
            </button>
            {playback.isPlaying ? (
              <button type="button" onClick={onPause}>
                Pause
              </button>
            ) : (
              <button type="button" onClick={onPlay} disabled={file.frameCount === 0}>
                Play
              </button>
            )}
            <button
              type="button"
              onClick={onStep}
              disabled={playback.isPlaying || atEnd}
            >
              Step
            </button>
            <button
              type="button"
              onClick={onRewind}
              disabled={file.position === 0}
            >
              Rewind
            </button>
            <label className="speed-label">
              Speed
              <select
                value={String(playback.speed)}
                onChange={(event) => onSpeedChange(parseSpeed(event.target.value))}
              >
                {SPEEDS.map((speed) => (
                  <option key={String(speed)} value={String(speed)}>
                    {speedLabel(speed)}
                  </option>
                ))}
              </select>
            </label>
            <span className="frame-counter">
              frame {file.position} / {file.frameCount}
              {atEnd && !playback.isPlaying && file.frameCount > 0
                ? ' (end)'
                : ''}
            </span>
          </>
        )}
      </div>

      <form className="control-group" onSubmit={handleNoteSubmit}>
        <input
          type="text"
          className="note-input"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="Event note, e.g. unplugged IAC"
          aria-label="Event note"
          disabled={historyLength === 0}
        />
        <button
          type="submit"
          disabled={historyLength === 0 || noteText.trim() === ''}
        >
          Mark
        </button>
      </form>

      <div className="control-group">
        <button
          type="button"
          onClick={onDownloadLog}
          disabled={historyLength === 0}
        >
          Download log
        </button>
        <button
          type="button"
          onClick={onClearHistory}
          disabled={historyLength === 0}
        >
          Clear history
        </button>
      </div>
    </div>
  )
}

export default ControlPanel
