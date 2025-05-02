import { FC, useState, useEffect } from 'react'
import { ProcessedFrame } from '../types/aldl'

interface O2GridProps {
  frame: ProcessedFrame
}

type GridViewType = 'O2' | 'BLM' | 'INT'
type DisplayMode = 'average' | 'last10' | 'latest'

const O2Grid: FC<O2GridProps> = ({ frame }) => {
  const [gridViewType, setGridViewType] = useState<GridViewType>('O2')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('average')
  const [gridData, setGridData] = useState<{
    O2: Map<string, number[]>
    BLM: Map<string, number[]>
    INT: Map<string, number[]>
  }>({
    O2: new Map(),
    BLM: new Map(),
    INT: new Map()
  })

  useEffect(() => {
    if (frame.signals.length > 0) {
      updateGrid(frame.signals)
    }
  }, [frame])

  const handleViewTypeChange = (type: GridViewType) => {
    setGridViewType(type)
  }

  const handleDisplayModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setDisplayMode(event.target.value as DisplayMode)
  }

  const updateGrid = (signals: any[]) => {
    const rpmSignal = signals.find(s => s.name === 'RPM')
    const mapSignal = signals.find(s => s.name === 'MAP-P')
    
    if (!rpmSignal || !mapSignal) return

    const roundedRPM = Math.round(rpmSignal.value / 400) * 400
    const roundedMAP = Math.round(mapSignal.value / 10) * 10
    const gridKey = `${roundedRPM},${roundedMAP}`

    const newGridData = { ...gridData }

    ;(['O2', 'BLM', 'INT'] as GridViewType[]).forEach(viewType => {
      const valueSignal = signals.find(s => s.name === viewType)
      if (valueSignal) {
        const values = newGridData[viewType].get(gridKey) || []
        values.push(valueSignal.value)
        newGridData[viewType].set(gridKey, values)
      }
    })

    setGridData(newGridData)
  }

  const getAverage = (values: number[]): number => {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  const getLast10Average = (values: number[]): number => {
    if (values.length === 0) return 0
    const last10Values = values.slice(-10)
    return last10Values.reduce((sum, val) => sum + val, 0) / last10Values.length
  }

  const getLatestValue = (values: number[]): number => {
    if (values.length === 0) return 0
    return values[values.length - 1]
  }

  const getDisplayValue = (values: number[]): number => {
    if (!values) return 0
    switch (displayMode) {
      case 'average':
        return getAverage(values)
      case 'last10':
        return getLast10Average(values)
      case 'latest':
        return getLatestValue(values)
      default:
        return getAverage(values)
    }
  }

  return (
    <div className="o2-grid-container">
      <div className="grid-controls">
        <div className="grid-view-buttons">
          {(['O2', 'BLM', 'INT'] as GridViewType[]).map(type => (
            <button
              key={type}
              className={gridViewType === type ? 'active' : ''}
              onClick={() => handleViewTypeChange(type)}
            >
              {type}
            </button>
          ))}
          <div className="display-mode-selector">
            <select 
              value={displayMode} 
              onChange={handleDisplayModeChange}
            >
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
            {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map(map => (
              <th key={map}>{map}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 16 }, (_, i) => i * 400).map(rpm => (
            <tr key={rpm}>
              <th>{rpm}</th>
              {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map(map => {
                const gridKey = `${rpm},${map}`
                const values = gridData[gridViewType].get(gridKey)
                return (
                  <td 
                    key={map}
                    data-rpm={rpm}
                    data-map={map}
                  >
                    {values ? getDisplayValue(values).toFixed(0) : ''}
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