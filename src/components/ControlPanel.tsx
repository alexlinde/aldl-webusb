import { FC, useState, useRef } from 'react'
import { DataService } from '../services/dataService'
import { USBInterface } from '../services/usbInterface'

interface ControlPanelProps {
  dataService: DataService | null
  usbInterface: USBInterface
  isConnected: boolean
  isPlaying: boolean
  onConnectionChange: (connected: boolean) => void
  onPlaybackChange: (playing: boolean) => void
  onTestDataLoaded: () => void
}

export const ControlPanel: FC<ControlPanelProps> = ({
  dataService,
  usbInterface,
  isConnected,
  isPlaying,
  onConnectionChange,
  onPlaybackChange,
  onTestDataLoaded
}) => {
  const [hasTestData, setHasTestData] = useState(false)
  const [hasMoreFrames, setHasMoreFrames] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConnect = async () => {
    if (!dataService) return
    
    try {
      if (await usbInterface.connect()) {
        onConnectionChange(true)
        dataService.startLiveUpdates()
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = () => {
    if (!dataService) return
    
    dataService.stopLiveUpdates()
    onConnectionChange(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!dataService || !event.target.files?.length) return
    
    try {
      const file = event.target.files[0]
      await dataService.loadTestDataFromFile(file)
      setHasTestData(true)
      setHasMoreFrames(true)
      // Disconnect from USB if connected
      if (isConnected) {
        handleDisconnect()
      }
      dataService.stepTestData()
      onTestDataLoaded()
    } catch (error) {
      console.error('Failed to load test data:', error)
    }
  }

  const handlePlayTestData = () => {
    if (!dataService) return
    
    dataService.playTestData()
    onPlaybackChange(true)
  }

  const handlePauseTestData = () => {
    if (!dataService) return
    
    dataService.pauseTestData()
    onPlaybackChange(false)
  }

  const handleStepTestData = () => {
    if (!dataService) return
    
    const signals = dataService.stepTestData()
    // If no signals returned, we've reached the end
    if (signals === null) {
      setHasMoreFrames(false)
    }
  }

  return (
    <div className="controls">
      <div className="connection-controls">
        {!isConnected ? (
          <button onClick={handleConnect} disabled={hasTestData}>Connect to USB</button>
        ) : (
          <button onClick={handleDisconnect}>Disconnect</button>
        )}
      </div>
      <div className="test-data-controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".json"
          style={{ display: 'none' }}
        />
        <button 
          onClick={() => fileInputRef.current?.click()} 
          disabled={isConnected || hasTestData}
        >
          Upload Test Data
        </button>
        {hasTestData && (
          <>
            {!isPlaying ? (
              <button onClick={handlePlayTestData}>Play Test Data</button>
            ) : (
              <button onClick={handlePauseTestData}>Pause Test Data</button>
            )}
            <button onClick={handleStepTestData} disabled={isPlaying || !hasMoreFrames}>Step Test Data</button>
          </>
        )}
      </div>
    </div>
  )
} 