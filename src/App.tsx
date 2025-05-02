import { FC, useState, useEffect } from 'react'
import './App.css'
import MainTable from './components/MainTable'
import BitFieldsTable from './components/BitFieldsTable'
import O2Grid from './components/O2Grid'
import { ControlPanel } from './components/ControlPanel'
import { ALDLProcessor } from './services/aldlProcessor'
import { USBInterface } from './services/usbInterface'
import { DataService } from './services/dataService'
import { Signal, ProcessedFrame } from './types/aldl'

const App: FC = () => {
  const [processor] = useState(() => new ALDLProcessor())
  const [usbInterface] = useState(() => new USBInterface())
  const [dataService, setDataService] = useState<DataService | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedSignals, setSelectedSignals] = useState<Signal[]>([])
  const [currentFrame, setCurrentFrame] = useState<ProcessedFrame>({ signals: [], timestamp: null })
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [visiblePids, setVisiblePids] = useState<Set<string>>(new Set())
  
  useEffect(() => {
    const newDataService = new DataService(processor, usbInterface, (frame: ProcessedFrame) => {
      setSignals(frame.signals)
      setCurrentFrame(frame)
      // Update selected signals when new signals arrive
      setSelectedSignals(frame.signals)
    })
    setDataService(newDataService)
  }, [processor, usbInterface])

  const handleTogglePid = (pidName: string) => {
    setVisiblePids(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pidName)) {
        newSet.delete(pidName)
      } else {
        newSet.add(pidName)
      }
      return newSet
    })
  }

  const handleFrameSelect = (frame: ProcessedFrame) => {
    setSelectedSignals(frame.signals)
  }

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected)
    if (connected) {
      // Initialize visible PIDs when connecting to USB
      const pidsWithBitFields = new Set(signals
        .filter(signal => signal.bitFields && signal.bitFields.length > 0)
        .map(signal => signal.name))
      setVisiblePids(pidsWithBitFields)
    }
  }

  const handleTestDataLoaded = () => {
    // Initialize visible PIDs when loading test data
    const pidsWithBitFields = new Set(signals
      .filter(signal => signal.bitFields && signal.bitFields.length > 0)
      .map(signal => signal.name))
    setVisiblePids(pidsWithBitFields)
  }

  return (
    <div className="app">
      <div className="container">
        <ControlPanel
          dataService={dataService}
          usbInterface={usbInterface}
          isConnected={isConnected}
          isPlaying={isPlaying}
          onConnectionChange={handleConnectionChange}
          onPlaybackChange={setIsPlaying}
          onTestDataLoaded={handleTestDataLoaded}
        />
        <div className="grid">
          <MainTable
            frame={currentFrame}
            onFrameSelect={handleFrameSelect}
          />
          <BitFieldsTable 
            signals={selectedSignals}
            visiblePids={visiblePids}
            onTogglePid={handleTogglePid}
          />
        </div>
        <O2Grid signals={signals} />
      </div>
    </div>
  )
}

export default App
