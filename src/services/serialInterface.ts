import { ALDLBitDecoder } from './aldlBitDecoder'

/**
 * The ECU streams at 160 baud; we open the port at ten times that so the UART
 * samples each 160-baud pulse ten times. See ALDLBitDecoder.pushUartByte for
 * the details of that trick.
 */
const BAUD_RATE = 1600

/**
 * USB-serial bridges commonly used for an ALDL cable. FTDI's FT232R is what
 * the Howell kit ships with; the others are here so a home-made cable still
 * shows up in the chooser.
 */
const DEFAULT_FILTERS: SerialPortFilter[] = [
  { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232R
  { usbVendorId: 0x0403, usbProductId: 0x6015 }, // FTDI FT-X series
  { usbVendorId: 0x0403, usbProductId: 0x6010 }, // FTDI FT2232
  { usbVendorId: 0x0403, usbProductId: 0x6011 }, // FTDI FT4232
  { usbVendorId: 0x0403, usbProductId: 0x6014 }, // FTDI FT232H
  { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // Silicon Labs CP210x
  { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // WCH CH340
]

/** Reads ALDL frames from a USB-serial cable using the Web Serial API. */
export class SerialInterface {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readLoopDone: Promise<void> | null = null
  /** True while disconnect() is tearing the port down on purpose. */
  private closingByRequest = false
  private readonly decoder = new ALDLBitDecoder((frame) => {
    this.onFrame?.(frame, Date.now())
  })

  /** Called for every complete 20-byte frame. */
  onFrame: ((frame: Uint8Array, timestamp: number) => void) | null = null

  /**
   * Called when the connection goes away by itself: cable unplugged, stream
   * ended or read error. Not called for a user-initiated disconnect().
   */
  onDisconnect: ((reason: string) => void) | null = null

  /** Framing errors seen by the bit decoder since this object was created. */
  get framingErrors(): number {
    return this.decoder.framingErrors
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  isConnected(): boolean {
    return this.port !== null
  }

  /**
   * Ask the user to pick a cable and start reading from it.
   *
   * Resolves false if the user cancelled the chooser; throws an Error with a
   * message that can be shown to the user for anything else.
   */
  async connect(options?: { anyDevice?: boolean }): Promise<boolean> {
    if (!SerialInterface.isSupported()) {
      throw new Error(
        'This browser cannot talk to serial devices. Try Chrome, Edge or Opera on a desktop computer.',
      )
    }
    if (this.port) {
      // Already connected; nothing to do.
      return true
    }

    let port: SerialPort | null = null
    let failure: unknown = null
    try {
      port = await navigator.serial.requestPort(
        options?.anyDevice ? {} : { filters: DEFAULT_FILTERS },
      )
    } catch (error) {
      failure = error
    }
    if (!port) {
      if (failure instanceof DOMException && failure.name === 'NotFoundError') {
        // The user closed the chooser without picking a device.
        return false
      }
      throw userError(
        `Could not show the device list. ${describe(failure)}`,
        failure,
      )
    }

    try {
      await port.open({ baudRate: BAUD_RATE })
    } catch (error) {
      failure = error
    }
    if (failure) {
      throw userError(
        `Could not open the serial port. Is another program using it? (${describe(failure)})`,
        failure,
      )
    }

    this.port = port
    this.closingByRequest = false
    this.decoder.reset()
    navigator.serial.addEventListener('disconnect', this.handleUnplug)
    this.readLoopDone = this.readLoop(port)
    return true
  }

  /** Stop reading and close the port. Safe to call when not connected. */
  async disconnect(): Promise<void> {
    const port = this.port
    if (!port) return

    this.closingByRequest = true
    this.detachUnplugListener()

    // Cancelling makes the pending read() resolve as done, so the read loop
    // exits and releases the reader lock before we close the port.
    try {
      await this.reader?.cancel()
    } catch {
      // The reader may already be gone; closing below is what matters.
    }
    try {
      await this.readLoopDone
    } catch {
      // The read loop reports its own problems.
    }
    this.readLoopDone = null

    try {
      await port.close()
    } catch {
      // Nothing useful to do if the port is already gone.
    }

    this.port = null
    this.reader = null
    this.closingByRequest = false
    this.decoder.reset()
  }

  private async readLoop(port: SerialPort): Promise<void> {
    const readable = port.readable
    if (!readable) {
      this.reportLoss('The cable does not provide any data to read.')
      return
    }

    const reader = readable.getReader()
    this.reader = reader
    let reason = 'The connection to the cable ended.'

    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          for (let i = 0; i < value.length; i++) {
            this.decoder.pushUartByte(value[i])
          }
        }
      }
    } catch (error) {
      reason = `Lost the connection to the cable. ${describe(error)}`
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // Already released.
      }
      if (this.reader === reader) this.reader = null
    }

    if (!this.closingByRequest) {
      this.reportLoss(reason)
    }
  }

  /** navigator.serial fires this when the USB cable is physically removed. */
  private readonly handleUnplug = (event: Event) => {
    if (event.target !== this.port) return
    this.reportLoss('The cable was unplugged.')
  }

  /** Tear down after an unexpected loss and tell whoever is listening. */
  private reportLoss(reason: string): void {
    if (!this.port) return

    const port = this.port
    this.detachUnplugListener()
    this.port = null
    this.readLoopDone = null

    // Best effort: the port is usually already dead at this point.
    void (async () => {
      try {
        await this.reader?.cancel()
      } catch {
        // ignored
      }
      this.reader = null
      try {
        await port.close()
      } catch {
        // ignored
      }
    })()

    this.decoder.reset()
    this.onDisconnect?.(reason)
  }

  private detachUnplugListener(): void {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      navigator.serial.removeEventListener('disconnect', this.handleUnplug)
    }
  }
}

/**
 * An Error with a message fit to show the user, carrying the original failure.
 * `cause` is set by hand because the build targets ES2020.
 */
function userError(message: string, cause: unknown): Error {
  const error = new Error(message)
  Object.defineProperty(error, 'cause', {
    value: cause,
    configurable: true,
    writable: true,
  })
  return error
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
