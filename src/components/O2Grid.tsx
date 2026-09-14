import { ChangeEvent, FC, useMemo, useState } from 'react'
import { ProcessedFrame } from '../types/aldl'

type GridViewType = 'O2' | 'BLM' | 'INT'
type DisplayMode = 'average' | 'last10' | 'latest'

interface O2GridProps {
  history: ProcessedFrame[]
  latest: ProcessedFrame | null
}

const VIEWS: GridViewType[] = ['O2', 'BLM', 'INT']
const RPM_STEP = 400
const RPM_ROWS = Array.from({ length: 16 }, (_, i) => i * RPM_STEP)
const MAP_STEP = 10
const MAP_COLUMNS = Array.from({ length: 10 }, (_, i) => (i + 1) * MAP_STEP)

/** The RPM/MAP cell a frame falls into, or null when it has no RPM or MAP. */
function binKey(frame: ProcessedFrame): string | null {
  const rpm = frame.signals.find((signal) => signal.name === 'RPM')
  const map = frame.signals.find((signal) => signal.name === 'MAP-P')
  if (!rpm || !map) return null
  return `${Math.round(rpm.value / RPM_STEP) * RPM_STEP},${Math.round(map.value / MAP_STEP) * MAP_STEP}`
}

const O2Grid: FC<O2GridProps> = ({ history, latest }) => {
  const [view, setView] = useState<GridViewType>('O2')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('latest')

  /** One Map per view, keyed `${rpm},${map}`, holding every sample binned there. */
  const bins = useMemo(() => {
    const result: Record<GridViewType, Map<string, number[]>> = {
      O2: new Map(),
      BLM: new Map(),
      INT: new Map(),
    }
    for (const frame of history) {
      const key = binKey(frame)
      if (key === null) continue
      for (const name of VIEWS) {
        const signal = frame.signals.find((candidate) => candidate.name === name)
        if (!signal) continue
        const values = result[name].get(key)
        if (values) values.push(signal.value)
        else result[name].set(key, [signal.value])
      }
    }
    return result
  }, [history])

  const latestKey = latest ? binKey(latest) : null

  const displayValue = (values: number[]): number => {
    if (values.length === 0) return 0
    if (displayMode === 'latest') return values[values.length - 1]
    const window = displayMode === 'last10' ? values.slice(-10) : values
    return window.reduce((sum, value) => sum + value, 0) / window.length
  }

  const handleDisplayModeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setDisplayMode(event.target.value as DisplayMode)
  }

  return (
    <div className="o2-grid-container">
      <div className="grid-controls">
        <div className="grid-view-buttons">
          {VIEWS.map((type) => (
            <button
              type="button"
              key={type}
              className={view === type ? 'active' : ''}
              onClick={() => setView(type)}
            >
              {type}
            </button>
          ))}
          <div className="display-mode-selector">
            <select value={displayMode} onChange={handleDisplayModeChange}>
              <option value="latest">Latest Value</option>
              <option value="last10">Last 10 Average</option>
              <option value="average">All Time Average</option>
            </select>
          </div>
        </div>
      </div>
      <table className="o2-grid-table">
        <thead>
          <tr>
            <th className="axis-label">RPM / MAP (kPa)</th>
            {MAP_COLUMNS.map((map) => (
              <th key={map}>{map}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RPM_ROWS.map((rpm) => (
            <tr key={rpm}>
              <th>{rpm}</th>
              {MAP_COLUMNS.map((map) => {
                const key = `${rpm},${map}`
                const values = bins[view].get(key)
                return (
                  <td
                    key={map}
                    data-rpm={rpm}
                    data-map={map}
                    className={key === latestKey ? 'current' : ''}
                    title={
                      values
                        ? `${values.length} ${values.length === 1 ? 'sample' : 'samples'}`
                        : 'no samples'
                    }
                  >
                    {values ? displayValue(values).toFixed(0) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default O2Grid
