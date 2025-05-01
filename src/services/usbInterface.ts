type Bit = 0 | 1;

export class USBInterface {
  private port: SerialPort | null = null
  private isConnected = false
  private syncCount = 0;
  private frame: any[] = [];
  private state: 'WAIT_SYNC' | 'START_BIT' | 'READING_BYTE' = 'WAIT_SYNC';
  private bitBuffer: Bit[] = [];
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  public onDataReceived: ((data: Uint8Array) => void) | null = null
  public onDataReceivedError = (error: any) => {
    console.error('USB data reception error:', error)
  }

  constructor() {
  }

  private resetState(): void {
    this.state = 'WAIT_SYNC';
    this.syncCount = 0;
    this.frame = [];
    this.bitBuffer = [];
  }

  private handleBit(bit: Bit): void {
    if (this.state === 'WAIT_SYNC') {
      if (bit === 1) {
        this.syncCount++;
        if (this.syncCount === 9) {
          this.state = 'START_BIT';
          this.bitBuffer = [];
        }
      } else {
        this.syncCount = 0;
      }
    } else if (this.state === 'START_BIT') {
      // Expect a zero bit before each byte
      if (bit === 1) {
        console.warn('Unexpected sync bit during frame - discarding frame');
        this.resetState();
      } else {
        this.state = 'READING_BYTE';
      }
    } else if (this.state === 'READING_BYTE') {
      this.bitBuffer.push(bit);
      if (this.bitBuffer.length >= 8) {
        const byte = this.bitBuffer.reduce((acc: number, b: Bit) => (acc << 1) | b, 0);
        this.frame.push(byte);
        this.bitBuffer = [];
        this.state = 'START_BIT';

        if (this.frame.length >= 20) {
          if (this.onDataReceived) {
            this.onDataReceived(new Uint8Array(this.frame));
          }
          this.resetState();
        }
      }
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    this.reader = this.port.readable.getReader();
    try {
      while (this.isConnected) {
        const { value, done } = await this.reader.read();
        if (done) break;

        for (let i = 0; i < value.length; i++) {
          const byte = value[i];
          const bit: Bit = (byte & 0x08) === 0 ? 1 : 0;
          this.handleBit(bit);
        }
      }
    } catch (error) {
      this.onDataReceivedError(error);
    } finally {
      this.reader.releaseLock();
      this.reader = null;
    }
  }

  async connect(): Promise<boolean> {
    try {
      const filters = [
        { usbVendorId: 0x0403, usbProductId: 0x6001 }
      ];

      this.port = await navigator.serial.requestPort({ filters });
      await this.port.open({ baudRate: 1600 });
      this.isConnected = true;
      this.readLoop();
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        // User cancelled the port selection
        return false;
      }
      console.error('Error connecting to USB device:', e);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
    }
    await this.port?.close();
    this.port = null;
    this.isConnected = false;
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }
} 