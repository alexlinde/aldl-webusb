import { FC, useState, useEffect } from 'react'
import { Signal, ProcessedFrame } from '../types/aldl'

interface MainTableProps {
  frame: ProcessedFrame
  onFrameSelect: (frame: ProcessedFrame) => void
}

const MainTable: FC<MainTableProps> = ({ frame, onFrameSelect }) => {
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [frameHistory, setFrameHistory] = useState<ProcessedFrame[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [framesPerPage, setFramesPerPage] = useState(8)

  useEffect(() => {
    // Update frames per page based on screen width
    const updateFramesPerPage = () => {
      if (window.innerWidth < 768) {
        setFramesPerPage(4)
      } else {
        setFramesPerPage(8)
      }
    }

    // Set initial value
    updateFramesPerPage()

    // Add resize listener
    window.addEventListener('resize', updateFramesPerPage)

    // Cleanup
    return () => window.removeEventListener('resize', updateFramesPerPage)
  }, [])

  useEffect(() => {
    updateTable(frame)
  }, [frame])

  const updateTable = (frame: ProcessedFrame) => {
    setFrameHistory(prev => {
      // Skip adding the initial zero frame
      if (frame.timestamp === null) {
        return prev
      }
      return [frame, ...prev]
    })
  }

  const updateSelectedFrame = (columnIndex: number, page: number) => {
    const frameIndex = columnIndex + page * framesPerPage
    if (frameIndex < frameHistory.length) {
      onFrameSelect(frameHistory[frameIndex])
    }
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

  const formatTimestamp = (timestamp: number | null): string => {
    if (timestamp === null) return ''
    return new Date(timestamp).toLocaleTimeString()
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
      updateSelectedFrame(selectedColumn, currentPage - 1)
    }
  }

  const handleNextPage = () => {
    const maxPage = Math.floor(frameHistory.length / framesPerPage)
    if (currentPage < maxPage) {
      setCurrentPage(prev => prev + 1)
      updateSelectedFrame(selectedColumn, currentPage + 1)
    }
  }

  const getPageFrames = (): ProcessedFrame[] => {
    const start = currentPage * framesPerPage
    return frameHistory.slice(start, start + framesPerPage)
  }

  const pageFrames = getPageFrames()

  return (
    <div className="table-container">
      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={currentPage === 0}>←</button>
        <span>Page {currentPage + 1}</span>
        <button onClick={handleNextPage} disabled={currentPage >= Math.floor(frameHistory.length / framesPerPage)}>→</button>
      </div>
      <div className="table-responsive">
        <table className="aldl-table">
          <thead>
            <tr>
              <th key="pid-header">PID</th>
              {Array.from({ length: framesPerPage }, (_, i) => (
                <th 
                  key={`header-${i}`}
                  className={i === selectedColumn ? 'selected' : ''}
                  onClick={() => selectColumn(i)}
                  title={pageFrames[i] ? formatTimestamp(pageFrames[i].timestamp) : ''}
                >
                  -{i + currentPage * framesPerPage}
                </th>
              ))}
              <th key="decoded-header">Value</th>
            </tr>
          </thead>
          <tbody>
            {frame.signals.map(signal => {
              const selectedValue = pageFrames[selectedColumn]?.signals.find(s => s.name === signal.name)
              return (
                <tr key={`row-${signal.name}`}>
                  <td key={`pid-${signal.name}`} title={signal.description}>{signal.name}</td>
                  {Array.from({ length: framesPerPage }, (_, i) => (
                    <td 
                      key={`cell-${signal.name}-${i}`}
                      className={i === selectedColumn ? 'selected' : ''}
                    >
                      {getDisplayValue(pageFrames[i]?.signals.find(s => s.name === signal.name))}
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
    </div>
  )
}

export default MainTable 