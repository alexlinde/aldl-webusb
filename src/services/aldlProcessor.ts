import pidJson from '../assets/aldlPIDs.json'
import bitJson from '../assets/bitFields.json'

import {
  FRAME_LENGTH,
  Signal,
  BitField,
  PidDefinition,
  BitFieldDefinition,
  BitFieldJson,
} from '../types/aldl'

/**
 * Coolant temperature calibration table (A058 "TABLE 1"), sorted ascending by
 * raw byte. Hoisted to module scope so it is allocated once, not per frame.
 */
const COOLANT_TABLE: ReadonlyArray<{ byte: number; temp: number }> = [
  { byte: 0, temp: 200 },
  { byte: 12, temp: 150 },
  { byte: 13, temp: 145 },
  { byte: 14, temp: 140 },
  { byte: 16, temp: 135 },
  { byte: 18, temp: 130 },
  { byte: 21, temp: 125 },
  { byte: 23, temp: 120 },
  { byte: 26, temp: 115 },
  { byte: 30, temp: 110 },
  { byte: 34, temp: 105 },
  { byte: 39, temp: 100 },
  { byte: 44, temp: 95 },
  { byte: 50, temp: 90 },
  { byte: 56, temp: 85 },
  { byte: 64, temp: 80 },
  { byte: 72, temp: 75 },
  { byte: 81, temp: 70 },
  { byte: 92, temp: 65 },
  { byte: 102, temp: 60 },
  { byte: 114, temp: 55 },
  { byte: 126, temp: 50 },
  { byte: 139, temp: 45 },
  { byte: 152, temp: 40 },
  { byte: 165, temp: 35 },
  { byte: 177, temp: 30 },
  { byte: 189, temp: 25 },
  { byte: 199, temp: 20 },
  { byte: 209, temp: 15 },
  { byte: 218, temp: 10 },
  { byte: 225, temp: 5 },
  { byte: 231, temp: 0 },
  { byte: 237, temp: -5 },
  { byte: 241, temp: -10 },
  { byte: 245, temp: -15 },
  { byte: 247, temp: -20 },
  { byte: 250, temp: -25 },
  { byte: 251, temp: -30 },
  { byte: 255, temp: -40 },
]

/**
 * Raw byte -> degrees C, linearly interpolated between calibration points.
 * Byte values outside the table (impossible for a real byte) are clamped.
 */
function byteToCelsius(byteValue: number): number {
  for (let i = 0; i < COOLANT_TABLE.length - 1; i++) {
    const { byte: b0, temp: t0 } = COOLANT_TABLE[i]
    const { byte: b1, temp: t1 } = COOLANT_TABLE[i + 1]
    if (byteValue >= b0 && byteValue <= b1) {
      const fraction = (byteValue - b0) / (b1 - b0)
      return t0 + fraction * (t1 - t0)
    }
  }
  // Only reachable for values outside 0..255.
  return byteValue < COOLANT_TABLE[0].byte
    ? COOLANT_TABLE[0].temp
    : COOLANT_TABLE[COOLANT_TABLE.length - 1].temp
}

// The JSON imports are structurally checked against our interfaces here; the
// double assertion is needed only because TypeScript widens the JSON string
// literals ("coolant") to `string`.
const PID_DEFINITIONS = pidJson as unknown as PidDefinition[]
const BIT_FIELD_JSON = bitJson as BitFieldJson

/** Flattened bitfield definitions, precomputed once per module load. */
const BIT_FIELDS_BY_PID: ReadonlyMap<string, BitFieldDefinition[]> = (() => {
  const map = new Map<string, BitFieldDefinition[]>()
  for (const [pidName, pid] of Object.entries(BIT_FIELD_JSON)) {
    map.set(
      pidName,
      pid.bits.map((bit) => ({
        pidName,
        bitName: bit.name,
        bit: bit.bit,
        type: pid.type,
        description: bit.description,
      })),
    )
  }
  return map
})()

export class ALDLProcessor {
  /** Keyed by PID name; insertion order is the order of aldlPIDs.json. */
  private readonly pidDefinitions: Map<string, PidDefinition> = new Map(
    PID_DEFINITIONS.map((def) => [def.name, def]),
  )

  getPidDefinition(name: string): PidDefinition | undefined {
    return this.pidDefinitions.get(name)
  }

  /**
   * Decode one frame. The returned signals are in the order of aldlPIDs.json.
   */
  processFrame(frame: Uint8Array): Signal[] {
    const signals: Signal[] = []

    this.pidDefinitions.forEach((def, name) => {
      const raw = frame[def.id - 1]
      if (raw === undefined) return

      signals.push({
        name,
        value: decodeValue(def, raw),
        unit: def.unit,
        rawValue: raw,
        round: def.round ?? 0,
        min: def.min,
        max: def.max,
        bitFields: decodeBitFields(name, raw),
        description: def.description,
      })
    })

    return signals
  }

  /**
   * An all-zero frame decoded: gives the UI the ordered PID list, units,
   * min/max and bitfield names before any data has arrived.
   */
  getSignalTemplate(): Signal[] {
    return this.processFrame(new Uint8Array(FRAME_LENGTH))
  }
}

function decodeValue(def: PidDefinition, raw: number): number {
  if (def.lookup === 'coolant') {
    return byteToCelsius(raw)
  }
  if (def.range_low !== undefined && def.range_high !== undefined) {
    // Percentage of the way through the sensor's usable raw range, clamped:
    // raw values below range_low (or above range_high) are out-of-range
    // readings, not negative / >100 % positions.
    const range = def.range_high - def.range_low
    const percent = ((raw - def.range_low) / range) * 100
    return Math.min(100, Math.max(0, percent))
  }
  return raw * def.scale + (def.offset ?? 0)
}

function decodeBitFields(pidName: string, raw: number): BitField[] | undefined {
  const definitions = BIT_FIELDS_BY_PID.get(pidName)
  if (!definitions || definitions.length === 0) return undefined

  return definitions.map((bitDef) => ({
    pidName,
    bitName: bitDef.bitName,
    value: !!(raw & (1 << bitDef.bit)),
    type: bitDef.type,
    description: bitDef.description,
  }))
}
