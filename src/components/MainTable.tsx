import { FC, useState, useEffect } from 'react'
import { Signal } from '../types/aldl'

interface MainTableProps {
  signals: Signal[]
  onFrameSelect?: (signals: Signal[]) => void
}

const MainTable: FC<MainTableProps> = ({ signals, onFrameSelect }) => {
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [frameHistory, setFrameHistory] = useState<Signal[][]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const FRAMES_PER_PAGE = 8

  useEffect(() => {
    updateTable(signals)
  }, [signals])

  const updateSelectedFrame = (columnIndex: number, page: number) => {
    if (onFrameSelect) {
      const frameIndex = columnIndex + page * FRAMES_PER_PAGE
      if (frameIndex < frameHistory.length) {
        onFrameSelect(frameHistory[frameIndex])
      }
    }
  }

  const updateTable = (signals: Signal[]) => {
    setFrameHistory(prev => [signals, ...prev])
  }

  const selectColumn = (columnIndex: number) => {
    setSelectedColumn(columnIndex)
    updateSelectedFrame(columnIndex, currentPage)
  }

  const getDisplayValue = (value: Signal | undefined): string => {
    if (!value || typeof value.rawValue === 'undefined') {
      return ''
    }
    return value.rawValue.toString(16).toUpperCase().padStart(2, '0')
  }

  const getDecodedValue = (value: Signal | undefined): string => {
    if (!value || typeof value.value === 'undefined' || typeof value.unit === 'undefined') {
      return ''
    }
    return `${value.value.toFixed(value.round)} ${value.unit}`
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
      updateSelectedFrame(selectedColumn, currentPage - 1)
    }
  }

  const handleNextPage = () => {
    const maxPage = Math.floor(frameHistory.length / FRAMES_PER_PAGE)
    if (currentPage < maxPage) {
      setCurrentPage(prev => prev + 1)
      updateSelectedFrame(selectedColumn, currentPage + 1)
    }
  }

  const getPageFrames = (): Signal[][] => {
    const start = currentPage * FRAMES_PER_PAGE
    return frameHistory.slice(start, start + FRAMES_PER_PAGE)
  }

  const pageFrames = getPageFrames()

  return (
    <div className="table-container">
      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={currentPage === 0}>←</button>
        <span>Page {currentPage + 1}</span>
        <button onClick={handleNextPage} disabled={currentPage >= Math.floor(frameHistory.length / FRAMES_PER_PAGE)}>→</button>
      </div>
      <table className="aldl-table">
        <thead>
          <tr>
            <th key="pid-header">PID</th>
            {Array.from({ length: FRAMES_PER_PAGE }, (_, i) => (
              <th 
                key={`header-${i}`}
                className={i === selectedColumn ? 'selected' : ''}
                onClick={() => selectColumn(i)}
              >
                -{i + currentPage * FRAMES_PER_PAGE}
              </th>
            ))}
            <th key="decoded-header">Value</th>
          </tr>
        </thead>
        <tbody>
          {signals.map(signal => {
            const selectedValue = pageFrames[selectedColumn]?.find(s => s.name === signal.name)
            return (
              <tr key={`row-${signal.name}`}>
                <td key={`pid-${signal.name}`} title={signal.description}>{signal.name}</td>
                {Array.from({ length: FRAMES_PER_PAGE }, (_, i) => (
                  <td 
                    key={`cell-${signal.name}-${i}`}
                    className={i === selectedColumn ? 'selected' : ''}
                  >
                    {getDisplayValue(pageFrames[i]?.find(s => s.name === signal.name))}
                  </td>
                ))}
                <td key={`decoded-${signal.name}`}>
                  {getDecodedValue(selectedValue)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default MainTable 