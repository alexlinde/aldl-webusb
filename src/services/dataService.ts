import { ALDLProcessor } from './aldlProcessor'
import { USBInterface } from './usbInterface'

interface TestFrame {
  timestamp: string
  frame: number[]
}

export class DataService {
  private aldlProcessor: ALDLProcessor
  private usbInterface: USBInterface
  private testFrames: Uint8Array[] = []
  private currentFrameIndex = 0
  private isPlaying = false
  private playbackTimer: number | null = null
  private onDataUpdate: ((signals: any[]) => void)
  
  constructor(aldlProcessor: ALDLProcessor, usbInterface: USBInterface, onDataUpdate: (signals: any[]) => void) {
    this.aldlProcessor = aldlProcessor
    this.usbInterface = usbInterface
    this.onDataUpdate = onDataUpdate
  }

  startLiveUpdates() {
    this.usbInterface.onDataReceived = (data) => {
      const signals = this.aldlProcessor.processFrame(new Uint8Array(data.buffer))
      this.onDataUpdate(signals)
    }
  }

  stopLiveUpdates() {
    // Clear any pending test data playback
    this.pauseTestData()
    
    // Disconnect from USB device if connected
    if (this.usbInterface.isDeviceConnected()) {
      this.usbInterface.disconnect()
    }
  }

  async loadTestDataFromFile(file: File): Promise<Uint8Array[]> {
    try {
      const text = await file.text()
      const frames: TestFrame[] = JSON.parse(text)
      
      this.testFrames = frames.map(frame => new Uint8Array(frame.frame))
      this.currentFrameIndex = 0
      
      return this.testFrames
    } catch (error) {
      console.error('Error loading test data:', error)
      throw error
    }
  }

  playTestData() {
    if (this.testFrames.length === 0) return
    this.isPlaying = true
    this.playNextFrame()
  }

  pauseTestData() {
    this.isPlaying = false
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }
  }

  stepTestData(): any[] {
    if (this.testFrames.length === 0) return []
    
    // If we've reached the end, return empty array
    if (this.currentFrameIndex >= this.testFrames.length) return []
    
    const frame = this.testFrames[this.currentFrameIndex]
    const signals = this.aldlProcessor.processFrame(frame)
    
    this.currentFrameIndex++
    this.onDataUpdate(signals)
    
    return signals
  }

  private playNextFrame() {
    if (!this.isPlaying) return
    
    this.stepTestData()
    
    this.playbackTimer = window.setTimeout(() => {
      this.playNextFrame()
    }, 100) // Play one frame per second
  }
} 