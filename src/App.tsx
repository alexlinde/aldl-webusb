import { FC, useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import './App.css'
import MainTable from './components/MainTable'
import BitFieldsTable from './components/BitFieldsTable'
import O2Grid from './components/O2Grid'
import PIDChart from './components/PIDChart'
import ControlPanel from './components/ControlPanel'
import ErrorBanner from './components/ErrorBanner'
import StatusBar from './components/StatusBar'
import { ALDLProcessor } from './services/aldlProcessor'
import { DataService, PlaybackSpeed } from './services/dataService'
import { Signal } from './types/aldl'

const CHART_PIDS_KEY = 'aldl.chartPids'
const BIT_PIDS_KEY = 'aldl.bitPids'
const DEFAULT_CHART_PIDS = ['RPM', 'MAP-P', 'TPS-%', 'O2']

/** A stored PID selection, or `fallback` when nothing usable is stored. */
function readStoredPids(key: string, fallback: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback
    return parsed.filter((name): name is string => typeof name === 'string')
  } catch {
    // Private mode, disabled storage, corrupted value: the default is fine.
    return fallback
  }
}

function writeStoredPids(key: string, names: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(names))
  } catch {
    // Not being able to remember the selection is not worth reporting.
  }
}

function togglePid(names: string[], name: string): string[] {
  return names.includes(name)
    ? names.filter((other) => other !== name)
    : [...names, name]
}

/** Every PID carrying bit fields that are not malfunction flags. */
function bitFieldPids(template: Signal[]): string[] {
  return template
    .filter((signal) => signal.bitFields?.some((bit) => bit.type !== 'MALF'))
    .map((signal) => signal.name)
}

interface AppProps {
  processor: ALDLProcessor
  dataService: DataService
}

const App: FC<AppProps> = ({ processor, dataService }) => {
  const subscribe = useCallback(
    (listener: () => void) => dataService.subscribe(listener),
    [dataService],
  )
  const getSnapshot = useCallback(() => dataService.getSnapshot(), [dataService])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  /** The ordered PID list, available before any frame has arrived. */
  const template = useMemo(() => processor.getSignalTemplate(), [processor])

  /** Which column of the table is selected, counted back from the newest. */
  const [selectedOffset, setSelectedOffset] = useState(0)
  const [anyDevice, setAnyDevice] = useState(false)
  const [chartPids, setChartPids] = useState(() =>
    readStoredPids(CHART_PIDS_KEY, DEFAULT_CHART_PIDS),
  )
  const [bitPids, setBitPids] = useState(() =>
    readStoredPids(BIT_PIDS_KEY, bitFieldPids(template)),
  )

  const { history, latest, connection, file, playback, error, framingErrors } =
    snapshot

  const selectedFrame = history[history.length - 1 - selectedOffset] ?? latest
  const selectedSignals = selectedFrame ? selectedFrame.signals : template

  const chartPidSet = useMemo(() => new Set(chartPids), [chartPids])
  const bitPidSet = useMemo(() => new Set(bitPids), [bitPids])

  const handleToggleChartPid = useCallback((name: string) => {
    setChartPids((previous) => {
      const next = togglePid(previous, name)
      writeStoredPids(CHART_PIDS_KEY, next)
      return next
    })
  }, [])

  const handleToggleBitPid = useCallback((name: string) => {
    setBitPids((previous) => {
      const next = togglePid(previous, name)
      writeStoredPids(BIT_PIDS_KEY, next)
      return next
    })
  }, [])

  const handleConnect = useCallback(() => {
    void dataService.connect({ anyDevice })
  }, [dataService, anyDevice])

  const handleDisconnect = useCallback(() => {
    void dataService.disconnect()
  }, [dataService])

  const handleLoadFile = useCallback(
    (chosen: File) => {
      void dataService.loadFile(chosen)
    },
    [dataService],
  )

  const handleCloseFile = useCallback(() => {
    dataService.clearFile()
  }, [dataService])

  const handlePlay = useCallback(() => dataService.play(), [dataService])
  const handlePause = useCallback(() => dataService.pause(), [dataService])
  const handleStep = useCallback(() => dataService.step(), [dataService])
  const handleRewind = useCallback(() => dataService.rewind(), [dataService])
  const handleSpeed = useCallback(
    (speed: PlaybackSpeed) => dataService.setSpeed(speed),
    [dataService],
  )

  const handleClearHistory = useCallback(() => {
    dataService.clearHistory()
    setSelectedOffset(0)
  }, [dataService])

  const handleClearError = useCallback(() => {
    dataService.clearError()
  }, [dataService])

  const handleDownloadLog = useCallback(() => {
    const url = URL.createObjectURL(dataService.exportLogBlob())
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = dataService.suggestedLogFilename()
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoke after the browser has had a chance to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [dataService])

  return (
    <div className="app">
      <div className="container">
        <ErrorBanner message={error} onDismiss={handleClearError} />
        <ControlPanel
          connection={connection}
          file={file}
          playback={playback}
          historyLength={history.length}
          anyDevice={anyDevice}
          onAnyDeviceChange={setAnyDevice}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onLoadFile={handleLoadFile}
          onCloseFile={handleCloseFile}
          onPlay={handlePlay}
          onPause={handlePause}
          onStep={handleStep}
          onRewind={handleRewind}
          onSpeedChange={handleSpeed}
          onDownloadLog={handleDownloadLog}
          onClearHistory={handleClearHistory}
        />
        <StatusBar
          connection={connection}
          file={file}
          historyLength={history.length}
          framingErrors={framingErrors}
        />
        <div className="grid">
          <MainTable
            rows={template}
            history={history}
            selectedOffset={selectedOffset}
            onSelectOffset={setSelectedOffset}
          />
          <BitFieldsTable
            signals={selectedSignals}
            visiblePids={bitPidSet}
            onTogglePid={handleToggleBitPid}
            hasData={latest !== null}
          />
        </div>
        <PIDChart
          rows={template}
          history={history}
          latest={latest}
          visiblePids={chartPidSet}
          onTogglePid={handleToggleChartPid}
        />
        <O2Grid history={history} latest={latest} />
      </div>
    </div>
  )
}

export default App
