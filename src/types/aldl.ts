/** Every A058 ALDL frame is exactly 20 bytes. */
export const FRAME_LENGTH = 20

/** One decoded PID value out of a single frame. */
export interface Signal {
  name: string
  value: number
  unit: string
  rawValue: number
  round: number
  min?: number
  max?: number
  bitFields?: BitField[]
  description?: string
}

/** One decoded bit out of a bitfield PID. */
export interface BitField {
  pidName: string
  bitName: string
  value: boolean
  type?: string
  description?: string
}

/** A PID as described in src/assets/aldlPIDs.json. */
export interface PidDefinition {
  /** 1-based byte position within the frame. */
  id: number
  name: string
  scale: number
  offset?: number
  unit: string
  range_low?: number
  range_high?: number
  round?: number
  description?: string
  min?: number
  max?: number
  /** Non-linear decode to apply instead of scale/offset or range_low/range_high. */
  lookup?: 'coolant'
}

/** A single bit of a bitfield PID, flattened out of bitFields.json. */
export interface BitFieldDefinition {
  pidName: string
  bitName: string
  bit: number
  type?: string
  description?: string
}

/** Shape of src/assets/bitFields.json. */
export interface BitFieldJson {
  [pidName: string]: {
    name: string
    /** Optional: only the malfunction-flag words carry a type. */
    type?: string
    bits: Array<{
      bit: number
      name: string
      description?: string
    }>
  }
}

/** A frame with its decoded signals. */
export interface ProcessedFrame {
  /** Epoch milliseconds. */
  timestamp: number
  /** The FRAME_LENGTH raw bytes this was decoded from. */
  raw: Uint8Array
  signals: Signal[]
  /** Event marker the user dropped on this frame. */
  note?: string
}

/**
 * One entry of an on-disk JSON log: the format written by the python
 * aldl-logger and read back by DataService.loadFile(). A log file is an
 * array of these.
 */
export interface LogEntry {
  timestamp: string
  frame: number[]
  /** Event marker; omitted when the frame has none. */
  note?: string
}
