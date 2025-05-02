export interface ALDLFrame {
  data: Uint8Array
  timestamp: number
}

export interface ProcessedFrame {
  signals: Signal[]
  timestamp: number | null
}

export interface Signal {
  name: string
  value: number
  unit: string
  rawValue: number
  round: number
  bitFields?: BitField[]
  description?: string
}

export interface BitField {
  pidName: string
  bitName: string
  value: boolean
  type?: string
  description?: string
}

export interface PidDefinition {
  id: number
  name: string
  scale: number
  offset?: number
  unit: string
  range_low?: number
  range_high?: number
  round?: number
  description?: string
}

export interface BitFieldDefinition {
  pidName: string
  bitName: string
  bit: number
  type?: string
  description?: string
}

export interface BitFieldJson {
  [pidName: string]: {
    name: string
    type: string
    bits: Array<{
      bit: number
      name: string
      description?: string
    }>
  }
} 