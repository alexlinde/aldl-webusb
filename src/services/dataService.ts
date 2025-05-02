import { ALDLProcessor } from './aldlProcessor'
import { USBInterface } from './usbInterface'
import { ProcessedFrame } from '../types/aldl'

interface TestFrame {
  timestamp: string
  frame: number[]
}

export class DataService {
  private aldlProcessor: ALDLProcessor
  private usbInterface: USBInterface
  private testFrames: TestFrame[] = []
  private currentFrameIndex = 0
  private isPlaying = false
  private playbackTimer: number | null = null
  private onDataUpdate: ((frame: ProcessedFrame) => void)
  
  constructor(aldlProcessor: ALDLProcessor, usbInterface: USBInterface, onDataUpdate: (frame: ProcessedFrame) => void) {
    this.aldlProcessor = aldlProcessor
    this.usbInterface = usbInterface
    this.onDataUpdate = onDataUpdate
  }

  getInitialFrame(): ProcessedFrame {
    return { signals: this.aldlProcessor.processFrame(new Uint8Array(20)), timestamp: null }
  }

  startLiveUpdates() {
    this.usbInterface.onDataReceived = (data, timestamp) => {
      const signals = this.aldlProcessor.processFrame(new Uint8Array(data.buffer))
      this.onDataUpdate({ signals, timestamp })
    }
  }

  stopLiveUpdates() {
    // Disconnect from USB device if connected
    if (this.usbInterface.isDeviceConnected()) {
      this.usbInterface.disconnect()
    }
  }

  async loadTestDataFromFile(file: File): Promise<TestFrame[]> {
    try {
      const text = await file.text()
      const frames: TestFrame[] = JSON.parse(text)
      
      this.testFrames = frames
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

  stepTestData(): ProcessedFrame | null {
    if (this.testFrames.length === 0) return null
    
    // If we've reached the end, return null
    if (this.currentFrameIndex >= this.testFrames.length) return null
    
    const frame = this.testFrames[this.currentFrameIndex]
    const signals = this.aldlProcessor.processFrame(new Uint8Array(frame.frame))
    const timestamp = new Date(frame.timestamp).getTime()
    
    this.currentFrameIndex++
    const processedFrame = { signals, timestamp }
    this.onDataUpdate(processedFrame)
    
    return processedFrame
  }

  private playNextFrame() {
    if (!this.isPlaying) return
    
    const frame = this.stepTestData()
    if (frame) {
      this.playbackTimer = window.setTimeout(() => {
        this.playNextFrame()
      }, 100) // Play one frame per second
    } else {
      this.isPlaying = false
    }
  }
} 