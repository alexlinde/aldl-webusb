import pidJson from '../assets/aldlPIDs.json?raw'
import bitJson from '../assets/bitFields.json?raw'

import { 
  Signal, 
  PidDefinition, 
  BitFieldDefinition, 
  BitFieldJson 
} from '../types/aldl'

export class ALDLProcessor {
  private pidDefinitions: Map<string, PidDefinition> = new Map()
  private bitFieldDefinitions: BitFieldDefinition[] = []

  constructor() {
    this.loadDefinitions()
  }

  private async loadDefinitions() {
    try {
      // Load PID definitions
      const pidData = JSON.parse(pidJson)
      pidData.forEach((def: PidDefinition) => {
        this.pidDefinitions.set(def.name, def)
      })

      // Load bitfield definitions
      const bitFieldData: BitFieldJson = JSON.parse(bitJson)
      
      // Convert the JSON structure to our internal format
      this.bitFieldDefinitions = Object.entries(bitFieldData).flatMap(([pidName, pidData]) => 
        pidData.bits.map(bit => ({
          pidName,
          bitName: bit.name,
          bit: bit.bit,
          type: pidData.type,
          description: bit.description
        }))
      )
    } catch (error) {
      console.error('Error loading definitions:', error)
    }
  }

  getPidDefinition(name: string): PidDefinition | undefined {
    return this.pidDefinitions.get(name)
  }

  processFrame(frame: Uint8Array): Signal[] {
    const signals: Signal[] = []
    
    this.pidDefinitions.forEach((def, name) => {
      const value = frame[def.id - 1]
      if (value !== undefined) {
        let decodedValue: number
        // Special handling for coolant temperature
        if (name === 'CT') {
          decodedValue = this.byteToCelsius(value)
        } else if (def.range_low !== undefined && def.range_high !== undefined) {
          // Calculate percentage through range
          const range = def.range_high - def.range_low
          decodedValue = ((value - def.range_low) / range) * 100
        } else {
          // Normal scaling for other signals
          decodedValue = value * def.scale + (def.offset || 0)
        }

        // Get bit fields for this PID if they exist
        const bitFields = this.bitFieldDefinitions
          .filter(def => def.pidName === name)
          .map(bitDef => ({
            pidName: name,
            bitName: bitDef.bitName,
            value: !!(value & (1 << bitDef.bit)),
            type: bitDef.type,
            description: bitDef.description
          }))

        signals.push({
          name,
          value: decodedValue,
          unit: def.unit,
          rawValue: value,
          round: def.round || 0,
          bitFields: bitFields.length > 0 ? bitFields : undefined,
          description: def.description
        })
      }
    })

    return signals
  }

  private byteToCelsius(byteValue: number): number {
    // calibration table sorted ascending by byte
    const table: Array<{ byte: number; temp: number }> = [
      { byte: 0,   temp: 200 },
      { byte: 12,  temp: 150 },
      { byte: 13,  temp: 145 },
      { byte: 14,  temp: 140 },
      { byte: 16,  temp: 135 },
      { byte: 18,  temp: 130 },
      { byte: 21,  temp: 125 },
      { byte: 23,  temp: 120 },
      { byte: 26,  temp: 115 },
      { byte: 30,  temp: 110 },
      { byte: 34,  temp: 105 },
      { byte: 39,  temp: 100 },
      { byte: 44,  temp:  95 },
      { byte: 50,  temp:  90 },
      { byte: 56,  temp:  85 },
      { byte: 64,  temp:  80 },
      { byte: 72,  temp:  75 },
      { byte: 81,  temp:  70 },
      { byte: 92,  temp:  65 },
      { byte: 102, temp:  60 },
      { byte: 114, temp:  55 },
      { byte: 126, temp:  50 },
      { byte: 139, temp:  45 },
      { byte: 152, temp:  40 },
      { byte: 165, temp:  35 },
      { byte: 177, temp:  30 },
      { byte: 189, temp:  25 },
      { byte: 199, temp:  20 },
      { byte: 209, temp:  15 },
      { byte: 218, temp:  10 },
      { byte: 225, temp:   5 },
      { byte: 231, temp:   0 },
      { byte: 237, temp:  -5 },
      { byte: 241, temp: -10 },
      { byte: 245, temp: -15 },
      { byte: 247, temp: -20 },
      { byte: 250, temp: -25 },
      { byte: 251, temp: -30 },
      { byte: 255, temp: -40 },
    ];

    for (let i = 0; i < table.length - 1; i++) {
      const { byte: b0, temp: t0 } = table[i];
      const { byte: b1, temp: t1 } = table[i + 1];
      if (byteValue >= b0 && byteValue <= b1) {
        // linear interpolation
        const fraction = (byteValue - b0) / (b1 - b0);
        return t0 + fraction * (t1 - t0);
      }
    }
    throw new Error(`byteToCelsius: byteValue ${byteValue} out of range`);
  }
} 