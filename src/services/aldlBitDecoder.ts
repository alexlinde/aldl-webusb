import { FRAME_LENGTH } from '../types/aldl'

export type Bit = 0 | 1

/** Number of consecutive 1 bits that mark the start of a frame. */
const SYNC_BITS = 9

type DecoderState = 'WAIT_SYNC' | 'START_BIT' | 'READING_BYTE'

/**
 * Turns the ECU's 160-baud bit stream into 20-byte ALDL frames.
 *
 * Frame format: at least nine consecutive 1 bits (sync), then, for each of the
 * FRAME_LENGTH bytes, a 0 start bit followed by 8 data bits, most significant
 * first. After the last byte the decoder goes back to waiting for sync.
 *
 * Pure and side-effect free apart from the onFrame callback, so it can be
 * tested without any serial hardware.
 */
export class ALDLBitDecoder {
  private state: DecoderState = 'WAIT_SYNC'
  private syncCount = 0
  private bytes: number[] = []
  private bitBuffer: Bit[] = []
  private errorCount = 0

  constructor(private readonly onFrame: (frame: Uint8Array) => void) {}

  /**
   * Number of framing errors seen: a 1 bit where a byte's start bit was due,
   * which means the frame in progress was discarded and the decoder resynced.
   */
  get framingErrors(): number {
    return this.errorCount
  }

  /** Drop any frame in progress and wait for sync again. Keeps the counters. */
  reset(): void {
    this.state = 'WAIT_SYNC'
    this.syncCount = 0
    this.bytes = []
    this.bitBuffer = []
  }

  /**
   * Feed one byte as read from the UART.
   *
   * The ECU does not send UART frames at all: it sends 160-baud pulses, one
   * per bit, each starting with a falling edge, where the width of the low
   * pulse encodes the value (a long low pulse is a 1, a short one a 0).
   * Opening the port at 1600 baud 8N1 - ten times the bit rate - makes the
   * UART emit exactly one byte per 160-baud bit: the falling edge is taken as
   * that byte's start bit, and the byte's own bits are then samples along the
   * pulse. Bit 3 lands in the middle of the pulse, so
   * `(byte & 0x08) === 0` means the line was still low there: a long pulse,
   * i.e. a 1 bit. Anything else means the line had already risen: a 0 bit.
   */
  pushUartByte(byte: number): void {
    this.pushBit((byte & 0x08) === 0 ? 1 : 0)
  }

  /** Feed one decoded 160-baud bit. */
  pushBit(bit: Bit): void {
    switch (this.state) {
      case 'WAIT_SYNC':
        if (bit === 1) {
          this.syncCount++
          if (this.syncCount >= SYNC_BITS) {
            this.state = 'START_BIT'
            this.bytes = []
            this.bitBuffer = []
          }
        } else {
          this.syncCount = 0
        }
        break

      case 'START_BIT':
        if (bit === 0) {
          this.bitBuffer = []
          this.state = 'READING_BYTE'
        } else if (this.bytes.length === 0) {
          // Still in the sync run - the ECU may send more than nine 1 bits.
          // Tolerate them and keep waiting for the first start bit.
        } else {
          // A 1 where a start bit was due: the frame is corrupt. Count it,
          // discard the partial frame and resync. This 1 bit may already be
          // the first of the next sync run.
          this.errorCount++
          this.reset()
          this.syncCount = 1
        }
        break

      case 'READING_BYTE':
        this.bitBuffer.push(bit)
        if (this.bitBuffer.length === 8) {
          // MSB first.
          this.bytes.push(
            this.bitBuffer.reduce<number>((acc, b) => (acc << 1) | b, 0),
          )
          this.bitBuffer = []
          this.state = 'START_BIT'

          if (this.bytes.length === FRAME_LENGTH) {
            const frame = new Uint8Array(this.bytes)
            this.reset()
            this.onFrame(frame)
          }
        }
        break
    }
  }
}
